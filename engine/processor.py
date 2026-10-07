import os, sys
import certifi
from dotenv import load_dotenv
from pymongo import MongoClient

from engine.hashing import reverify_file
from engine.custody import (seal_unhashed_entries, verify_custody_chain,
                            append_custody_entry)
from engine.graph import build_correlation_graph
from engine.scoring import compute_confidence, evaluate_risk

UPDATED_FIELDS = ["files", "correlation_graph", "confidence", "risk",
                  "custody_log", "integrity"]

def analyze_incident(incident):
    """Pure analysis: no database. Mutates and returns the incident."""
    inc_id = incident["_id"]
    files = [reverify_file(f) for f in incident.get("files", [])]
    log = incident.get("custody_log", [])

    seal_unhashed_entries(log, inc_id, files)
    chain_ok = verify_custody_chain(log, inc_id, files)

    incident["files"] = files
    incident["correlation_graph"] = build_correlation_graph(incident)
    incident["confidence"] = compute_confidence(incident)
    incident["risk"] = evaluate_risk(incident)
    incident["integrity"] = {"custody_chain_valid": chain_ok}
    incident["custody_log"] = append_custody_entry(log, inc_id, "analyzed", "engine", files)
    return incident

def get_db():
    load_dotenv()
    client = MongoClient(os.environ["MONGO_URI"], tlsCAFile=certifi.where())
    return client[os.getenv("DB_NAME", "usb_forensics")]

def process_incident(incident_id, db=None):
    if db is None:
        db = get_db()
    incident = db.incidents.find_one({"_id": incident_id})
    if incident is None:
        raise ValueError(f"Incident {incident_id} not found")
    analyze_incident(incident)
    db.incidents.update_one({"_id": incident_id},
                            {"$set": {k: incident[k] for k in UPDATED_FIELDS}})
    print(f"Processed {incident_id}: risk={incident['risk']['level']} "
          f"({incident['risk']['score']}), chain_valid={incident['integrity']['custody_chain_valid']}")
    return incident

if __name__ == "__main__":
    process_incident(sys.argv[1] if len(sys.argv) > 1 else "INC-20260912-0001")
