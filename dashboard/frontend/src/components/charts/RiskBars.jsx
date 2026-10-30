import { RISK_LEVELS, riskMeta } from "../../api.js";
import { barPath, useWidth } from "./chartKit.js";
import { Tooltip, useTooltip } from "./Tooltip.jsx";

const ROW_H = 30, GAP = 10, LABEL_W = 78, VALUE_W = 38;

/** Incident count per severity. Severity is an ordered status scale, so each
 *  row is directly labelled — the colour never carries the level alone. */
export default function RiskBars({ incidents, onPick }) {
  const [ref, width] = useWidth();
  const { tip, show, hide } = useTooltip();

  const levels = [...RISK_LEVELS];
  const pending = incidents.filter((i) => i.risk?.score == null).length;
  if (pending) levels.push("PENDING");

  const rows = levels.map((lv) => ({
    level: lv,
    count: lv === "PENDING" ? pending : incidents.filter((i) => i.risk?.level === lv).length,
    ...riskMeta(lv),
  }));

  const max = Math.max(1, ...rows.map((r) => r.count));
  const plotW = Math.max(60, width - LABEL_W - VALUE_W);
  const svgH = rows.length * (ROW_H + GAP) - GAP;
  const total = incidents.length || 1;

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={svgH} role="img"
           aria-label={`Incidents by severity: ${rows.map((r) => `${r.level} ${r.count}`).join(", ")}`}>
        {rows.map((r, i) => {
          const y = i * (ROW_H + GAP);
          const barH = 16;
          const barY = y + (ROW_H - barH) / 2;
          const w = (r.count / max) * plotW;
          const pct = Math.round((r.count / total) * 100);
          return (
            <g key={r.level} className={`row ${tip && tip.key !== r.level ? "dim" : ""}`}>
              <text className="cat-label" x={0} y={y + ROW_H / 2 + 4}>{r.level}</text>
              {/* track keeps short bars legible against the surface */}
              <rect x={LABEL_W} y={barY} width={plotW} height={barH} rx={4}
                    fill="var(--surface-sunken)" />
              <path className="bar" d={barPath({ x: LABEL_W, y: barY, w, h: barH })} fill={r.color} />
              <text className="mark-label" x={LABEL_W + plotW + 8} y={y + ROW_H / 2 + 4}>
                {r.count}
              </text>
              <rect className="hit" x={0} y={y} width={Math.max(width, 1)} height={ROW_H + GAP}
                    onPointerEnter={() => show(
                      LABEL_W + Math.min(Math.max(w, 24), plotW), y,
                      <>
                        <div className="t-head">{r.level}</div>
                        <div className="t-row">
                          <span className="swatch" style={{ background: r.color }} />
                          {r.count} incident{r.count === 1 ? "" : "s"} · {pct}% of {incidents.length}
                        </div>
                      </>, r.level)}
                    onPointerLeave={hide}
                    onClick={() => onPick?.(r.level)} />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}
