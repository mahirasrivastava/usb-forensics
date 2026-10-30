import { riskMeta } from "../../api.js";

/** A single headline value, so it gets a meter rather than a chart. */
export default function RiskMeter({ score, level }) {
  if (score == null) return null;
  const { color } = riskMeta(level);
  return (
    <div className="meter-wrap">
      <div className="meter" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}
           aria-label={`Risk score ${score} of 100, ${level}`}>
        <i style={{ width: `${Math.min(100, score)}%`, background: color }} />
      </div>
      <div className="meter-scale" aria-hidden="true">
        <span>0</span><span>25 low</span><span>50 med</span><span>70 high</span><span>100</span>
      </div>
    </div>
  );
}
