import { Link, useNavigate } from "react-router-dom";
import { fmtRelative, riskMeta } from "../api.js";
import StatCard from "../components/StatCard.jsx";
import IncidentsTable from "../components/IncidentsTable.jsx";
import { StatsSkeleton, TableSkeleton } from "../components/Skeleton.jsx";
import Empty from "../components/Empty.jsx";
import RiskBars from "../components/charts/RiskBars.jsx";
import TrendBars from "../components/charts/TrendBars.jsx";
import { RiskBadge } from "../components/Badges.jsx";
import {
  IconAlert, IconChevron, IconClock, IconFile, IconLink, IconUsb,
} from "../components/Icons.jsx";

export default function Overview({ incidents, stats, error }) {
  const navigate = useNavigate();

  if (error && !incidents) return (
    <div className="card"><Empty icon={<IconAlert width="30" height="30" />} title="Cannot reach the API">
      {error}. Check that the FastAPI backend is running and that Vite is proxying <code>/api</code> to it.
    </Empty></div>
  );
  if (!incidents) return (
    <>
      <StatsSkeleton />
      <div className="card"><TableSkeleton /></div>
    </>
  );

  const total = stats.total || 1;
  const worst = [...incidents].sort(
    (a, b) => riskMeta(b.risk?.level).rank - riskMeta(a.risk?.level).rank ||
              (b.risk?.score || 0) - (a.risk?.score || 0)).slice(0, 4);
  const latest = [...incidents].sort(
    (a, b) => String(b.timestamps?.connect).localeCompare(String(a.timestamps?.connect)))[0];

  return (
    <>
      <div className="hero">
        <div className="hero-row">
          <div>
            <div className="hero-eyebrow">Investigator console</div>
            <h1>Overview</h1>
            <div className="sub">
              Forensic traces from every USB connection, scored and hash-verified.
              {latest && <> Latest connection {fmtRelative(latest.timestamps?.connect)}.</>}
            </div>
          </div>
          <div className="actions">
            <Link className="button" to="/incidents">All incidents <IconChevron /></Link>
          </div>
        </div>
      </div>

      {stats.broken > 0 && (
        <div className="banner banner-bad" style={{ marginBottom: 18 }}>
          <span className="glyph" aria-hidden="true">✗</span>
          <div>
            <strong>{stats.broken} chain{stats.broken === 1 ? "" : "s"} of custody broken.</strong>{" "}
            A custody entry or a recorded hash was altered after collection — open the incident to see which link failed.
          </div>
        </div>
      )}

      <div className="stats">
        <StatCard label="Incidents" value={stats.total} icon={<IconUsb />} accent="var(--c-blue)"
                  hint={`${stats.devices} distinct device${stats.devices === 1 ? "" : "s"}`} />
        <StatCard label="Critical / High" value={stats.severe} icon={<IconAlert />}
                  tone={stats.severe ? "is-alert" : ""} meter={(stats.severe / total) * 100}
                  hint={`${Math.round((stats.severe / total) * 100)}% of all incidents`} />
        <StatCard label="Awaiting analysis" value={stats.pending} icon={<IconClock />}
                  accent="var(--c-indigo)"
                  tone={stats.pending ? "is-warn" : ""} meter={(stats.pending / total) * 100}
                  hint={stats.pending ? "Engine picks these up within seconds" : "Engine is caught up"} />
        <StatCard label="Custody chains" value={stats.broken ? `${stats.broken} broken` : "All intact"}
                  icon={<IconLink />} tone={stats.broken ? "is-alert" : "is-ok"}
                  meter={((total - stats.broken) / total) * 100}
                  hint={`${stats.total - stats.broken} of ${stats.total} verified`} />
        <StatCard label="Files hashed" value={stats.files} icon={<IconFile />} accent="var(--c-cyan)"
                  hint="SHA-256 at collection time" />
      </div>

      <div className="split" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <h2>USB connections per day</h2>
            <span className="hint">last 14 days</span>
          </div>
          <div className="card-body"><TrendBars incidents={incidents} days={14} /></div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Incidents by severity</h2>
            <span className="hint">click a row to filter</span>
          </div>
          <div className="card-body">
            <RiskBars incidents={incidents} onPick={(lv) => navigate(`/incidents?risk=${lv}`)} />
          </div>
        </section>
      </div>

      <div className="split">
        <section className="card">
          <div className="card-head">
            <h2>Recent incidents</h2>
            <div className="right">
              <Link className="button ghost" to="/incidents">View all <IconChevron /></Link>
            </div>
          </div>
          <div className="card-body flush">
            <IncidentsTable incidents={incidents} limit={6} compact />
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Needs review first</h2><span className="hint">highest risk</span></div>
          <div className="card-body stack" style={{ gap: 10 }}>
            {worst.length === 0 && <p className="muted-text small">Nothing scored yet.</p>}
            {worst.map((inc) => (
              <Link key={inc._id} to={`/incidents/${inc._id}`} className="chip"
                    style={{ justifyContent: "space-between", width: "100%", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                <span style={{ minWidth: 0 }}>
                  <div className="mono cell-strong" style={{ color: "var(--text)" }}>{inc._id}</div>
                  <div className="cell-sub">
                    {inc.artifacts?.usbstor?.friendly_name || inc.device?.volume_label || "Unknown device"}
                  </div>
                </span>
                <RiskBadge level={inc.risk?.level} score={inc.risk?.score} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
