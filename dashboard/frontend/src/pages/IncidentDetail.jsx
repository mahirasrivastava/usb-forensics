import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmtRelative, fmtSize, fmtTime, shortHash } from "../api.js";
import { useAuth } from "../auth.jsx";
import { ChainBadge, ConfidenceBadge, FileStatusBadge, RiskBadge } from "../components/Badges.jsx";
import EvidenceGraph from "../components/EvidenceGraph.jsx";
import RiskMeter from "../components/charts/RiskMeter.jsx";
import Empty from "../components/Empty.jsx";
import { Skeleton } from "../components/Skeleton.jsx";
import {
  IconAlert, IconDownload, IconFile, IconLink, IconRefresh,
} from "../components/Icons.jsx";

const SOURCES = [
  ["usbstor", "USBSTOR registry"], ["setupapi", "SetupAPI log"], ["eventlog", "Event Log"],
  ["lnk_files", "LNK (opened files)"], ["mountpoints2", "MountPoints2"],
];

/** "(+25) Sensitive filename pattern: C:\\x\\salary.xlsx" → points, rule,
 *  filename, then the full path underneath so the path never buries the rule. */
function Reason({ text }) {
  const m = text.match(/^\((\+\d+)\)\s*(.*)$/);
  const body = m ? m[2] : text;
  const split = body.match(/^([^:]+):\s*(.+)$/);
  const value = split?.[2];
  const isPath = value && /[\\/]/.test(value);
  return (
    <li>
      {m && <span className="pts num">{m[1]}</span>}
      <span className="reason-text">
        <div className="reason-what">{isPath ? split[1] : body}</div>
        {isPath && <>
          <div className="reason-file">{value.split(/[\\/]/).pop()}</div>
          <div className="reason-path" title={value}>{value}</div>
        </>}
      </span>
    </li>
  );
}

