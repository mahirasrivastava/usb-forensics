async function request(path, options) {
  const res = await fetch(`/api${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
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

export function fmtSize(bytes) {
  if (bytes == null) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

export const shortHash = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "—");
