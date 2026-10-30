import { dayKey } from "../../api.js";
import { barPath, niceScale, useWidth } from "./chartKit.js";
import { Tooltip, useTooltip } from "./Tooltip.jsx";

const H = 150, PAD_T = 10, PAD_B = 22, PAD_L = 26;

/** Connections per day over a trailing window. One series, so no legend —
 *  the card title names it. */
export default function TrendBars({ incidents, days = 14 }) {
  const [ref, width] = useWidth();
  const { tip, show, hide } = useTooltip();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return { date: d, key: dayKey(d.toISOString()), count: 0 };
  });
  const index = new Map(buckets.map((b) => [b.key, b]));
  for (const inc of incidents) {
    const b = index.get(dayKey(inc.timestamps?.connect));
    if (b) b.count += 1;
  }

  const { top: max, ticks } = niceScale(Math.max(...buckets.map((b) => b.count), 1));
  const plotW = Math.max(60, width - PAD_L);
  const plotH = H - PAD_T - PAD_B;
  const slot = plotW / days;
  const barW = Math.max(6, slot - 6);          // 2px+ of surface between bars
  const yOf = (v) => PAD_T + plotH - (v / max) * plotH;
  const labelEvery = days > 10 ? 3 : 2;

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={H} role="img"
           aria-label={`USB connections per day for the last ${days} days, peak ${Math.max(...buckets.map((b) => b.count))}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={PAD_L} x2={width} y1={yOf(t)} y2={yOf(t)} />
            <text className="tick" x={PAD_L - 7} y={yOf(t) + 3.5} textAnchor="end">{t}</text>
          </g>
        ))}
        <line className="axis-line" x1={PAD_L} x2={width} y1={yOf(0)} y2={yOf(0)} />

        {buckets.map((b, i) => {
          const x = PAD_L + i * slot + (slot - barW) / 2;
          const h = (b.count / max) * plotH;
          const active = tip?.key === b.key;
          return (
            <g key={b.key} className={`col ${tip && !active ? "dim" : ""}`}>
              {b.count > 0 && (
                <path className="bar" d={barPath({ x, y: yOf(b.count), w: barW, h, dir: "up" })}
                      fill="var(--series-1)" />
              )}
              {i % labelEvery === 0 && (
                <text className="tick" x={x + barW / 2} y={H - 6} textAnchor="middle">
                  {b.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </text>
              )}
              <rect className="hit" x={PAD_L + i * slot} y={PAD_T} width={slot} height={plotH}
                    onPointerEnter={() => show(PAD_L + i * slot + slot / 2, yOf(b.count),
                      <>
                        <div className="t-head">
                          {b.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                        </div>
                        <div className="t-row">
                          <span className="swatch" style={{ background: "var(--series-1)" }} />
                          {b.count} connection{b.count === 1 ? "" : "s"}
                        </div>
                      </>, b.key)}
                    onPointerLeave={hide} />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}
