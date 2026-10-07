import os

SOURCE_WEIGHTS = {"usbstor": 25, "setupapi": 20, "eventlog": 20,
                  "lnk_files": 25, "mountpoints2": 10}

SENSITIVE_PATTERNS = ["confidential", "password", "salary", "payroll", "secret"]
EXECUTABLE_EXTENSIONS = (".exe", ".bat", ".ps1", ".dll", ".vbs")
LARGE_TRANSFER_BYTES = 100 * 1024 * 1024

def _approved_serials():
    return {s.strip() for s in os.getenv("APPROVED_SERIALS", "").split(",") if s.strip()}

def compute_confidence(incident):
    a = incident.get("artifacts", {})
    matched = [s for s in SOURCE_WEIGHTS if a.get(s)]
    score = sum(SOURCE_WEIGHTS[s] for s in matched)
    level = "HIGH" if score >= 70 else "MEDIUM" if score >= 40 else "LOW"
    return {"score": score, "level": level, "sources_matched": matched}

def evaluate_risk(incident, approved_serials=None):
    approved = _approved_serials() if approved_serials is None else approved_serials
    reasons, score = [], 0

    def add(points, text):
        nonlocal score
        score += points
        reasons.append(f"(+{points}) {text}")

    if incident.get("device", {}).get("serial", "") not in approved:
        add(25, "Unauthorized device: serial not in approved whitelist")

    total = 0
    for f in incident.get("files", []):
        name = f["path"].lower()
        flags = f.get("flags", [])
        total += f.get("size", 0)
        if any(p in name for p in SENSITIVE_PATTERNS):
            add(20, f"Sensitive filename pattern: {f['path']}")
        if name.endswith(EXECUTABLE_EXTENSIONS):
            add(25, f"Executable file transferred: {f['path']}")
        if "hash_mismatch_possible_tampering" in flags:
            add(30, f"Hash mismatch on re-verification: {f['path']}")
        if "file_missing_on_reverify" in flags:
            add(10, f"File missing on re-verification: {f['path']}")

    if total > LARGE_TRANSFER_BYTES:
        add(15, f"Large transfer: {total / (1024 * 1024):.1f} MB")

    score = min(score, 100)
    level = ("CRITICAL" if score >= 80 else "HIGH" if score >= 55
             else "MEDIUM" if score >= 25 else "LOW")
    return {"score": score, "level": level, "justification": reasons}
