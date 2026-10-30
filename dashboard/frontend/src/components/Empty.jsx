export default function Empty({ icon, title, children }) {
  return (
    <div className="empty">
      {icon && <div className="icon">{icon}</div>}
      {title && <h3>{title}</h3>}
      <div className="small">{children}</div>
    </div>
  );
}
