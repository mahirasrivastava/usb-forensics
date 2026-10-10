from engine.custody import append_custody_entry, seal_unhashed_entries, verify_custody_chain

def test_null_evidence_digest_is_sealed():
    files = [{"path": "a.txt", "sha256_collected": "abc123"}]
    log = [{"action": "collected", "actor": "system", "timestamp": "t",
            "evidence_digest": None, "entry_hash": None, "prev_hash": None}]
    seal_unhashed_entries(log, "INC-1", files)
    assert verify_custody_chain(log, "INC-1", files)
