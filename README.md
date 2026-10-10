# USB Forensics & Intelligent Incident Logger

Information Security Lab mini project — Guide: Dr Raghavendra Ganiga

Detects a USB drive being plugged into a Windows machine, collects the forensic traces Windows leaves behind, and turns them into one explainable incident: which device, which files, how risky, and proof that the evidence hasn't been tampered with.

```
USB plugged in
   │
   ▼
Module 1 · collector/          WMI watcher → USBSTOR, MountPoints2, SetupAPI, Event Log, LNK
   │  inserts incident (risk.score = null) + SHA-256 of every file
   ▼
MongoDB Atlas · usb_forensics.incidents
   │
   ▼
Module 2 · engine/             re-verify hashes → custody chain → graph → confidence → risk
   │  writes analysis back
   ▼
Module 3 · dashboard/          FastAPI (backend/) + React (frontend/) + PDF report
```

## Setup (once)

1. Python 3.9+ and Node.js 18+.
2. From the repo root:
   ```bash
   python -m venv venv
   source venv/bin/activate          # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cd dashboard/frontend && npm install && cd ../..
   ```
3. Create `.env` in the repo root (never commit it):
   ```
   MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   DB_NAME=usb_forensics
   APPROVED_SERIALS=SERIAL1,SERIAL2
   ```

## Run the whole system

Every command runs from the **repo root**, each in its own terminal (venv active).

| Terminal | Command | Module |
|---|---|---|
| 1 | `python -m engine.watcher` | 2 — auto-analyzes new incidents |
| 2 | `uvicorn dashboard.backend.main:app --reload --port 8000` | 3 — API |
| 3 | `cd dashboard/frontend && npm run dev` → open http://localhost:5173 | 3 — dashboard |
| 4 | `python -m collector.collector` (Windows, **Run as administrator**) | 1 — USB watcher |

On a Mac or without a USB drive, replace terminal 4 with `python -m engine.fake_collector`.

Run all tests: `python -m pytest -v`

## Demo script (5 minutes)

1. Start terminals 1–4; open the dashboard.
2. Plug in a USB drive containing `notes.txt`, `salary_confidential.xlsx` and `tool.exe`.
3. Within a few seconds the incident appears on the dashboard as **HIGH (70)** with the reasons listed.
4. Open it: walk through the correlation graph, the 5 artifact sources and the custody log.
5. Open `salary_confidential.xlsx` from the USB — within ~10 s the collector records the LNK evidence and the graph shows an "opened" link.
6. **Tamper test:** edit `notes.txt` on the USB, click **Re-verify evidence** → file marked *tampered*, risk rises to **CRITICAL**.
7. **Custody test:** in Atlas, edit `custody_log.0.actor` → the detail page shows **Chain of custody BROKEN** within 5 s.
8. Click **Download PDF report** (the export itself is logged in the custody chain).

## Modules

| Folder | Planned owner | Details |
|---|---|---|
| `collector/` | Aarya Agarwal (240911190) | `collector/README.md` |
| `engine/` | Mahira Srivastava (240911416) | `engine/README.md` |
| `dashboard/` | Arnav Sahu (240911402) | `dashboard/README.md` |
| `shared/sample_incident.json` | all | the data contract between modules |