export default function IncidentDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const [inc, setInc] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [tab, setTab] = useState("overview");

  const load = useCallback(
    () => api.get(id).then(setInc).catch((e) => setError(e.message)), [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);   // reflects engine re-analysis and DB tampering
    return () => clearInterval(t);
  }, [load]);

  async function reverify() {
    setBusy(true); setNotice(null);
    try {
      const r = await api.reverify(id);
      setNotice(`Re-verified: risk ${r.risk.level} (${r.risk.score}), custody chain ${
        r.integrity.custody_chain_valid ? "intact" : "BROKEN"}`);
      await load();
    } catch (e) {
      setNotice(`Re-verify failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (error) return (
    <div className="card"><Empty icon={<IconAlert width="30" height="30" />} title="Incident unavailable">
      {error} — <Link to="/incidents">back to incidents</Link>
    </Empty></div>
  );
  if (!inc) return (
    <div className="stack">
      <Skeleton w="220px" h={26} />
      <div className="card"><div className="card-body stack">
        <Skeleton h={18} w="60%" /><Skeleton h={18} w="40%" /><Skeleton h={120} />
      </div></div>
    </div>
  );

  const { device = {}, timestamps = {}, risk = {}, confidence = {}, artifacts = {} } = inc;
  const files = inc.files || [];
  const log = inc.custody_log || [];
  const graph = inc.correlation_graph || { nodes: [], edges: [] };
  const chainNow = inc.integrity?.custody_chain_valid_now;
  const matched = new Set(confidence.sources_matched || []);
  const tampered = files.filter((f) => f.flags?.length);
  const opened = (artifacts.lnk_files || []).length;

  const TABS = [
    ["overview", "Overview", null],
    ["graph", "Correlation graph", graph.nodes?.length || 0],
    ["files", "Files", files.length],
    ["custody", "Chain of custody", log.length],
    ["raw", "Raw artifacts", null],
  ];

  return (
    <>
      <Link to="/incidents" className="back">← All incidents</Link>

      <div className={`detail-hero lv-${(risk.level || "pending").toLowerCase()}`}>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="mono">{inc._id}</h1>
          <div className="sub">
            {artifacts.usbstor?.friendly_name || device.volume_label || "Unknown device"}
            {device.drive_letter ? ` · ${device.drive_letter}` : ""} · connected {fmtRelative(timestamps.connect)}
          </div>
        </div>
        <div className="actions">
          {can("reverify") ? (
            <button className="secondary" onClick={reverify} disabled={busy}>
              <IconRefresh />{busy ? "Re-verifying…" : "Re-verify evidence"}
            </button>
          ) : (
            <span className="badge outline" title="Read-only role">view only</span>
          )}
          {can("export") && (
            <a className="button" href={api.reportUrl(id)} onClick={() => setTimeout(load, 1500)}>
              <IconDownload />Download PDF report
            </a>
          )}
        </div>
      </div>
      </div>

      {notice && (
        <div className="notice" style={{ marginBottom: 14 }}>
          <span>{notice}</span>
          <button className="close" onClick={() => setNotice(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className={`banner ${chainNow === false ? "banner-bad" : "banner-ok"}`} style={{ marginBottom: 18 }}>
        <span className="glyph" aria-hidden="true">{chainNow === false ? "✗" : "✓"}</span>
        <div>
          {chainNow === false
            ? <><strong>Chain of custody BROKEN.</strong> A custody entry or a recorded file hash was altered after collection.</>
            : <><strong>Chain of custody intact.</strong> {log.length} hash-linked entries verified.</>}
          {tampered.length > 0 && <> {tampered.length} file{tampered.length === 1 ? "" : "s"} flagged on re-verification.</>}
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 18 }}>
        <section className="card">
          <div className="card-head">
            <h2>Risk</h2>
            {(risk.justification || []).length > 6 && (
              <span className="hint num">{risk.justification.length} rules</span>
            )}
            <div className="right"><RiskBadge level={risk.level} score={risk.score} large /></div>
          </div>
          <div className="card-body">
            {risk.score == null ? (
              <p className="muted-text small">Waiting for the analysis engine…</p>
            ) : (
              <>
                <RiskMeter score={risk.score} level={risk.level} />
                <ul className="reasons scroll-y" style={{ marginTop: 14 }}>
                  {(risk.justification || []).length === 0 && <li>No risk rules triggered.</li>}
                  {(risk.justification || []).map((j, i) => <Reason key={i} text={j} />)}
                </ul>
              </>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Device</h2></div>
          <div className="card-body">
            <dl className="kv">
              <dt>Serial</dt><dd className="mono">{device.serial || "—"}</dd>
              <dt>VID / PID</dt><dd className="mono">{device.vendor_id || "—"} / {device.product_id || "—"}</dd>
              <dt>Volume</dt><dd>{device.volume_label || "—"} {device.drive_letter ? `(${device.drive_letter})` : ""}</dd>
              <dt>Connected</dt><dd>{fmtTime(timestamps.connect)}</dd>
              <dt>Disconnected</dt>
              <dd>{timestamps.disconnect ? fmtTime(timestamps.disconnect)
                : <span className="badge outline">still connected</span>}</dd>
              <dt>Custody</dt><dd><ChainBadge valid={inc.integrity?.custody_chain_valid} /></dd>
            </dl>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Evidence confidence</h2>
            <div className="right"><ConfidenceBadge level={confidence.level} score={confidence.score} /></div>
          </div>
          <div className="card-body">
            <p className="muted-text small" style={{ margin: "0 0 11px" }}>
              Independent Windows artifacts that corroborate this incident.
            </p>
            <div className="chips">
              {SOURCES.map(([key, label]) => (
                <span key={key} className={`chip ${matched.has(key) ? "chip-on" : ""}`}>
                  <span className="glyph" aria-hidden="true">{matched.has(key) ? "✓" : "–"}</span>{label}
                </span>
              ))}
            </div>
            <div className="chips" style={{ marginTop: 14 }}>
              <span className="chip"><IconFile />{files.length} file{files.length === 1 ? "" : "s"} hashed</span>
              <span className="chip"><IconLink />{opened} opened via LNK</span>
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="tabs" role="tablist">
          {TABS.map(([key, label, n]) => (
            <button key={key} role="tab" className="tab" aria-selected={tab === key}
                    onClick={() => setTab(key)}>
              {label}{n != null && <span className="n num">{n}</span>}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="card-body">
            <div className="grid-2">
              <div>
                <h3 style={{ marginBottom: 10 }}>Timeline</h3>
                <dl className="kv">
                  <dt>Collected</dt><dd>{fmtTime(timestamps.connect)}</dd>
                  <dt>Registry key</dt><dd>{fmtTime(artifacts.usbstor?.reg_key_time)}</dd>
                  <dt>Custody entries</dt><dd className="num">{log.length}</dd>
                  <dt>Last action</dt>
                  <dd>{log.length ? `${log[log.length - 1].action} · ${fmtRelative(log[log.length - 1].timestamp)}` : "—"}</dd>
                </dl>
              </div>
              <div>
                <h3 style={{ marginBottom: 10 }}>Integrity</h3>
                <dl className="kv">
                  <dt>Files hashed</dt><dd className="num">{files.length}</dd>
                  <dt>Re-verified</dt><dd className="num">{files.filter((f) => f.sha256_reverified).length}</dd>
                  <dt>Flagged</dt>
                  <dd>{tampered.length
                    ? <span className="badge bad"><span className="glyph">✗</span>{tampered.length} tampered</span>
                    : <span className="badge ok"><span className="glyph">✓</span>none</span>}</dd>
                  <dt>Chain now</dt><dd><ChainBadge valid={chainNow} /></dd>
                </dl>
              </div>
            </div>
          </div>
        )}

        {tab === "graph" && (
          <div className="card-body">
            <EvidenceGraph graph={graph} />
          </div>
        )}

        {tab === "files" && (
          <>
            <div className="tab-note">
              <span className="glyph" aria-hidden="true">i</span>
              <span>
                Forensic snapshot taken when the drive was connected ({fmtTime(timestamps.connect)}).
                The collector hashes the drive once and never re-hashes it, so files created on the drive
                <strong> after</strong> that moment do not appear here — re-plugging the drive creates a new
                incident with its own snapshot. <em>Re-verify evidence</em> re-hashes these {files.length} file
                {files.length === 1 ? "" : "s"} to detect tampering.
              </span>
            </div>
            <div className="table-wrap scroll-y">
            <table>
              <thead><tr>
                <th>Path</th><th style={{ textAlign: "right" }}>Size</th>
                <th>SHA-256 at collection</th><th>Re-verified</th><th>Status</th>
              </tr></thead>
              <tbody>
                {files.length === 0 && <tr><td colSpan={5} className="muted-text">No files recorded.</td></tr>}
                {files.map((f) => {
                  const changed = f.flags?.includes("hash_mismatch_possible_tampering");
                  return (
                    <tr key={f.path} className={changed ? "row-bad" : ""}>
                      <td className="mono path">{f.path}</td>
                      <td className="num" style={{ textAlign: "right" }}>{fmtSize(f.size)}</td>
                      <td className="mono" title={f.sha256_collected}>{shortHash(f.sha256_collected)}</td>
                      <td className="mono" title={f.sha256_reverified || ""}>{shortHash(f.sha256_reverified)}</td>
                      <td><FileStatusBadge flags={f.flags} reverified={f.sha256_reverified} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}

        {tab === "custody" && (
          <div className="table-wrap scroll-y">
            <table>
              <thead><tr>
                <th>#</th><th>Time</th><th>Action</th><th>Actor</th><th>Previous hash</th><th>Entry hash</th>
              </tr></thead>
              <tbody>
                {log.length === 0 && <tr><td colSpan={6} className="muted-text">No custody entries.</td></tr>}
                {log.map((e, i) => (
                  <tr key={i}>
                    <td className="num muted-text">{i + 1}</td>
                    <td>{fmtTime(e.timestamp)}</td>
                    <td className="cell-strong">{e.action}</td>
                    <td>{e.actor}</td>
                    <td className="mono" title={e.prev_hash || ""}>{shortHash(e.prev_hash)}</td>
                    <td className="mono" title={e.entry_hash || ""}>{shortHash(e.entry_hash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "raw" && (
          <div className="card-body">
            <p className="muted-text small" style={{ margin: 0 }}>Exactly as the collector recorded it.</p>
            <pre>{JSON.stringify(artifacts, null, 2)}</pre>
          </div>
        )}
      </section>
    </>
  );
}
