from engine.graph import build_correlation_graph
from engine.scoring import compute_confidence, evaluate_risk

def sample(files=None, serial="AA010203040506"):
    return {
        "device": {"serial": serial, "volume_label": "SANDISK", "drive_letter": "D:"},
        "artifacts": {
            "usbstor": {"friendly_name": "SanDisk"}, "setupapi": ["x"],
            "eventlog": [{"event_id": 2003}], "mountpoints2": {"drive_letter": "D:"},
            "lnk_files": [{"target_path": "D:\\reports\\salary.xlsx"}],
        },
        "files": files if files is not None else
                 [{"path": "D:\\reports\\salary.xlsx", "size": 45210, "flags": []}],
    }

# --- graph ---
def test_lnk_linked_to_real_file():
    g = build_correlation_graph(sample())
    assert {"source": "lnk:0", "target": "file:d:\\reports\\salary.xlsx",
            "relation": "accessed"} in g["edges"]

def test_artifacts_point_to_device():
    g = build_correlation_graph(sample())
    assert any(e["source"] == "artifact:usbstor" and e["target"].startswith("device:")
               for e in g["edges"])

# --- confidence ---
def test_all_sources_high():
    c = compute_confidence(sample())
    assert c["score"] == 100 and c["level"] == "HIGH"

def test_no_sources_low():
    assert compute_confidence({"artifacts": {}})["level"] == "LOW"

# --- risk ---
def test_whitelisted_clean_device_low():
    inc = sample(files=[{"path": "D:\\notes.txt", "size": 10, "flags": []}])
    assert evaluate_risk(inc, {"AA010203040506"})["level"] == "LOW"

def test_unknown_device_sensitive_and_exe():
    inc = sample(files=[{"path": "D:\\salary.xlsx", "size": 1, "flags": []},
                        {"path": "D:\\tool.exe", "size": 1, "flags": []}])
    r = evaluate_risk(inc, set())
    assert r["score"] == 70 and r["level"] == "HIGH"   # 25 + 20 + 25

def test_tampering_adds_points():
    inc = sample(files=[{"path": "D:\\a.txt", "size": 1,
                         "flags": ["hash_mismatch_possible_tampering"]}])
    assert evaluate_risk(inc, {"AA010203040506"})["score"] == 30

def test_score_capped_at_100():
    inc = sample(files=[{"path": f"D:\\x{i}.exe", "size": 1, "flags": []} for i in range(10)])
    r = evaluate_risk(inc, set())
    assert r["score"] == 100 and r["level"] == "CRITICAL"
