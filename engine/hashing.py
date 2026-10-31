import hashlib
import os
import re

# Flags owned by re-verification. They describe the *latest* check, so they are
# cleared and recomputed on every run rather than accumulating across runs.
REVERIFY_FLAGS = ("hash_mismatch_possible_tampering", "file_missing_on_reverify",
                  "evidence_unreachable")

def sha256_of_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def _add_flag(entry, flag):
    entry.setdefault("flags", [])
    if flag not in entry["flags"]:
        entry["flags"].append(flag)

def evidence_root(path):
    """The volume a collected path lives on: 'F:\\dir\\x' -> 'F:\\', '/mnt/u/x' -> '/'."""
    drive = re.match(r"^([A-Za-z]:)[\\/]", path)
    return drive.group(1) + "\\" if drive else os.path.sep

def evidence_reachable(path):
    """False when the drive itself is absent — unplugged, or we're on another host.
    That is not evidence of tampering, so it must not be reported as a missing file."""
    return os.path.isdir(evidence_root(path))

def reverify_file(entry, drive_reachable=None):
    path = entry["path"]
    if drive_reachable is None:
        drive_reachable = evidence_reachable(path)
    entry["flags"] = [f for f in entry.get("flags", []) if f not in REVERIFY_FLAGS]
    try:
        current = sha256_of_file(path)
    except OSError:
        # Catches FileNotFoundError and Windows' "device is not ready" (WinError 21).
        # Drop any earlier hash: a measurement we did not take this run must never
        # be presented as the current one.
        entry["sha256_reverified"] = None
        _add_flag(entry, "file_missing_on_reverify" if drive_reachable
                  else "evidence_unreachable")
        return entry
    entry["sha256_reverified"] = current
    if current != entry["sha256_collected"]:
        _add_flag(entry, "hash_mismatch_possible_tampering")
    return entry
