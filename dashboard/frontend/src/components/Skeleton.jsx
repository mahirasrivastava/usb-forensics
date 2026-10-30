export function Skeleton({ w = "100%", h = 14, style }) {
  return <div className="skel" style={{ width: w, height: h, ...style }} />;
}

export function StatsSkeleton({ n = 4 }) {
  return (
    <div className="stats">
      {Array.from({ length: n }, (_, i) => (
        <div className="stat" key={i}>
          <div className="stat-top"><Skeleton w="45%" h={11} /></div>
          <Skeleton w="35%" h={28} />
          <div style={{ marginTop: 10 }}><Skeleton w="60%" h={11} /></div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="card-body stack" style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} h={18} w={`${95 - i * 6}%`} />
      ))}
    </div>
  );
}
