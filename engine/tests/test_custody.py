from engine.custody import (append_custody_entry, seal_unhashed_entries,
                            verify_custody_chain)

INC = "INC-TEST-0001"
FILES = [{"path": "a.txt", "sha256_collected": "abc123"}]

def make_chain():
    log = [{"action": "collected", "actor": "system",
            "timestamp": "2026-09-12T10:15:05Z", "entry_hash": None, "prev_hash": None}]
    seal_unhashed_entries(log, INC, FILES)
    append_custody_entry(log, INC, "analyzed", "engine", FILES)
    append_custody_entry(log, INC, "viewed", "investigator", FILES)
    return log

def test_intact_chain_verifies():
    assert verify_custody_chain(make_chain(), INC, FILES)

def test_edited_entry_detected():
    log = make_chain(); log[0]["actor"] = "attacker"
    assert not verify_custody_chain(log, INC, FILES)

def test_deleted_entry_detected():
    log = make_chain(); del log[1]
    assert not verify_custody_chain(log, INC, FILES)

def test_changed_evidence_detected():
    log = make_chain()
    tampered = [{"path": "a.txt", "sha256_collected": "evil999"}]
    assert not verify_custody_chain(log, INC, tampered)

def test_wrong_incident_detected():
    assert not verify_custody_chain(make_chain(), "INC-OTHER", FILES)
