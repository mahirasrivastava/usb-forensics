"""Simulates Module 1: creates test files and inserts an incident like the real collector.
Usage:  python -m engine.fake_collector"""
import uuid
from datetime import datetime, timezone
from pathlib import Path
from engine.hashing import sha256_of_file
from engine.processor import get_db

FAKE_USB = Path(__file__).resolve().parent.parent / "fake_usb"

def make_test_files():
    FAKE_USB.mkdir(exist_ok=True)
    files = {"notes.txt": "meeting notes",
             "salary_confidential.xlsx": "name,salary\nA,50000",
             "tool.exe": "MZ fake executable"}
    for name, content in files.items():
        (FAKE_USB / name).write_text(content)
    return [FAKE_USB / n for n in files]

def build_incident():
    now = datetime.now(timezone.utc).isoformat()
    paths = make_test_files()
    return {
        "_id": f"INC-{datetime.now():%Y%m%d}-{uuid.uuid4().hex[:6]}",
        "device": {"vendor_id": "0781", "product_id": "5567", "serial": "FAKE123456",
                   "volume_label": "FAKE_USB", "drive_letter": "E:"},
        "timestamps": {"connect": now, "disconnect": None},
        "artifacts": {
            "usbstor": {"friendly_name": "Fake USB Device", "reg_key_time": now},
            "setupapi": ["Device Install - USBSTOR\\Disk&Ven_Fake"],
            "eventlog": [{"event_id": 2003, "source": "DriverFrameworks-UserMode", "time": now}],
            "lnk_files": [{"target_path": str(paths[1]), "accessed_time": now}],
            "mountpoints2": {"guid": "{fake-guid}", "drive_letter": "E:"},
        },
        "files": [{"path": str(p), "size": p.stat().st_size,
                   "sha256_collected": sha256_of_file(p),
                   "sha256_reverified": None, "flags": []} for p in paths],
        "correlation_graph": {"nodes": [], "edges": []},
        "confidence": {"score": None, "level": None, "sources_matched": []},
        "risk": {"score": None, "level": None, "justification": []},
        "integrity": {"custody_chain_valid": None},
        "custody_log": [{"action": "collected", "actor": "system", "timestamp": now,
                         "entry_hash": None, "prev_hash": None}],
        "status": "open",
    }

if __name__ == "__main__":
    doc = build_incident()
    get_db().incidents.insert_one(doc)
    print(f"Fake collector inserted {doc['_id']} (files in fake_usb/)")
