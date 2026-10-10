import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtTime } from "../api.js";
import { RiskBadge, ChainBadge } from "../components/Badges.jsx";

const REFRESH_MS = 4000; // new USB incidents appear without reloading

export default function IncidentsList() {
  const [incidents, setIncidents] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const load = () =>
      api.list()
        .then((rows) => { if (alive) { setIncidents(rows); setError(null); } })
        .catch((e) => alive && setError(e.message));
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (error && !incidents) return <p className="error">Cannot reach the API: {error}. Is the backend running on port 8000?</p>;
  if (!incidents) return <p className="muted-text">Loading incidents…</p>;

  const count = (fn) => incidents.filter(fn).length;
  const stats = [
    ["Incidents", incidents.length, ""],
    ["Critical / High", count((i) => ["CRITICAL", "HIGH"].includes(i.risk?.level)), "stat-bad"],
    ["Awaiting analysis", count((i) => i.risk?.score == null), ""],
    ["Broken custody chains", count((i) => i.integrity?.custody_chain_valid === false), "stat-bad"],
  ];

  return (
    <>
      <div className="page-head">
        <h1>USB incidents</h1>
        <span className="live">● live</span>
      </div>

      <div className="stats">
        {stats.map(([label, value, cls]) => (
          <div key={label} className={`stat ${value && cls ? cls : ""}`}>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {incidents.length === 0 ? (
        <p className="muted-text">No incidents yet. Plug in a USB drive with the collector running,
          or run <code>python -m engine.fake_collector</code>.</p>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Incident</th><th>Device</th><th>Serial</th><th>Connected</th>
                <th>Files</th><th>Confidence</th><th>Custody</th><th>Risk</th></tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc._id} className="clickable" onClick={() => navigate(`/incidents/${inc._id}`)}>
                  <td className="mono">{inc._id}</td>
                  <td>{inc.artifacts?.usbstor?.friendly_name || inc.device?.volume_label || "Unknown"}
                    <span className="sub">{inc.device?.drive_letter}</span></td>
                  <td className="mono">{inc.device?.serial || "—"}</td>
                  <td>{fmtTime(inc.timestamps?.connect)}</td>
                  <td>{inc.file_count}</td>
                  <td>{inc.confidence?.level || "—"}</td>
                  <td><ChainBadge valid={inc.integrity?.custody_chain_valid} /></td>
                  <td><RiskBadge level={inc.risk?.level} score={inc.risk?.score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
