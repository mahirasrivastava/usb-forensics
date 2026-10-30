/** Stat tile: a headline number with an optional meter. The meter is a share
 *  of the total, never a second scale. */
export default function StatCard({ label, value, hint, icon, tone = "", meter, accent }) {
  return (
    <div className={`stat ${tone}`} style={accent ? { "--tile": accent } : undefined}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-ico">{icon}</span>}
      </div>
      <div className="stat-value num">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
      {meter != null && (
        <div className="stat-meter" role="presentation">
          <i style={{ width: `${Math.max(0, Math.min(100, meter))}%` }} />
        </div>
      )}
    </div>
  );
}
