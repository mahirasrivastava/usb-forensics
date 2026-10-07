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
