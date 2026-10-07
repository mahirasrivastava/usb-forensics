from engine.hashing import sha256_of_file
from engine.custody import verify_custody_chain
from engine.processor import analyze_incident

def make_incident(tmp_path):
    f = tmp_path / "salary.xlsx"; f.write_text("data")
    return {
        "_id": "INC-TEST-0001",
        "device": {"serial": "UNKNOWN", "volume_label": "TEST", "drive_letter": "D:"},
        "artifacts": {"usbstor": {"x": 1}, "eventlog": [{"event_id": 2003}]},
        "files": [{"path": str(f), "size": 4, "sha256_collected": sha256_of_file(f),
                   "sha256_reverified": None, "flags": []}],
        "custody_log": [{"action": "collected", "actor": "system",
                         "timestamp": "2026-09-12T10:15:05Z",
                         "entry_hash": None, "prev_hash": None}],
    }, f

def test_all_fields_populated(tmp_path):
    inc, _ = make_incident(tmp_path)
    analyze_incident(inc)
    assert inc["risk"]["score"] is not None
    assert inc["confidence"]["level"] is not None
    assert inc["correlation_graph"]["nodes"]
    assert inc["integrity"]["custody_chain_valid"] is True
    assert [e["action"] for e in inc["custody_log"]] == ["collected", "analyzed"]

def test_chain_still_valid_after_analysis(tmp_path):
    inc, _ = make_incident(tmp_path)
    analyze_incident(inc)
    assert verify_custody_chain(inc["custody_log"], inc["_id"], inc["files"])

def test_tampered_file_raises_risk(tmp_path):
    inc, f = make_incident(tmp_path)
    f.write_text("TAMPERED")
    analyze_incident(inc)
    assert any("Hash mismatch" in j for j in inc["risk"]["justification"])
