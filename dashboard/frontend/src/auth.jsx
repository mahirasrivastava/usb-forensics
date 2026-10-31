import { createContext, useContext, useEffect, useMemo, useState } from "react";

/* ───────────────────────────────────────────────────────────────────────────
   Accounts are created by whoever uses this dashboard and are stored in this
   browser's localStorage, with the password kept only as a PBKDF2-SHA256 hash
   over a random per-account salt. There is no account server: the FastAPI
   backend has no authentication and was left unchanged, so this decides what
   the dashboard offers, not what the API will answer. Accounts do not follow
   you to another browser or machine.
   ─────────────────────────────────────────────────────────────────────────── */

export const ROLES = {
  investigator: {
    label: "Investigator",
    blurb: "Can act on evidence — the two actions that write to the chain of custody.",
    can: ["view", "reverify", "export"],
    extra: [
      "Re-verify evidence — re-hashes every file and appends an “analyzed” custody entry",
      "Download the PDF report — appends a “report_exported” custody entry",
    ],
  },
  viewer: {
    label: "Viewer",
    blurb: "Read-only. Sees exactly the same evidence, but cannot alter the record.",
    can: ["view"],
    extra: [],
  },
};

/** What every signed-in person sees, whatever their role. */
export const SHARED_ACCESS = [
  "Every incident, its risk score and the exact rules that fired",
  "Device identity, evidence confidence and the correlation graph",
  "All file paths, SHA-256 hashes and tampering flags",
  "The full chain-of-custody log and the raw collected artifacts",
  "Search, risk, custody and date filters",
];

const ACCOUNTS_KEY = "usbf.accounts";
const SESSION_KEY = "usbf.session";
const ITERATIONS = 150_000;

const load = (key, store, fallback) => {
  try { return JSON.parse(store.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, store, value) => {
  try {
    if (value == null) store.removeItem(key);
    else store.setItem(key, JSON.stringify(value));
  } catch { /* private mode — nothing persists, which is fine */ }
};

const bytesToHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** PBKDF2 needs WebCrypto, which browsers only expose in a secure context
 *  (localhost counts; a plain-http LAN address does not). */
export const cryptoReady = () => typeof crypto !== "undefined" && !!crypto?.subtle;

/** WebCrypto can be missing or blocked (insecure origin, hardened browser
 *  settings, some extensions). Turn that into a message the person can act on
 *  rather than a rejected promise nobody catches. */
async function hashPassword(password, saltHex) {
  if (!cryptoReady())
    throw new Error("This browser will not hash passwords here. Open the dashboard on "
                    + "http://localhost, not a LAN address like http://192.168.x.x.");
  try {
    return await derive(password, saltHex);
  } catch (err) {
    throw new Error("Password hashing failed in this browser ("
                    + (err?.message || err) + "). Try a normal (non-private) window, "
                    + "or another browser.");
  }
}

async function derive(password, saltHex) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, 256);
  return bytesToHex(bits);
}

const newSalt = () => bytesToHex(crypto.getRandomValues(new Uint8Array(16)));

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accounts, setAccounts] = useState(() => load(ACCOUNTS_KEY, localStorage, []));
  const [user, setUser] = useState(() => load(SESSION_KEY, sessionStorage, null));

  useEffect(() => save(ACCOUNTS_KEY, localStorage, accounts), [accounts]);
  useEffect(() => save(SESSION_KEY, sessionStorage, user), [user]);

  const value = useMemo(() => ({
    user,
    accountCount: accounts.length,
    hasAccounts: accounts.length > 0,

    async signUp({ name, username, password, role }) {
      if (!cryptoReady())
        return { ok: false, error: "Password hashing needs a secure context — open the dashboard on localhost." };
      const handle = username.trim().toLowerCase();
      if (handle.length < 3) return { ok: false, error: "Username needs at least 3 characters." };
      if (!/^[a-z0-9._-]+$/.test(handle))
        return { ok: false, error: "Username can use letters, numbers, dot, dash and underscore." };
      if (accounts.some((a) => a.username === handle))
        return { ok: false, error: "That username is already taken on this browser." };
      if (password.length < 8) return { ok: false, error: "Password needs at least 8 characters." };
      if (!ROLES[role]) return { ok: false, error: "Pick a role." };

      const salt = newSalt();
      const account = {
        username: handle,
        name: name.trim() || handle,
        role,
        salt,
        hash: await hashPassword(password, salt),
        createdAt: new Date().toISOString(),
      };
      setAccounts((prev) => [...prev, account]);
      setUser({ username: handle, name: account.name, role, since: new Date().toISOString() });
      return { ok: true };
    },

    async signIn(username, password) {
      if (!cryptoReady())
        return { ok: false, error: "Password hashing needs a secure context — open the dashboard on localhost." };
      const handle = username.trim().toLowerCase();
      const hit = accounts.find((a) => a.username === handle);
      // hash either way so a wrong username and a wrong password cost the same
      const candidate = await hashPassword(password, hit?.salt || newSalt());
      if (!hit || candidate !== hit.hash) return { ok: false, error: "Wrong username or password." };
      setUser({ username: hit.username, name: hit.name, role: hit.role, since: new Date().toISOString() });
      return { ok: true };
    },

    signOut: () => setUser(null),
    can: (what) => !!(user && ROLES[user.role]?.can.includes(what)),
  }), [accounts, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
