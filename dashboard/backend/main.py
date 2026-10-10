"""Module 3 — Investigator Dashboard API.

Run from the repo root (so `engine` is importable):
    uvicorn dashboard.backend.main:app --reload --port 8000
"""
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from engine.custody import append_custody_entry, verify_custody_chain
from engine.processor import get_db, process_incident
from dashboard.backend.report import build_pdf

app = FastAPI(title="USB Forensics API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"], allow_headers=["*"],
)

_db = None


def database():
    """One shared MongoDB connection, using the same .env as the other modules."""
    global _db
    if _db is None:
        _db = get_db()
    return _db


def _clean(doc):
    if doc is not None:
        doc["_id"] = str(doc["_id"])
    return doc


def _get_or_404(db, incident_id):
    doc = db.incidents.find_one({"_id": incident_id})
    if doc is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return doc


SUMMARY_FIELDS = {"device": 1, "timestamps": 1, "risk.score": 1, "risk.level": 1,
                  "confidence.level": 1, "integrity": 1, "status": 1,
                  "artifacts.usbstor.friendly_name": 1, "files.path": 1}


@app.get("/api/health")
def health(db=Depends(database)):
    db.command("ping")
    return {"status": "ok"}


@app.get("/api/incidents")
def list_incidents(db=Depends(database)):
    cursor = db.incidents.find({}, SUMMARY_FIELDS).sort("timestamps.connect", -1).limit(200)
    out = []
    for d in cursor:
        d["file_count"] = len(d.pop("files", []))
        out.append(_clean(d))
    return out


@app.get("/api/incidents/{incident_id}")
def get_incident(incident_id: str, db=Depends(database)):
    doc = _get_or_404(db, incident_id)
    # Always show the chain status as it is *now*, not as of the last analysis,
    # so tampering in the database is visible immediately.
    doc["integrity"] = dict(doc.get("integrity") or {})
    doc["integrity"]["custody_chain_valid_now"] = verify_custody_chain(
        doc.get("custody_log", []), doc["_id"], doc.get("files", []))
    return _clean(doc)


@app.post("/api/incidents/{incident_id}/reverify")
def reverify(incident_id: str, db=Depends(database)):
    """Re-hash every file and re-run the full Module 2 analysis.
    (A sync endpoint: FastAPI runs it in a thread pool, so the server stays responsive.)"""
    _get_or_404(db, incident_id)
    inc = process_incident(incident_id, db)
    return {"status": "reverified", "risk": inc["risk"], "integrity": inc["integrity"]}


@app.get("/api/incidents/{incident_id}/report")
def export_report(incident_id: str, db=Depends(database)):
    """PDF report. Exporting is itself logged in the chain of custody."""
    doc = _get_or_404(db, incident_id)
    log = doc.get("custody_log", [])
    if log and all(e.get("entry_hash") for e in log):   # only append to a sealed chain
        append_custody_entry(log, doc["_id"], "report_exported", "investigator",
                             doc.get("files", []))
        db.incidents.update_one({"_id": doc["_id"]}, {"$set": {"custody_log": log}})
    doc["custody_log"] = log
    pdf = build_pdf(doc, chain_valid_now=verify_custody_chain(log, doc["_id"], doc.get("files", [])))
    return Response(pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{incident_id}_report.pdf"'})
