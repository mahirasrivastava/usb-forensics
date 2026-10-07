def build_correlation_graph(incident):
    nodes, edges = {}, []

    def node(nid, ntype, label):
        nodes.setdefault(nid, {"id": nid, "type": ntype, "label": label})

    def edge(src, dst, relation):
        edges.append({"source": src, "target": dst, "relation": relation})

    dev = incident.get("device", {})
    a = incident.get("artifacts", {})

    dev_id = "device:" + (dev.get("serial") or "unknown")
    node(dev_id, "device", dev.get("serial") or "Unknown device")
    vol_id = "volume:" + (dev.get("drive_letter") or dev.get("volume_label") or "unknown")
    node(vol_id, "volume", dev.get("volume_label") or dev.get("drive_letter") or "Unknown volume")
    edge(dev_id, vol_id, "mounted_as")

    # Artifacts that corroborate the device / volume
    for key, label, target, rel in [
        ("usbstor", "USBSTOR registry", dev_id, "identifies"),
        ("setupapi", "SetupAPI log", dev_id, "installed"),
        ("eventlog", "Windows Event Log", dev_id, "logged"),
        ("mountpoints2", "MountPoints2 registry", vol_id, "maps_drive"),
    ]:
        if a.get(key):
            node("artifact:" + key, "artifact", label)
            edge("artifact:" + key, target, rel)

    for f in incident.get("files", []):
        fid = "file:" + f["path"].lower()
        node(fid, "file", f["path"])
        edge(vol_id, fid, "contains")

    # LNK files prove a file was actually opened
    for i, lnk in enumerate(a.get("lnk_files", [])):
        target = lnk.get("target_path") or ""
        if not target:
            continue
        lid = f"lnk:{i}"
        node(lid, "lnk", "LNK: " + target)
        fid = "file:" + target.lower()
        edge(lid, fid if fid in nodes else vol_id, "accessed" if fid in nodes else "references")

    return {"nodes": list(nodes.values()), "edges": edges}
