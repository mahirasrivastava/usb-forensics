import { useEffect, useMemo, useState } from "react";
import { ROLES, cryptoReady, useAuth } from "../auth.jsx";
import { useTheme } from "../theme.js";
import { api } from "../api.js";
import {
  IconAlert, IconFile, IconLink, IconMoon, IconShield, IconSun, IconUsb,
} from "../components/Icons.jsx";

const POINTS = [
  [<IconUsb key="i" />, "Five independent artifact sources",
   "USBSTOR, MountPoints2, SetupAPI, Event Log and LNK records, correlated into one incident."],
  [<IconFile key="i" />, "SHA-256 on every file",
   "Hashed at collection, re-verified on demand — tampering shows up as a flagged file."],
  [<IconLink key="i" />, "Hash-linked chain of custody",
   "Each entry seals the one before it, so an edited log fails verification."],
];

/** Rough strength signal for the sign-up field — length first, then variety. */
function strengthOf(pw) {
  if (!pw) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return { score, label: ["too short", "weak", "fair", "good", "strong"][score] };
}

/** The login page can reach the API before you sign in — it has no auth — so
 *  it is worth saying up front whether the stack behind it is actually up. */
function BackendStatus() {
  const [state, setState] = useState({ up: null, count: 0 });
  useEffect(() => {
    let alive = true;
    api.list()
      .then((rows) => alive && setState({ up: true, count: rows.length }))
      .catch(() => alive && setState({ up: false, count: 0 }));
    return () => { alive = false; };
  }, []);
  if (state.up == null) return <div className="auth-status"><span className="dot" />Checking the engine…</div>;
  return (
    <div className={`auth-status ${state.up ? "up" : "down"}`}>
      <span className={`dot ${state.up ? "up pulse" : "down"}`} />
      {state.up
        ? <><strong>{state.count}</strong> incident{state.count === 1 ? "" : "s"} indexed · engine connected</>
        : <>API unreachable — start the backend on port 8010</>}
    </div>
  );
}

