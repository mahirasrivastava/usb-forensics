import { Link, useLocation, useParams } from "react-router-dom";
import { useTheme } from "../theme.js";
import { useAuth } from "../auth.jsx";
import {
  IconShield, IconGrid, IconList, IconSun, IconMoon, IconRefresh, IconUsb, IconHelp,
} from "./Icons.jsx";

/** Two of the nav rows share the /incidents path and differ only by query, so
 *  the active row is decided here rather than by NavLink's path match. */
function NavRow({ to, icon, children, count, alert, active }) {
  return (
    <Link to={to} className={`nav-item ${active ? "active" : ""}`}
          aria-current={active ? "page" : undefined}>
      <span className="nav-ico">{icon}</span>
      <span>{children}</span>
      {count != null && <span className={`nav-count num ${alert ? "alert" : ""}`}>{count}</span>}
    </Link>
  );
}

function Crumbs() {
  const { pathname } = useLocation();
  const { id } = useParams();
  if (id) return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <Link to="/incidents">Incidents</Link>
      <span className="sep" aria-hidden="true">/</span>
      <span className="here mono">{id}</span>
    </nav>
  );
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <span className="here">
        {pathname.startsWith("/incidents") ? "All incidents"
          : pathname === "/help" ? "Help & FAQ"
          : "Overview"}
      </span>
    </nav>
  );
}

const NEEDS_REVIEW = "CRITICAL,HIGH";

export default function AppShell({ children, stats, apiUp, lastSync, onRefresh }) {
  const { isDark, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const { pathname, search } = useLocation();
  const onIncidents = pathname === "/incidents";
  const needsReview = onIncidents && new URLSearchParams(search).get("risk") === NEEDS_REVIEW;

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark"><IconShield width="19" height="19" /></span>
          <span>
            <div className="brand-name">USB Forensics</div>
            <div className="brand-sub">Investigator console</div>
          </span>
        </Link>

        <div className="nav-label">Monitoring</div>
        <NavRow to="/" icon={<IconGrid />} active={pathname === "/"}>Overview</NavRow>
        <NavRow to="/incidents" icon={<IconList />} count={stats?.total}
                active={pathname.startsWith("/incidents") && !needsReview}>Incidents</NavRow>
        <NavRow to={`/incidents?risk=${NEEDS_REVIEW}`} icon={<IconUsb />} active={needsReview}
                count={stats?.severe} alert={stats?.severe > 0}>
          Needs review
        </NavRow>

        <div className="nav-label">Reference</div>
        <NavRow to="/help" icon={<IconHelp />} active={pathname === "/help"}>Help &amp; FAQ</NavRow>

        <div className="sidebar-foot">
          {user && (
            <div className="whoami">
              <span className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</span>
              <span className="whoami-text">
                <span className="whoami-name">{user.name}</span>
                <span className="whoami-role">{user.role}</span>
              </span>
            </div>
          )}
          {user && (
            <div className="whoami-actions">
              <button className="ghost whoami-out" onClick={signOut}>Sign out</button>
            </div>
          )}
          <div className="health">
            <span className={`dot ${apiUp === false ? "down" : apiUp ? "up pulse" : ""}`} />
            {apiUp === false ? "API unreachable" : apiUp ? "Engine connected" : "Connecting…"}
          </div>
          <div className="health" style={{ marginTop: 6 }}>
            <span className="dot" style={{ background: "transparent" }} />
            {lastSync ? `Synced ${lastSync}` : "—"}
          </div>
        </div>
      </aside>

      <div>
        <header className="topbar">
          <Crumbs />
          <div className="topbar-right">
            <span className="live" title="The dashboard polls the API every few seconds">
              <span className={`dot ${apiUp === false ? "down" : "up pulse"}`} />
              {apiUp === false ? "offline" : "live"}
            </span>
            {onRefresh && (
              <button className="icon-btn" onClick={onRefresh} title="Refresh now" aria-label="Refresh now">
                <IconRefresh />
              </button>
            )}
            <button className="icon-btn" onClick={toggle} aria-label="Toggle colour theme"
                    title={isDark ? "Switch to light theme" : "Switch to dark theme"}>
              {isDark ? <IconSun /> : <IconMoon />}
            </button>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
