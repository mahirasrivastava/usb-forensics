"""Load shared/sample_incident.json into Atlas (resets it if it exists)."""
import json
from pathlib import Path
from engine.processor import get_db

SAMPLE = Path(__file__).resolve().parent.parent / "shared" / "sample_incident.json"

if __name__ == "__main__":
    doc = json.loads(SAMPLE.read_text())
    get_db().incidents.replace_one({"_id": doc["_id"]}, doc, upsert=True)
    print(f"Loaded {doc['_id']} into MongoDB")
