"""Cross-platform tests for Module 1 (the Windows readers are tested live on Windows)."""
import os

import mongomock

from collector.incident import build_incident, collect_files
from collector.windows_artifacts import _serial_from_instance, _find_target, _filetime_to_iso
from engine.processor import process_incident
from engine.watcher import pending_ids

DEVICE = {"serial": "4C5300012308", "volume_label": "SANDISK", "drive_letter": "E:",
          "vendor_id": "0781", "product_id": "5567"}
ARTIFACTS = {"usbstor": {"friendly_name": "SanDisk Cruzer"}, "setupapi": ["x"],
             "eventlog": [{"event_id": 1006}], "lnk_files": [],
             "mountpoints2": {"guid": "{abc}"}}


def make_drive(tmp_path):
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs" / "salary_confidential.xlsx").write_text("name,salary")
    (tmp_path / "tool.exe").write_text("MZ")
    (tmp_path / "System Volume Information").mkdir()
    (tmp_path / "System Volume Information" / "skip.dat").write_text("x")
    return tmp_path


def test_collect_files_hashes_and_skips_system_dirs(tmp_path):
    files, skipped = collect_files(str(make_drive(tmp_path)))
    names = sorted(os.path.basename(f["path"]) for f in files)
    assert names == ["salary_confidential.xlsx", "tool.exe"]
    assert all(len(f["sha256_collected"]) == 64 and f["flags"] == [] for f in files)


def test_incident_matches_contract(tmp_path):
    files, _ = collect_files(str(make_drive(tmp_path)))
    inc = build_incident(DEVICE, ARTIFACTS, files)
    assert inc["_id"].startswith("INC-")
    assert inc["risk"]["score"] is None                      # engine picks it up
    assert inc["custody_log"][0]["entry_hash"] is None       # engine seals it
    assert set(inc["artifacts"]) == {"usbstor", "setupapi", "eventlog",
                                     "lnk_files", "mountpoints2"}


def test_full_pipeline_collector_to_engine(tmp_path, monkeypatch):
    monkeypatch.setenv("APPROVED_SERIALS", "")
    db = mongomock.MongoClient().db
    files, _ = collect_files(str(make_drive(tmp_path)))
    inc = build_incident(DEVICE, ARTIFACTS, files)
    db.incidents.insert_one(inc)

    assert pending_ids(db) == [inc["_id"]]
    process_incident(inc["_id"], db)
    done = db.incidents.find_one({"_id": inc["_id"]})

    assert pending_ids(db) == []
    assert done["integrity"]["custody_chain_valid"] is True
    assert done["risk"]["score"] == 70          # unknown device 25 + sensitive 20 + exe 25
    assert done["confidence"]["level"] == "HIGH"


def test_serial_parsing():
    assert _serial_from_instance("4C5300012308&0") == "4C5300012308"
    assert _serial_from_instance("7&2a8b3c&0") == "7&2a8b3c"


def test_lnk_target_found_anywhere():
    assert _find_target({"link_info": {"local_base_path": "E:\\a.txt"}}) == "E:\\a.txt"
    assert _find_target({"x": [{"relative_path": "..\\b"}]}) == "..\\b"


def test_filetime_conversion():
    assert _filetime_to_iso(116444736000000000).startswith("1970-01-01")


def test_collect_files_skips_paths_already_collected(tmp_path):
    drive = make_drive(tmp_path)
    first, _ = collect_files(str(drive))
    assert len(first) == 2

    (drive / "NEWLY_ADDED.txt").write_text("created after the drive was walked")
    added, _ = collect_files(str(drive), [f["path"] for f in first])

    assert [os.path.basename(f["path"]) for f in added] == ["NEWLY_ADDED.txt"]
    assert len(added[0]["sha256_collected"]) == 64


def test_rewalk_with_nothing_new_returns_nothing(tmp_path):
    drive = make_drive(tmp_path)
    first, _ = collect_files(str(drive))
    assert collect_files(str(drive), [f["path"] for f in first]) == ([], 0)


def test_rewalk_stops_at_the_file_cap(tmp_path, monkeypatch):
    # At the cap the drive must not be walked again on every 10 s refresh.
    import collector.incident as incident
    monkeypatch.setattr(incident, "MAX_FILES", 2)
    drive = make_drive(tmp_path)
    first, _ = collect_files(str(drive))
    (drive / "late.txt").write_text("too late")
    assert collect_files(str(drive), [f["path"] for f in first]) == ([], 0)
