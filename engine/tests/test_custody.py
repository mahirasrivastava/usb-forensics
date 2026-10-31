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


def test_evidence_may_grow_when_the_addition_is_recorded():
    """Files created on the drive after collection are appended with their own
    custody entry; the chain stays valid because the newest entry seals them."""
    from engine.custody import append_custody_entry, verify_custody_chain
    files = [{"path": "E:/a.txt", "sha256_collected": "a" * 64}]
    log = append_custody_entry([], "INC-1", "collected", "collector", files)
    assert verify_custody_chain(log, "INC-1", files)

    grown = files + [{"path": "E:/new.txt", "sha256_collected": "b" * 64}]
    # Appending the file WITHOUT recording it is still rejected.
    assert not verify_custody_chain(log, "INC-1", grown)
    # Recording the addition makes the newest entry describe the evidence again.
    append_custody_entry(log, "INC-1", "files_added", "collector", grown)
    assert verify_custody_chain(log, "INC-1", grown)


def test_editing_a_collected_hash_is_still_caught():
    from engine.custody import append_custody_entry, verify_custody_chain
    files = [{"path": "E:/a.txt", "sha256_collected": "a" * 64}]
    log = append_custody_entry([], "INC-1", "collected", "collector", files)
    tampered = [dict(files[0], sha256_collected="c" * 64)]
    assert not verify_custody_chain(log, "INC-1", tampered)


def test_dropping_a_file_from_the_manifest_is_still_caught():
    from engine.custody import append_custody_entry, verify_custody_chain
    files = [{"path": "E:/a.txt", "sha256_collected": "a" * 64},
             {"path": "E:/b.txt", "sha256_collected": "b" * 64}]
    log = append_custody_entry([], "INC-1", "collected", "collector", files)
    assert not verify_custody_chain(log, "INC-1", files[:1])
