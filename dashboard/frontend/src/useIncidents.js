import { useCallback, useEffect, useRef, useState } from "react";
import { api, fmtRelative } from "./api.js";

const REFRESH_MS = 4000;   // new USB incidents appear without reloading

/** Polls the incident list and derives the counters the shell and the
 *  overview both need. */
export function useIncidents() {
  const [incidents, setIncidents] = useState(null);
  const [error, setError] = useState(null);
  const [syncedAt, setSyncedAt] = useState(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const rows = await api.list();
      if (!alive.current) return;
      setIncidents(rows);
      setError(null);
      setSyncedAt(new Date().toISOString());
    } catch (e) {
      if (alive.current) setError(e.message);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { alive.current = false; clearInterval(t); };
  }, [load]);

  const rows = incidents || [];
  const count = (fn) => rows.filter(fn).length;

  return {
    incidents,
    error,
    refresh: load,
    apiUp: error ? false : incidents != null,
    lastSync: syncedAt ? fmtRelative(syncedAt) : null,
    stats: {
      total: rows.length,
      severe: count((i) => ["CRITICAL", "HIGH"].includes(i.risk?.level)),
      pending: count((i) => i.risk?.score == null),
      broken: count((i) => i.integrity?.custody_chain_valid === false),
      files: rows.reduce((n, i) => n + (i.file_count || 0), 0),
      devices: new Set(rows.map((i) => i.device?.serial).filter(Boolean)).size,
    },
  };
}
