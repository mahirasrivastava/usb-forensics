# Module 2 — Forensic Analysis & Integrity Engine

Owner: Mahira Srivastava (240911416)

Reads an incident written by the collector (Module 1), analyzes it, and writes the results back to MongoDB for the dashboard (Module 3).

## Setup

~~~
pip install -r engine/requirements.txt
~~~

Create `.env` in the repo root (never commit it):

~~~
MONGO_URI=mongodb+srv://...
DB_NAME=usb_forensics
APPROVED_SERIALS=SERIAL1,SERIAL2
~~~

## Run (always from the repo root)

| Command | What it does |
|---|---|
| `python -m engine.watcher` | Auto-analyzes every incident with `risk.score = null` (every 3 s) |
| `python -m engine.processor <INCIDENT_ID>` | Analyzes one incident |
| `python -m engine.fake_collector` | Inserts a realistic test incident (simulates Module 1) |
| `python -m engine.load_sample` | Loads `shared/sample_incident.json` into Atlas |
| `python -m pytest -v` | Runs all unit tests |

## Integration contract

**Module 1 (collector)**
- Insert incidents in the shared schema with `risk.score: null`.
- Fill `device` (serial, volume_label, drive_letter) and `files[]` with `path`, `size`, `sha256_collected` (use `engine.hashing.sha256_of_file`), `sha256_reverified: null`, `flags: []`.
- The first custody entry may have `entry_hash: null`; the engine seals it.
- To request re-analysis, set `risk.score` back to `null`.

**Module 3 (dashboard)**
- Call `engine.processor.process_incident(incident_id)` for Re-verify (wrap with `run_in_threadpool` in FastAPI).
- Run the backend from the repo root so `engine` is importable.

**Fields written:** `files[].sha256_reverified`, `files[].flags`, `correlation_graph` (nodes have `id`, `type`, `label`), `confidence`, `risk`, `integrity.custody_chain_valid`, `custody_log`.

## How it works

| File | Technique |
|---|---|
| `hashing.py` | SHA-256 per file; re-verification flags tampering or missing files |
| `custody.py` | Hash-chained custody log (previous hash + incident ID + action + actor + timestamp + evidence digest) |
| `graph.py` | Links device, volume, files and 5 artifact sources; LNK entries linked to opened files |
| `scoring.py` | Weighted confidence and explainable rule-based risk |
| `processor.py` | Full pipeline + MongoDB read/write |
| `watcher.py` | Polls for unanalyzed incidents |

### Risk rules

| Rule | Points |
|---|---|
| Device serial not in whitelist | +25 |
| Sensitive filename | +20 per file |
| Executable file | +25 per file |
| Hash mismatch | +30 per file |
| File missing on re-verify | +10 per file |
| Transfer > 100 MB | +15 |

Capped at 100. LOW < 25, MEDIUM 25–54, HIGH 55–79, CRITICAL ≥ 80.

**Note:** re-verification must run on the machine where the USB is mounted.
