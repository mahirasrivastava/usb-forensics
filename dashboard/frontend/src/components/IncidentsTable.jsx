import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtRelative, fmtTime, riskMeta } from "../api.js";
import { ChainBadge, ConfidenceBadge, RiskBadge } from "./Badges.jsx";
import Empty from "./Empty.jsx";
import { IconUsb } from "./Icons.jsx";

const COLUMNS = [
  { key: "_id", label: "Incident", sort: (i) => i._id },
  { key: "device", label: "Device", sort: (i) => i.artifacts?.usbstor?.friendly_name || i.device?.volume_label || "" },
  { key: "serial", label: "Serial", sort: (i) => i.device?.serial || "" },
  { key: "connect", label: "Connected", sort: (i) => i.timestamps?.connect || "" },
  { key: "files", label: "Files", sort: (i) => i.file_count || 0, align: "right" },
  { key: "confidence", label: "Confidence", sort: (i) => i.confidence?.level || "" },
  { key: "custody", label: "Custody", sort: (i) => String(i.integrity?.custody_chain_valid) },
  { key: "risk", label: "Risk", sort: (i) => riskMeta(i.risk?.level).rank * 1000 + (i.risk?.score || 0) },
];

/** `compact` drops the forensic detail columns so the table still reads well
 *  inside a narrow dashboard column. */
export default function IncidentsTable({ incidents, limit, emptyNote, compact }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState({ key: "connect", dir: "desc" });
  const columns = compact
    ? COLUMNS.filter((c) => ["_id", "device", "connect", "risk"].includes(c.key))
    : COLUMNS;

  const rows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key) || COLUMNS[3];
    const sorted = [...incidents].sort((a, b) => {
      const x = col.sort(a), y = col.sort(b);
      const cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return limit ? sorted.slice(0, limit) : sorted;
  }, [incidents, sort, limit]);

  if (!incidents.length) {
    return (
      <Empty icon={<IconUsb width="30" height="30" />} title="No incidents match">
        {emptyNote || <>Plug in a USB drive with the collector running, or simulate one with <code>python -m engine.fake_collector</code>.</>}
      </Empty>
    );
  }

  const click = (key) => setSort((s) =>
    s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort.key === c.key;
              return (
                <th key={c.key} className="sortable" onClick={() => click(c.key)}
                    style={c.align ? { textAlign: c.align } : undefined}
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.label}
                  <span className="arrow" aria-hidden="true">{active ? (sort.dir === "asc" ? "▲" : "▼") : "▼"}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((inc) => {
            const lv = (inc.risk?.level || "pending").toLowerCase();
            return (
              <tr key={inc._id} className="clickable" tabIndex={0}
                  onClick={() => navigate(`/incidents/${inc._id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/incidents/${inc._id}`)}>
                <td>
                  <span className="id-cell">
                    <span className={`sev-rail ${lv}`} aria-hidden="true" />
                    <span className="mono cell-strong">{inc._id}</span>
                  </span>
                </td>
                <td>
                  <div className="cell-strong">
                    {inc.artifacts?.usbstor?.friendly_name || inc.device?.volume_label || "Unknown device"}
                  </div>
                  <div className="cell-sub">
                    {inc.device?.volume_label || "—"} {inc.device?.drive_letter ? `· ${inc.device.drive_letter}` : ""}
                  </div>
                </td>
                {!compact && <td className="mono">{inc.device?.serial || "—"}</td>}
                <td>
                  <div>{fmtRelative(inc.timestamps?.connect)}</div>
                  <div className="cell-sub">{fmtTime(inc.timestamps?.connect)}</div>
                </td>
                {!compact && <td className="num" style={{ textAlign: "right" }}>{inc.file_count ?? "—"}</td>}
                {!compact && <td><ConfidenceBadge level={inc.confidence?.level} /></td>}
                {!compact && <td><ChainBadge valid={inc.integrity?.custody_chain_valid} /></td>}
                <td><RiskBadge level={inc.risk?.level} score={inc.risk?.score} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
