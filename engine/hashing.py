import hashlib

def sha256_of_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def _add_flag(entry, flag):
    entry.setdefault("flags", [])
    if flag not in entry["flags"]:
        entry["flags"].append(flag)

def reverify_file(entry):
    try:
        current = sha256_of_file(entry["path"])
    except FileNotFoundError:
        _add_flag(entry, "file_missing_on_reverify")
        return entry
    entry["sha256_reverified"] = current
    if current != entry["sha256_collected"]:
        _add_flag(entry, "hash_mismatch_possible_tampering")
    return entry
