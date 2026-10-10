import mongomock
import pytest
from fastapi.testclient import TestClient

from collector.incident import build_incident, collect_files
from dashboard.backend.main import app, database
from engine.processor import process_incident

DEVICE = {"serial": "4C5300012308", "volume_label": "SANDISK", "drive_letter": "E:"}
ARTIFACTS = {"usbstor": {"friendly_name": "SanDisk Cruzer"}, "eventlog": [{"event_id": 1006}]}


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("APPROVED_SERIALS", "")
    (tmp_path / "payroll.xlsx").write_text("data")
    db = mongomock.MongoClient().db
    files, _ = collect_files(str(tmp_path))
    inc = build_incident(DEVICE, ARTIFACTS, files)
    db.incidents.insert_one(inc)
    process_incident(inc["_id"], db)
    app.dependency_overrides[database] = lambda: db
    yield TestClient(app), db, inc["_id"], tmp_path
    app.dependency_overrides.clear()


def test_list(env):
    client, _, inc_id, _ = env
    rows = client.get("/api/incidents").json()
    assert rows[0]["_id"] == inc_id
    assert rows[0]["risk"]["level"] == "MEDIUM" and rows[0]["file_count"] == 1


def test_detail_and_404(env):
    client, _, inc_id, _ = env
    doc = client.get(f"/api/incidents/{inc_id}").json()
    assert doc["integrity"]["custody_chain_valid_now"] is True
    assert doc["correlation_graph"]["nodes"]
    assert client.get("/api/incidents/NOPE").status_code == 404


def test_reverify_detects_tampered_file(env):
    client, _, inc_id, drive = env
    (drive / "payroll.xlsx").write_text("TAMPERED")
    res = client.post(f"/api/incidents/{inc_id}/reverify").json()
    assert res["risk"]["score"] == 75 and res["risk"]["level"] == "HIGH"  # 25 + 20 + 30


def test_db_tampering_visible_immediately(env):
    client, db, inc_id, _ = env
    db.incidents.update_one({"_id": inc_id}, {"$set": {"custody_log.0.actor": "hacker"}})
    doc = client.get(f"/api/incidents/{inc_id}").json()
    assert doc["integrity"]["custody_chain_valid_now"] is False


def test_pdf_report_logged_in_custody(env):
    client, db, inc_id, _ = env
    res = client.get(f"/api/incidents/{inc_id}/report")
    assert res.status_code == 200 and res.content.startswith(b"%PDF")
    log = db.incidents.find_one({"_id": inc_id})["custody_log"]
    assert log[-1]["action"] == "report_exported"
    assert client.get(f"/api/incidents/{inc_id}").json()["integrity"]["custody_chain_valid_now"]
