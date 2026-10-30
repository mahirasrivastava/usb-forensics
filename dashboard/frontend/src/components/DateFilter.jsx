import { useEffect, useRef, useState } from "react";
import { IconClock } from "./Icons.jsx";

/** Preset rows first, custom range behind a hairline in the footer. */
export const PRESETS = [
  ["all", "All time", null],
  ["today", "Today", 0],
  ["7d", "Last 7 days", 7],
  ["30d", "Last 30 days", 30],
  ["90d", "Last 90 days", 90],
];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** Does this incident's connect time fall inside the selected window? */
export function inRange(iso, { preset, from, to }) {
  if (!iso) return preset === "all" && !from && !to;
  const t = new Date(iso);
  if (isNaN(t)) return true;

  if (from && t < startOfDay(from)) return false;
  if (to) {
    const end = startOfDay(to);
    end.setDate(end.getDate() + 1);          // "to" is inclusive of that whole day
    if (t >= end) return false;
  }
  if (from || to) return true;

  const days = PRESETS.find(([k]) => k === preset)?.[2];
  if (days == null) return true;
  const cutoff = startOfDay(new Date());
  if (days > 0) cutoff.setDate(cutoff.getDate() - (days - 1));
  return t >= cutoff;
}

export function rangeLabel({ preset, from, to }) {
  if (from || to) {
    const f = from ? new Date(from).toLocaleDateString() : "…";
    const t = to ? new Date(to).toLocaleDateString() : "…";
    return `${f} – ${t}`;
  }
  return PRESETS.find(([k]) => k === preset)?.[1] || "All time";
}

export default function DateFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const active = value.preset !== "all" || value.from || value.to;

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div className="datefilter" ref={box}>
      <button type="button" className={`secondary datefilter-btn ${active ? "on" : ""}`}
              onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true">
        <IconClock width="14" height="14" />
        {rangeLabel(value)}
        <span className="caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="popover" role="menu">
          {PRESETS.map(([key, label]) => {
            const chosen = !value.from && !value.to && value.preset === key;
            return (
              <button key={key} type="button" role="menuitemradio" aria-checked={chosen}
                      className={`popover-row ${chosen ? "chosen" : ""}`}
                      onClick={() => { onChange({ preset: key, from: "", to: "" }); setOpen(false); }}>
                <span className="check" aria-hidden="true">{chosen ? "✓" : ""}</span>{label}
              </button>
            );
          })}

          <div className="popover-foot">
            <div className="popover-foot-head">Custom range</div>
            <div className="popover-dates">
              <label className="field">
                <span>From</span>
                <input type="date" value={value.from || ""} max={value.to || undefined}
                       onChange={(e) => onChange({ ...value, preset: "all", from: e.target.value })} />
              </label>
              <label className="field">
                <span>To</span>
                <input type="date" value={value.to || ""} min={value.from || undefined}
                       onChange={(e) => onChange({ ...value, preset: "all", to: e.target.value })} />
              </label>
            </div>
            {(value.from || value.to) && (
              <button type="button" className="ghost" style={{ marginTop: 8 }}
                      onClick={() => onChange({ preset: "all", from: "", to: "" })}>
                Clear dates
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
