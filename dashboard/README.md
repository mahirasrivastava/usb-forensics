# Module 3 — Investigator Dashboard & Reporting

## Run (from the repo root)
```bash
uvicorn dashboard.backend.main:app --reload --port 8000     # API
cd dashboard/frontend && npm install && npm run dev          # UI → http://localhost:5173
```
The Vite dev server forwards `/api` to port 8000, so no CORS setup is needed.

## API
| Endpoint | Purpose |
|---|---|
| `GET /api/incidents` | Incident summaries, newest first |
| `GET /api/incidents/{id}` | Full incident, plus `integrity.custody_chain_valid_now` (re-checked on every request, so database tampering shows immediately) |
| `POST /api/incidents/{id}/reverify` | Re-hashes the files and re-runs the Module 2 analysis |
| `GET /api/incidents/{id}/report` | PDF report; the export is recorded as a `report_exported` custody entry |
| `GET /api/health` | Database ping |

## UI
- **Incidents list:** live-refreshing table with risk, confidence and custody status, plus summary counts.
- **Incident detail:** custody-chain banner, risk reasons with points, device details, which of the 5 artifact sources were found, interactive correlation graph (React Flow), files with collected vs re-verified hashes, the full hash-linked custody log, and the raw artifacts.

Tests: `python -m pytest dashboard -v`
