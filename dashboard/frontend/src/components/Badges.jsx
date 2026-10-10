export function RiskBadge({ level, score, large }) {
  const lv = level || "PENDING";
  return (
    <span className={`badge risk-${lv.toLowerCase()} ${large ? "badge-lg" : ""}`}>
      {lv}{score != null && ` · ${score}`}
    </span>
  );
}

export function ChainBadge({ valid }) {
  if (valid == null) return <span className="badge muted">pending</span>;
  return valid
    ? <span className="badge ok">✓ intact</span>
    : <span className="badge bad">✗ broken</span>;
}
