from engine.hashing import sha256_of_file, reverify_file

def make_entry(path):
    return {"path": str(path), "sha256_collected": sha256_of_file(path),
            "sha256_reverified": None, "flags": []}

def test_unchanged_file_passes(tmp_path):
    f = tmp_path / "a.txt"; f.write_text("hello")
    assert reverify_file(make_entry(f))["flags"] == []

def test_tampered_file_flagged(tmp_path):
    f = tmp_path / "a.txt"; f.write_text("hello")
    entry = make_entry(f)
    f.write_text("hello TAMPERED")
    assert "hash_mismatch_possible_tampering" in reverify_file(entry)["flags"]

def test_missing_file_flagged(tmp_path):
    f = tmp_path / "a.txt"; f.write_text("hello")
    entry = make_entry(f)
    f.unlink()
    assert "file_missing_on_reverify" in reverify_file(entry)["flags"]

def test_no_duplicate_flags(tmp_path):
    f = tmp_path / "a.txt"; f.write_text("hello")
    entry = make_entry(f)
    f.write_text("changed")
    reverify_file(entry); reverify_file(entry)
    assert entry["flags"].count("hash_mismatch_possible_tampering") == 1


def test_unreachable_drive_is_not_reported_as_a_missing_file():
    # A Windows path re-verified on another host: the volume isn't mounted, so
    # nothing can be read. That is a verification gap, not a tampering finding.
    entry = {"path": r"F:\report.docx", "sha256_collected": "a" * 64,
             "sha256_reverified": None, "flags": []}
    reverify_file(entry)
    assert entry["flags"] == ["evidence_unreachable"]
    assert "file_missing_on_reverify" not in entry["flags"]


def test_stale_hash_is_cleared_when_the_file_cannot_be_read(tmp_path):
    f = tmp_path / "a.txt"; f.write_text("hello")
    entry = make_entry(f)
    reverify_file(entry)
    assert entry["sha256_reverified"] is not None   # first run succeeds
    f.unlink()
    reverify_file(entry)
    # Never present a measurement from an earlier run as the current one.
    assert entry["sha256_reverified"] is None
    assert "file_missing_on_reverify" in entry["flags"]


def test_flags_describe_the_latest_run_only(tmp_path):
    f = tmp_path / "a.txt"; f.write_text("hello")
    entry = make_entry(f)
    f.unlink()
    reverify_file(entry)
    assert "file_missing_on_reverify" in entry["flags"]
    f.write_text("hello")                            # evidence restored
    reverify_file(entry)
    assert entry["flags"] == []
    assert entry["sha256_reverified"] == entry["sha256_collected"]


def test_device_not_ready_oserror_is_caught(tmp_path, monkeypatch):
    # Windows raises OSError(WinError 21) for an unplugged drive, not
    # FileNotFoundError; an uncaught one kills the whole analysis.
    import engine.hashing as hashing
    f = tmp_path / "a.txt"; f.write_text("hello")
    entry = make_entry(f)
    def not_ready(_path):
        raise OSError(22, "The device is not ready")
    monkeypatch.setattr(hashing, "sha256_of_file", not_ready)
    hashing.reverify_file(entry)                     # must not raise
    assert entry["sha256_reverified"] is None


def test_evidence_root():
    from engine.hashing import evidence_root
    assert evidence_root(r"F:\dir\x.txt") == "F:\\"
    assert evidence_root("F:/dir/x.txt") == "F:\\"
