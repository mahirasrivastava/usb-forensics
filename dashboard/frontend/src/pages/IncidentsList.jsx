import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RISK_LEVELS } from "../api.js";
import IncidentsTable from "../components/IncidentsTable.jsx";
import DateFilter, { inRange } from "../components/DateFilter.jsx";
import Empty from "../components/Empty.jsx";
import { TableSkeleton } from "../components/Skeleton.jsx";
import { IconAlert, IconSearch } from "../components/Icons.jsx";

const CUSTODY = [["all", "All"], ["intact", "Intact"], ["broken", "Broken"]];

export default function IncidentsList({ incidents, error }) {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");

  const riskParam = params.get("risk");
  const selected = useMemo(
    () => new Set(riskParam ? riskParam.split(",").filter(Boolean) : []), [riskParam]);
  const custody = params.get("custody") || "all";
  const dateRange = {
    preset: params.get("range") || "all",
    from: params.get("from") || "",
    to: params.get("to") || "",
  };

  const setDateRange = (next) => {
    const p = new URLSearchParams(params);
    next.preset && next.preset !== "all" ? p.set("range", next.preset) : p.delete("range");
    next.from ? p.set("from", next.from) : p.delete("from");
    next.to ? p.set("to", next.to) : p.delete("to");
    setParams(p, { replace: true });
  };

  const setRisk = (next) => {
    const p = new URLSearchParams(params);
    if (next.size) p.set("risk", [...next].join(","));
    else p.delete("risk");
    setParams(p, { replace: true });
  };
  const toggleRisk = (lv) => {
    const next = new Set(selected);
    next.has(lv) ? next.delete(lv) : next.add(lv);
    setRisk(next);
  };
  const setCustody = (v) => {
    const p = new URLSearchParams(params);
    v === "all" ? p.delete("custody") : p.set("custody", v);
    setParams(p, { replace: true });
  };

  if (error && !incidents) return (
    <div className="card"><Empty icon={<IconAlert width="30" height="30" />} title="Cannot reach the API">
      {error}
    </Empty></div>
  );

  const rows = incidents || [];
  const needle = q.trim().toLowerCase();
  const filtered = rows.filter((i) => {
    const lv = i.risk?.level || "PENDING";
    if (selected.size && !selected.has(lv)) return false;
    if (custody === "intact" && i.integrity?.custody_chain_valid === false) return false;
    if (custody === "broken" && i.integrity?.custody_chain_valid !== false) return false;
    if (!inRange(i.timestamps?.connect, dateRange)) return false;
    if (!needle) return true;
    return [i._id, i.device?.serial, i.device?.volume_label, i.device?.drive_letter,
            i.artifacts?.usbstor?.friendly_name, i.device?.vendor_id, i.device?.product_id]
      .some((v) => String(v || "").toLowerCase().includes(needle));
  });

  const datesOn = dateRange.preset !== "all" || !!dateRange.from || !!dateRange.to;
  const activeFilters = selected.size > 0 || custody !== "all" || needle.length > 0 || datesOn;

  return (
    <>
      <div className="hero">
        <div className="hero-row">
          <div>
            <div className="hero-eyebrow">Evidence log</div>
            <h1>All incidents</h1>
            <div className="sub">Every USB connection the collector has recorded, newest first.</div>
          </div>
        </div>
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="search">
            <IconSearch />
            <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search incidents"
                   placeholder="Search id, serial, volume, vendor…" />
            {q && <button className="clear" onClick={() => setQ("")} aria-label="Clear search">×</button>}
          </div>

          <DateFilter value={dateRange} onChange={setDateRange} />

          <div className="segmented" role="group" aria-label="Filter by risk level">
            {[...RISK_LEVELS, "PENDING"].map((lv) => (
              <button key={lv} aria-pressed={selected.has(lv)} onClick={() => toggleRisk(lv)}>{lv}</button>
            ))}
          </div>

          <div className="segmented" role="group" aria-label="Filter by custody chain">
            {CUSTODY.map(([v, label]) => (
              <button key={v} aria-pressed={custody === v} onClick={() => setCustody(v)}>{label}</button>
            ))}
          </div>

          {activeFilters && (
            <button className="ghost" onClick={() => { setQ(""); setParams(new URLSearchParams(), { replace: true }); }}>
              Reset
            </button>
          )}
          <span className="toolbar-count">
            {incidents ? `${filtered.length} of ${rows.length}` : "loading…"}
          </span>
        </div>

        <div className="card-body flush">
          {!incidents
            ? <TableSkeleton rows={6} />
            : <IncidentsTable incidents={filtered}
                              emptyNote={activeFilters ? "Try widening the filters or clearing the search." : undefined} />}
        </div>
      </section>
    </>
  );
}
