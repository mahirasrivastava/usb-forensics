import { riskClass, riskMeta } from "../api.js";

export function RiskBadge({ level, score, large }) {
  const lv = level || "PENDING";
  const { glyph } = riskMeta(lv);
  return (
    <span className={`badge ${riskClass(lv)} ${large ? "badge-lg" : ""}`}>
      <span className="glyph" aria-hidden="true">{glyph}</span>
      {lv}{score != null && <span className="num">· {score}</span>}
    </span>
  );
}

export function ChainBadge({ valid }) {
  if (valid == null) return <span className="badge muted"><span className="glyph">◌</span>pending</span>;
  return valid
    ? <span className="badge ok"><span className="glyph">✓</span>intact</span>
    : <span className="badge bad"><span className="glyph">✗</span>broken</span>;
}

export function ConfidenceBadge({ level, score }) {
  if (!level) return <span className="badge muted">—</span>;
  const tone = level === "HIGH" ? "ok" : level === "MEDIUM" ? "warn" : "outline";
  return (
    <span className={`badge ${tone}`}>
      {level}{score != null && <span className="num">· {score}</span>}
    </span>
  );
}

export function FileStatusBadge({ flags, reverified }) {
  const has = (f) => flags?.includes(f);
  if (has("hash_mismatch_possible_tampering"))
    return <span className="badge bad"><span className="glyph">✗</span>tampered</span>;
  if (has("file_missing_on_reverify"))
    return <span className="badge warn"><span className="glyph">!</span>missing</span>;
  if (has("evidence_unreachable"))
    return <span className="badge muted" title="The drive is not mounted on the machine running the dashboard, so this file could not be re-hashed. This is not a tampering finding.">
      <span className="glyph">—</span>drive offline</span>;
  if (reverified) return <span className="badge ok"><span className="glyph">✓</span>match</span>;
  return <span className="badge muted">not checked</span>;
}
