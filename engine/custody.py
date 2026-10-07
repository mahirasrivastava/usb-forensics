import hashlib, json
from datetime import datetime, timezone

UNHASHED = (None, "", "…")

def _now():
    return datetime.now(timezone.utc).isoformat()

def evidence_digest(files):
    """One hash summarising every collected file hash."""
    hashes = sorted(f.get("sha256_collected") or "" for f in files)
    return hashlib.sha256("|".join(hashes).encode()).hexdigest()

def compute_entry_hash(prev_hash, incident_id, action, actor, timestamp, digest):
    payload = json.dumps([prev_hash, incident_id, action, actor, timestamp, digest])
    return hashlib.sha256(payload.encode()).hexdigest()

def _hash_entry(entry, prev_hash, incident_id):
    return compute_entry_hash(prev_hash, incident_id, entry["action"],
                              entry["actor"], entry["timestamp"], entry["evidence_digest"])

def append_custody_entry(custody_log, incident_id, action, actor, files):
    prev = custody_log[-1]["entry_hash"] if custody_log else None
    entry = {"action": action, "actor": actor, "timestamp": _now(),
             "evidence_digest": evidence_digest(files), "prev_hash": prev}
    entry["entry_hash"] = _hash_entry(entry, prev, incident_id)
    custody_log.append(entry)
    return custody_log

def seal_unhashed_entries(custody_log, incident_id, files):
    """Give the collector's placeholder entries real hashes."""
    prev = None
    for e in custody_log:
        if e.get("entry_hash") in UNHASHED:
            e.setdefault("evidence_digest", evidence_digest(files))
            e["prev_hash"] = prev
            e["entry_hash"] = _hash_entry(e, prev, incident_id)
        prev = e["entry_hash"]
    return custody_log

def verify_custody_chain(custody_log, incident_id, files=None):
    """True only if every entry, every link and (optionally) the evidence are intact."""
    prev = None
    current_digest = evidence_digest(files) if files is not None else None
    for e in custody_log:
        if e.get("prev_hash") != prev:
            return False
        if _hash_entry(e, prev, incident_id) != e.get("entry_hash"):
            return False
        if current_digest and e.get("evidence_digest") != current_digest:
            return False
        prev = e["entry_hash"]
    return True
