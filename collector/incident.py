"""Cross-platform part of the collector: hashing files and building the incident
document in the shared schema (see shared/sample_incident.json)."""
import os
import uuid
from datetime import datetime, timezone

from engine.hashing import sha256_of_file

MAX_FILES = 300                      # stop after this many files per drive
MAX_FILE_BYTES = 500 * 1024 * 1024   # don't hash files larger than 500 MB
SKIP_DIRS = {"system volume information", "$recycle.bin", ".trashes",
             ".spotlight-v100", ".fseventsd"}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_incident_id():
    return f"INC-{datetime.now():%Y%m%d}-{uuid.uuid4().hex[:6]}"


def collect_files(root):
    """Hash every regular file under root. Returns (files, skipped_count)."""
    files, skipped = [], 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d.lower() not in SKIP_DIRS]
        for name in filenames:
            path = os.path.join(dirpath, name)
            if len(files) >= MAX_FILES:
                skipped += 1
                continue
            try:
                size = os.path.getsize(path)
                if size > MAX_FILE_BYTES:
                    skipped += 1
                    continue
                files.append({"path": path, "size": size,
                              "sha256_collected": sha256_of_file(path),
                              "sha256_reverified": None, "flags": []})
            except (OSError, PermissionError):
                skipped += 1
    return files, skipped


def build_incident(device, artifacts, files, connect_time=None):
    """Assemble an incident exactly as Module 2 expects.
    risk.score stays null so the engine's watcher picks it up."""
    ts = connect_time or now_iso()
    return {
        "_id": new_incident_id(),
        "device": {
            "vendor_id": device.get("vendor_id"),
            "product_id": device.get("product_id"),
            "serial": device.get("serial"),
            "volume_label": device.get("volume_label"),
            "drive_letter": device.get("drive_letter"),
        },
        "timestamps": {"connect": ts, "disconnect": None},
        "artifacts": {
            "usbstor": artifacts.get("usbstor") or {},
            "setupapi": artifacts.get("setupapi") or [],
            "eventlog": artifacts.get("eventlog") or [],
            "lnk_files": artifacts.get("lnk_files") or [],
            "mountpoints2": artifacts.get("mountpoints2") or {},
        },
        "files": files,
        "correlation_graph": {"nodes": [], "edges": []},
        "confidence": {"score": None, "level": None, "sources_matched": []},
        "risk": {"score": None, "level": None, "justification": []},
        "integrity": {"custody_chain_valid": None},
        # Engine seals this entry (computes evidence_digest and entry_hash).
        "custody_log": [{"action": "collected", "actor": "collector", "timestamp": ts,
                         "evidence_digest": None, "entry_hash": None, "prev_hash": None}],
        "status": "open",
    }
