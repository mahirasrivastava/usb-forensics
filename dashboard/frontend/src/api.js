async function request(path, options) {
  const res = await fetch(`/api${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  health: () => request("/health"),
  list: () => request("/incidents"),
  get: (id) => request(`/incidents/${encodeURIComponent(id)}`),
  reverify: (id) => request(`/incidents/${encodeURIComponent(id)}/reverify`, { method: "POST" }),
  reportUrl: (id) => `/api/incidents/${encodeURIComponent(id)}/report`,
};

export function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString();
}

/** "4 min ago" — keeps the live feed readable at a glance. */
export function fmtRelative(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 45) return "just now";
  const steps = [[60, "min", 60], [3600, "hr", 3600], [86400, "day", 86400]];
  for (const [limit, unit, div] of steps) {
    if (secs < limit * 60 || div === 86400) {
      const n = Math.max(1, Math.round(secs / div));
      if (div === 86400 && n > 6) return d.toLocaleDateString();
      return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
    }
  }
  return d.toLocaleDateString();
}

export function fmtSize(bytes) {
  if (bytes == null) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

export const shortHash = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "—");

/* Severity is a status scale, so each level carries a glyph and a label as well
   as a colour — the colour is never the only cue. */
export const RISK_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export const RISK_META = {
  CRITICAL: { glyph: "◆", color: "var(--critical-line)", rank: 4 },
  HIGH:     { glyph: "▲", color: "var(--high-line)", rank: 3 },
  MEDIUM:   { glyph: "●", color: "var(--medium-line)", rank: 2 },
  LOW:      { glyph: "▪", color: "var(--low-line)", rank: 1 },
  PENDING:  { glyph: "◌", color: "var(--muted)", rank: 0 },
};

export const riskMeta = (level) => RISK_META[level] || RISK_META.PENDING;
export const riskClass = (level) => `risk-${(level || "pending").toLowerCase()}`;

/** Local YYYY-MM-DD, used to bucket incidents per day. */
export function dayKey(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
