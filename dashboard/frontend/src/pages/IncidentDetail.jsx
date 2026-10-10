import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmtSize, fmtTime, shortHash } from "../api.js";
import { RiskBadge } from "../components/Badges.jsx";
import EvidenceGraph from "../components/EvidenceGraph.jsx";

const SOURCES = [
  ["usbstor", "USBSTOR registry"], ["setupapi", "SetupAPI log"], ["eventlog", "Event Log"],
  ["lnk_files", "LNK (opened files)"], ["mountpoints2", "MountPoints2"],
];

export default function IncidentDetail() {
  const { id } = useParams();
  const [inc, setInc] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

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

  if (error) return <p className="error">{error} — <Link to="/">back to incidents</Link></p>;
  if (!inc) return <p className="muted-text">Loading…</p>;

  const { device = {}, timestamps = {}, risk = {}, confidence = {}, artifacts = {} } = inc;
  const files = inc.files || [];
  const log = inc.custody_log || [];
  const chainNow = inc.integrity?.custody_chain_valid_now;
  const matched = new Set(confidence.sources_matched || []);
  const tampered = files.filter((f) => f.flags?.length);

  return (
    <>
      <Link to="/" className="back">← All incidents</Link>
      <div className="page-head">
        <div>
          <h1 className="mono">{inc._id}</h1>
          <div className="muted-text">
            {artifacts.usbstor?.friendly_name || device.volume_label || "Unknown device"} ·
            connected {fmtTime(timestamps.connect)}
          </div>
        </div>
        <div className="actions">
          <button onClick={reverify} disabled={busy}>{busy ? "Re-verifying…" : "Re-verify evidence"}</button>
          <a className="button secondary" href={api.reportUrl(id)} onClick={() => setTimeout(load, 1500)}>
            Download PDF report</a>
        </div>
      </div>

      {notice && <div className="notice">{notice}</div>}

      <div className={`banner ${chainNow === false ? "banner-bad" : "banner-ok"}`}>
        {chainNow === false
          ? "✗ Chain of custody BROKEN — a custody entry or recorded file hash was altered after collection."
          : `✓ Chain of custody intact — ${log.length} hash-linked entries verified.`}
        {tampered.length > 0 && ` ${tampered.length} file(s) flagged on re-verification.`}
      </div>

      <div className="grid">
        <section className="card">
          <h2>Risk <RiskBadge level={risk.level} score={risk.score} large /></h2>
          {risk.score == null ? <p className="muted-text">Waiting for the analysis engine…</p> : (
            <ul className="reasons">
              {(risk.justification || []).length === 0 && <li>No risk rules triggered.</li>}
              {(risk.justification || []).map((j, i) => {
                const m = j.match(/^\((\+\d+)\)\s*(.*)$/);
                return <li key={i}><span className="pts">{m ? m[1] : ""}</span>{m ? m[2] : j}</li>;
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Device</h2>
          <dl className="kv">
            <dt>Serial</dt><dd className="mono">{device.serial || "—"}</dd>
            <dt>VID / PID</dt><dd className="mono">{device.vendor_id || "—"} / {device.product_id || "—"}</dd>
            <dt>Volume</dt><dd>{device.volume_label || "—"} ({device.drive_letter || "—"})</dd>
            <dt>Connected</dt><dd>{fmtTime(timestamps.connect)}</dd>
            <dt>Disconnected</dt><dd>{timestamps.disconnect ? fmtTime(timestamps.disconnect) : "still connected"}</dd>
          </dl>
        </section>

        <section className="card">
          <h2>Evidence confidence <span className="badge muted">{confidence.level || "—"} · {confidence.score ?? "—"}</span></h2>
          <p className="muted-text small">Independent Windows artifacts that corroborate this incident.</p>
          <div className="chips">
            {SOURCES.map(([key, label]) => (
              <span key={key} className={`chip ${matched.has(key) ? "chip-on" : ""}`}>
                {matched.has(key) ? "✓" : "–"} {label}</span>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <h2>Evidence correlation graph</h2>
        <EvidenceGraph graph={inc.correlation_graph} />
      </section>

      <section className="card table-wrap">
        <h2>Files ({files.length})</h2>
        <table>
          <thead><tr><th>Path</th><th>Size</th><th>SHA-256 at collection</th><th>Re-verified</th><th>Status</th></tr></thead>
          <tbody>
            {files.map((f) => {
              const changed = f.flags?.includes("hash_mismatch_possible_tampering");
              const missing = f.flags?.includes("file_missing_on_reverify");
              return (
                <tr key={f.path} className={changed ? "row-bad" : ""}>
                  <td className="mono path">{f.path}</td>
                  <td>{fmtSize(f.size)}</td>
                  <td className="mono" title={f.sha256_collected}>{shortHash(f.sha256_collected)}</td>
                  <td className="mono" title={f.sha256_reverified || ""}>{shortHash(f.sha256_reverified)}</td>
                  <td>{changed ? <span className="badge bad">tampered</span>
                    : missing ? <span className="badge warn">missing</span>
                    : f.sha256_reverified ? <span className="badge ok">match</span>
                    : <span className="badge muted">not checked</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card table-wrap">
        <h2>Chain of custody</h2>
        <table>
          <thead><tr><th>#</th><th>Time</th><th>Action</th><th>Actor</th><th>Previous hash</th><th>Entry hash</th></tr></thead>
          <tbody>
            {log.map((e, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{fmtTime(e.timestamp)}</td>
                <td>{e.action}</td>
                <td>{e.actor}</td>
                <td className="mono" title={e.prev_hash || ""}>{shortHash(e.prev_hash)}</td>
                <td className="mono" title={e.entry_hash || ""}>{shortHash(e.entry_hash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <details className="card">
        <summary>Raw artifacts (as collected)</summary>
        <pre>{JSON.stringify(artifacts, null, 2)}</pre>
      </details>
    </>
  );
}