export default function Login() {
  const { signIn, signUp, hasAccounts, accountCount } = useAuth();
  const { isDark, toggle } = useTheme();
  const [mode, setMode] = useState(hasAccounts ? "in" : "up");
  const [form, setForm] = useState({ name: "", username: "", password: "", confirm: "", role: "investigator" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const signingUp = mode === "up";
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(null); };
  const strength = useMemo(() => strengthOf(form.password), [form.password]);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (signingUp && form.password !== form.confirm) return setError("The two passwords do not match.");
    setBusy(true);
    const r = signingUp ? await signUp(form) : await signIn(form.username, form.password);
    if (!r.ok) { setError(r.error); setBusy(false); }
  }

  const switchMode = (next) => {
    setMode(next); setError(null); setShow(false);
    setForm((f) => ({ ...f, password: "", confirm: "" }));
  };

  return (
    <div className="auth">
      <div className="auth-glow" aria-hidden="true"><i /><i /></div>

      <button className="icon-btn auth-theme" onClick={toggle} aria-label="Toggle colour theme"
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}>
        {isDark ? <IconSun /> : <IconMoon />}
      </button>

      <section className="auth-pitch">
        <div className="auth-brand">
          <span className="brand-mark auth-mark"><IconShield width="22" height="22" /></span>
          <span className="auth-wordmark">
            <span className="auth-name">USB Forensics</span>
            <span className="auth-kicker">Investigator console</span>
          </span>
        </div>

        <h1>Every USB connection,<br />accounted for.</h1>
        <p className="auth-lede">
          Windows remembers far more about a plugged-in drive than most people expect.
          This console gathers those traces, scores the risk, and proves the evidence has not been altered.
        </p>

        <ul className="auth-points">
          {POINTS.map(([icon, title, body]) => (
            <li key={title}>
              <span className="auth-point-ico">{icon}</span>
              <span>
                <strong>{title}</strong>
                <span className="muted-text"> — {body}</span>
              </span>
            </li>
          ))}
        </ul>

        <BackendStatus />
      </section>

      <section className="auth-card">
        <div className="auth-card-body">
          <div className="segmented auth-tabs" role="group" aria-label="Sign in or create an account">
            <button type="button" aria-pressed={!signingUp} onClick={() => switchMode("in")}>Sign in</button>
            <button type="button" aria-pressed={signingUp} onClick={() => switchMode("up")}>Create account</button>
          </div>

          <h2 className="auth-title">{signingUp ? "Create your account" : "Welcome back"}</h2>
          <p className="auth-sub">
            {signingUp ? (
              hasAccounts
                ? "Pick a username, a password and the role you need."
                : "No accounts on this browser yet — this one will be the first."
            ) : hasAccounts ? (
              `${accountCount} account${accountCount === 1 ? "" : "s"} on this browser.`
            ) : (
              <>No accounts on this browser yet.{" "}
                <button type="button" className="linklike" onClick={() => switchMode("up")}>
                  Create one to get started
                </button>.</>
            )}
          </p>

          {!cryptoReady() && (
            <div className="auth-error" role="alert" style={{ marginBottom: 14 }}>
              <IconAlert width="14" height="14" />
              Open the dashboard on <strong>localhost</strong> — password hashing needs a secure context.
            </div>
          )}

          <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
            <div className={signingUp ? "field-row" : ""}>
              {signingUp && (
                <label className="field">
                  <span>Display name</span>
                  <input value={form.name} onChange={set("name")} autoComplete="name" placeholder="Your name" />
                </label>
              )}
              <label className="field">
                <span>Username</span>
                <input value={form.username} onChange={set("username")} autoComplete="username" autoFocus
                       placeholder="e.g. a.sharma" />
              </label>
            </div>

            <div className={signingUp ? "field-row" : ""}>
              <label className="field">
                <span>Password</span>
                <span className="field-wrap">
                  <input type={show ? "text" : "password"} value={form.password} onChange={set("password")}
                         autoComplete={signingUp ? "new-password" : "current-password"}
                         placeholder={signingUp ? "min 8 chars" : "••••••••"} />
                  <button type="button" className="field-toggle" onClick={() => setShow((v) => !v)}
                          aria-label={show ? "Hide password" : "Show password"} tabIndex={-1}>
                    {show ? "Hide" : "Show"}
                  </button>
                </span>
              </label>
              {signingUp && (
                <label className="field">
                  <span>Confirm</span>
                  <input type={show ? "text" : "password"} value={form.confirm} onChange={set("confirm")}
                         autoComplete="new-password" placeholder="••••••••" />
                </label>
              )}
            </div>

            {signingUp && form.password && (
              <div className={`strength s${strength.score}`}>
                <span className="strength-bars" aria-hidden="true"><i /><i /><i /><i /></span>
                <span className="strength-label">{strength.label}</span>
              </div>
            )}

            {signingUp && (
              <fieldset className="rolepick">
                <legend>Role</legend>
                <div className="rolepick-opts">
                  {Object.entries(ROLES).map(([key, r]) => (
                    <label key={key} className={`rolepick-opt ${form.role === key ? "on" : ""}`}>
                      <input type="radio" name="role" value={key} checked={form.role === key}
                             onChange={() => { setForm((f) => ({ ...f, role: key })); setError(null); }} />
                      <span>
                        <span className="rolepick-title">{r.label}</span>
                        <span className="rolepick-blurb">{r.blurb}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {error && (
              <div className="auth-error" role="alert">
                <IconAlert width="14" height="14" />{error}
              </div>
            )}

            <button type="submit" className="auth-submit"
                    disabled={busy || !cryptoReady() || !form.username || !form.password}>
              {busy ? (signingUp ? "Creating…" : "Signing in…") : (signingUp ? "Create account & sign in" : "Sign in")}
            </button>
          </form>

          <details className="auth-note">
            <summary>How this sign-in works</summary>
            <p>
              Accounts live in this browser only — the password is stored as a PBKDF2-SHA256 hash, never
              in plain text, and nothing is sent anywhere. The API itself is unauthenticated, so your role
              decides what this dashboard offers you, not what the server will answer.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
