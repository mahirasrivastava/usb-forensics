"""Module 1 — USB Monitoring & Artifact Collector (Windows, run as Administrator).

    python -m collector.collector             # watch for USB plug/unplug (demo mode)
    python -m collector.collector --once E:   # collect one already-plugged drive

On connect: identifies the device, reads the 5 artifact sources, hashes every file
on the drive and inserts an incident with risk.score = null. Module 2's watcher
analyzes it automatically. While a drive stays plugged in, evidence that appears
later — new Recent-file (LNK) records and files created on the drive after the first
walk — is picked up every 10 s, appended, and the incident queued for re-analysis.
Hashes already collected are never recomputed.

Windows only reports a volume-change event at the moment a drive mounts, so on
startup any drive that is *already* plugged in is collected once before the event
loop begins. Without that sweep, starting the collector after inserting the drive
would silently collect nothing.
"""
import argparse
import sys
import time

from engine.processor import get_db
from collector.incident import build_incident, collect_files, now_iso

ARRIVAL, REMOVAL = 2, 3
REFRESH_SECONDS = 10
# Windows fires several ARRIVAL events for one insertion, milliseconds apart.
# Keep this short so a deliberate unplug/replug still registers as a new connection.
DEDUP_SECONDS = 3


def _require_windows():
    if sys.platform != "win32":
        sys.exit("The collector reads the Windows registry and event logs, so it only runs "
                 "on Windows. On Mac/Linux use:  python -m engine.fake_collector")
    try:
        import ctypes
        if not ctypes.windll.shell32.IsUserAnAdmin():
            print("[collector] WARNING: not running as Administrator; some artifacts "
                  "(event logs, SetupAPI) may be unreadable.")
    except Exception:
        pass


def collect_drive(db, drive_letter):
    from collector.windows_artifacts import get_device_for_drive, collect_artifacts

    connect_time = now_iso()
    device = get_device_for_drive(drive_letter)
    if not device["is_usb"]:
        print(f"[collector] {drive_letter} is not a USB drive, ignoring")
        return None
    print(f"[collector] USB connected on {drive_letter}: "
          f"{device.get('friendly_name') or 'unknown'} (serial {device.get('serial')})")

    artifacts = collect_artifacts(device)
    files, skipped = collect_files(drive_letter + "\\")
    incident = build_incident(device, artifacts, files, connect_time)
    db.incidents.insert_one(incident)

    found = [k for k, v in artifacts.items() if v]
    print(f"[collector] Saved {incident['_id']}: {len(files)} files hashed"
          f"{f', {skipped} skipped' if skipped else ''}; artifacts found: {', '.join(found) or 'none'}")
    return incident["_id"]


def mark_disconnected(db, drive_letter):
    doc = db.incidents.find_one(
        {"device.drive_letter": drive_letter, "timestamps.disconnect": None},
        sort=[("timestamps.connect", -1)])
    if doc:
        db.incidents.update_one({"_id": doc["_id"]},
                                {"$set": {"timestamps.disconnect": now_iso()}})
        print(f"[collector] USB removed from {drive_letter}; closed {doc['_id']}")


def refresh_evidence(db, connected):
    """While a drive stays plugged in, pick up evidence that appears after the first
    pass: new Recent-file (LNK) records, and files created on the drive since it was
    walked. Files already collected are never re-hashed — the custody chain protects
    those hashes — but additions are appended and recorded as their own custody entry,
    left unsealed for the engine to hash in the same way the initial entry is."""
    from collector.windows_artifacts import parse_recent_lnks
    for drive, inc_id in list(connected.items()):
        doc = db.incidents.find_one(
            {"_id": inc_id}, {"artifacts.lnk_files": 1, "files": 1, "custody_log": 1})
        if not doc:
            continue
        update, note = {}, []

        lnks = parse_recent_lnks(drive)
        if len(lnks) != len(doc.get("artifacts", {}).get("lnk_files", [])):
            update["artifacts.lnk_files"] = lnks
            note.append(f"{len(lnks)} opened-file records")

        existing = doc.get("files", [])
        added, _ = collect_files(drive + "\\", [f["path"] for f in existing])
        if added:
            update["files"] = existing + added
            update["custody_log"] = doc.get("custody_log", []) + [{
                "action": "files_added", "actor": "collector", "timestamp": now_iso(),
                "evidence_digest": None, "entry_hash": None, "prev_hash": None}]
            note.append(f"{len(added)} new file(s) hashed")

        if update:
            update["risk.score"] = None          # ask the engine to re-analyze
            db.incidents.update_one({"_id": inc_id}, {"$set": update})
            print(f"[collector] {inc_id}: {', '.join(note)}; re-analysis queued")


def list_removable_drives():
    """Drive letters of removable volumes mounted right now, e.g. ['E:', 'F:']."""
    import wmi
    drives = []
    try:
        for ld in wmi.WMI().Win32_LogicalDisk(DriveType=2):
            letter = (ld.DeviceID or "").upper()
            # DriveType 2 also covers card readers sitting empty; those have no Size.
            if letter and ld.Size is not None:
                drives.append(letter)
    except Exception as e:
        print(f"[collector] could not list removable drives: {e}")
    return drives


def collect_already_plugged(db, connected, last_seen):
    """Collect drives inserted before the collector started (no event fires for those)."""
    for drive in list_removable_drives():
        print(f"[collector] {drive} is already plugged in; collecting it now")
        last_seen[drive] = time.time()
        inc_id = collect_drive(db, drive)
        if inc_id:
            connected[drive] = inc_id


def watch(db):
    import pythoncom
    import wmi

    pythoncom.CoInitialize()
    watcher = wmi.WMI().Win32_VolumeChangeEvent.watch_for()
    connected, last_seen = {}, {}
    collect_already_plugged(db, connected, last_seen)
    print("[collector] Watching for USB devices (Ctrl+C to stop)")
    while True:
        try:
            event = watcher(timeout_ms=REFRESH_SECONDS * 1000)
        except wmi.x_wmi_timed_out:
            refresh_evidence(db, connected)
            continue
        drive = (event.DriveName or "").upper()
        if not drive:
            continue
        if event.EventType == ARRIVAL:
            if time.time() - last_seen.get(drive, 0) < DEDUP_SECONDS:  # duplicate event
                continue
            last_seen[drive] = time.time()
            time.sleep(2)   # let Windows finish writing registry/log entries
            inc_id = collect_drive(db, drive)
            if inc_id:
                connected[drive] = inc_id
        elif event.EventType == REMOVAL:
            connected.pop(drive, None)
            mark_disconnected(db, drive)


def main():
    parser = argparse.ArgumentParser(description="USB artifact collector (Module 1)")
    parser.add_argument("--once", metavar="DRIVE", help="collect one drive, e.g. E:")
    args = parser.parse_args()
    _require_windows()
    db = get_db()
    if args.once:
        collect_drive(db, args.once.upper().rstrip("\\"))
    else:
        try:
            watch(db)
        except KeyboardInterrupt:
            print("\n[collector] Stopped")


if __name__ == "__main__":
    main()
