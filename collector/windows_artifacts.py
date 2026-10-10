"""Windows forensic artifact readers (Module 1).
Every reader is best-effort: on failure it returns an empty value, so one broken
artifact never stops collection. Requires Windows + Administrator rights."""
import glob
import os
import re
from datetime import datetime, timedelta, timezone

try:
    import winreg
    import win32evtlog
    import wmi
except ImportError:  # lets the module import on Mac/Linux (tests, docs)
    winreg = win32evtlog = wmi = None

try:
    import LnkParse3
except ImportError:
    LnkParse3 = None

EPOCH_1601 = datetime(1601, 1, 1, tzinfo=timezone.utc)


def _filetime_to_iso(ft):
    """Registry/NTFS FILETIME (100 ns ticks since 1601) -> ISO string."""
    try:
        return (EPOCH_1601 + timedelta(microseconds=ft // 10)).isoformat()
    except Exception:
        return None


def _serial_from_instance(instance_id):
    """USBSTOR instance '4C5300012308&0' -> '4C5300012308'.
    Devices without a real serial get a Windows-generated id like '7&2a8b3c&0';
    for those we keep the whole id minus the trailing '&0'."""
    return re.sub(r"&\d+$", "", instance_id)


# --------------------------------------------------------------- device lookup
def get_device_for_drive(drive_letter, wmi_conn=None):
    """Map a drive letter (e.g. 'E:') to the USB disk behind it using WMI."""
    device = {"drive_letter": drive_letter, "serial": None, "volume_label": None,
              "vendor_id": None, "product_id": None, "friendly_name": None,
              "is_usb": False}
    c = wmi_conn or wmi.WMI()
    try:
        for ld in c.Win32_LogicalDisk(DeviceID=drive_letter):
            device["volume_label"] = ld.VolumeName or None
            if ld.DriveType == 2:  # removable
                device["is_usb"] = True
        for disk in c.Win32_DiskDrive():
            for part in disk.associators("Win32_DiskDriveToDiskPartition"):
                for ld in part.associators("Win32_LogicalDiskToPartition"):
                    if ld.DeviceID.upper() != drive_letter.upper():
                        continue
                    pnp = disk.PNPDeviceID or ""  # USBSTOR\DISK&VEN_X&PROD_Y&REV_Z\SERIAL&0
                    if pnp.upper().startswith("USBSTOR") or disk.InterfaceType == "USB":
                        device["is_usb"] = True
                    device["serial"] = _serial_from_instance(pnp.split("\\")[-1])
                    device["friendly_name"] = disk.Caption
    except Exception as e:
        print(f"[collector] WMI device lookup failed: {e}")

    # USB VID/PID live on the parent USB device: USB\VID_0781&PID_5567\<serial>
    if device["serial"]:
        try:
            for ent in c.Win32_PnPEntity():
                dev_id = (ent.DeviceID or "").upper()
                if dev_id.startswith("USB\\VID_") and device["serial"].upper() in dev_id:
                    m = re.search(r"VID_([0-9A-F]{4})&PID_([0-9A-F]{4})", dev_id)
                    if m:
                        device["vendor_id"], device["product_id"] = m.group(1), m.group(2)
                        break
        except Exception as e:
            print(f"[collector] VID/PID lookup failed: {e}")
    return device


# --------------------------------------------------------------- USBSTOR
def read_usbstor(serial=None):
    """Return the USBSTOR entry for this serial (or the most recent one)."""
    path = r"SYSTEM\CurrentControlSet\Enum\USBSTOR"
    entries = []
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path) as root:
            for i in range(winreg.QueryInfoKey(root)[0]):
                dev_class = winreg.EnumKey(root, i)  # Disk&Ven_X&Prod_Y&Rev_Z
                with winreg.OpenKey(root, dev_class) as ck:
                    for j in range(winreg.QueryInfoKey(ck)[0]):
                        instance = winreg.EnumKey(ck, j)
                        with winreg.OpenKey(ck, instance) as ik:
                            try:
                                name = winreg.QueryValueEx(ik, "FriendlyName")[0]
                            except OSError:
                                name = dev_class
                            entries.append({
                                "friendly_name": name,
                                "device_class": dev_class,
                                "serial": _serial_from_instance(instance),
                                "reg_key_time": _filetime_to_iso(winreg.QueryInfoKey(ik)[2]),
                            })
    except Exception as e:
        print(f"[collector] USBSTOR read failed: {e}")
        return {}
    if serial:
        match = [e for e in entries if e["serial"].upper() == serial.upper()]
        return match[0] if match else {}
    return max(entries, key=lambda e: e["reg_key_time"] or "", default={})


# --------------------------------------------------------------- MountPoints2
def read_mountpoints2(drive_letter):
    """Link the drive letter to its volume GUID (MountedDevices) and confirm the
    GUID appears in the user's MountPoints2 key, i.e. this user saw the volume."""
    try:
        guid = None
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\MountedDevices") as md:
            values = {}
            for i in range(winreg.QueryInfoKey(md)[1]):
                name, data, _ = winreg.EnumValue(md, i)
                values[name] = data
        target = values.get("\\DosDevices\\" + drive_letter.upper())
        if target is not None:
            for name, data in values.items():
                m = re.match(r"\\\?\?\\Volume(\{[0-9a-fA-F-]+\})", name)
                if m and data == target:
                    guid = m.group(1)
                    break
        if not guid:
            return {}
        mp2 = r"Software\Microsoft\Windows\CurrentVersion\Explorer\MountPoints2"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, mp2 + "\\" + guid) as k:
            last_write = _filetime_to_iso(winreg.QueryInfoKey(k)[2])
        return {"guid": guid, "drive_letter": drive_letter, "last_write": last_write}
    except FileNotFoundError:
        return {}
    except Exception as e:
        print(f"[collector] MountPoints2 read failed: {e}")
        return {}


# --------------------------------------------------------------- SetupAPI
def parse_setupapi_log(serial=None, path=r"C:\Windows\INF\setupapi.dev.log", keep=5):
    """Return headers of recent device-install sections mentioning this device."""
    needle = (serial or "USBSTOR").upper()
    sections, current = [], []
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if line.startswith(">>>  [") or line.startswith(">>> ["):
                    if current:
                        sections.append(current)
                    current = [line.rstrip()]
                elif current:
                    current.append(line.rstrip())
            if current:
                sections.append(current)
    except Exception as e:
        print(f"[collector] SetupAPI read failed: {e}")
        return []
    hits = [s for s in sections if needle in "\n".join(s).upper()]
    # keep the section title + its start time line, not the whole driver dump
    return [" | ".join(l.strip() for l in s[:2]) for s in hits[-keep:]]


# --------------------------------------------------------------- Event logs
_EVENT_CHANNELS = [
    "Microsoft-Windows-Partition/Diagnostic",           # 1006: includes disk serial
    "Microsoft-Windows-Kernel-PnP/Configuration",       # 400/410/420: device configured
    "Microsoft-Windows-DriverFrameworks-UserMode/Operational",  # 2003 etc (if enabled)
    "System",
]


def read_usb_events(serial=None, minutes_back=15, max_events=20):
    """Read recent USB-related events from the modern event channels."""
    if win32evtlog is None:
        return []
    ms = minutes_back * 60 * 1000
    query = f"*[System[TimeCreated[timediff(@SystemTime) <= {ms}]]]"
    needles = [n for n in [(serial or "").upper(), "USBSTOR"] if n]
    events = []
    for channel in _EVENT_CHANNELS:
        try:
            handle = win32evtlog.EvtQuery(channel, win32evtlog.EvtQueryReverseDirection, query)
        except Exception:
            continue  # channel missing or disabled
        while len(events) < max_events:
            try:
                batch = win32evtlog.EvtNext(handle, 20)
            except Exception:
                break
            if not batch:
                break
            for ev in batch:
                xml = win32evtlog.EvtRender(ev, win32evtlog.EvtRenderEventXml)
                if not any(n in xml.upper() for n in needles):
                    continue
                eid = re.search(r"<EventID[^>]*>(\d+)</EventID>", xml)
                src = re.search(r"<Provider Name=['\"]([^'\"]+)", xml)
                when = re.search(r"SystemTime=['\"]([^'\"]+)", xml)
                events.append({"event_id": int(eid.group(1)) if eid else None,
                               "source": src.group(1) if src else channel,
                               "channel": channel,
                               "time": when.group(1) if when else None})
                if len(events) >= max_events:
                    break
    return events


# --------------------------------------------------------------- LNK files
def _find_target(obj):
    """Search LnkParse3's JSON output for the target path, whatever its layout."""
    if isinstance(obj, dict):
        for key in ("local_base_path", "relative_path", "local_base_path_unicode"):
            val = obj.get(key)
            if isinstance(val, str) and val:
                return val
        for v in obj.values():
            found = _find_target(v)
            if found:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = _find_target(v)
            if found:
                return found
    return None


def _find_key(obj, key):
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            r = _find_key(v, key)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _find_key(v, key)
            if r is not None:
                return r
    return None


def parse_recent_lnks(drive_letter):
    """Recent-items shortcuts pointing at this drive = files the user opened."""
    if LnkParse3 is None:
        print("[collector] LnkParse3 not installed; skipping LNK files")
        return []
    recent = os.path.expandvars(r"%APPDATA%\Microsoft\Windows\Recent")
    prefix = drive_letter.upper().rstrip("\\") + "\\"
    results = []
    for path in glob.glob(os.path.join(recent, "*.lnk")):
        try:
            with open(path, "rb") as f:
                info = LnkParse3.lnk_file(f).get_json()
            target = _find_target(info)
            if not target or not target.upper().startswith(prefix):
                continue
            mtime = datetime.fromtimestamp(os.path.getmtime(path), timezone.utc).isoformat()
            vol = _find_key(info, "drive_serial_number")
            results.append({"target_path": target, "accessed_time": mtime,
                            "volume_serial": str(vol) if vol is not None else None,
                            "lnk_file": os.path.basename(path)})
        except Exception:
            continue
    return sorted(results, key=lambda r: r["accessed_time"])


def collect_artifacts(device):
    """Run all five readers for one device."""
    serial, drive = device.get("serial"), device["drive_letter"]
    return {
        "usbstor": read_usbstor(serial),
        "setupapi": parse_setupapi_log(serial),
        "eventlog": read_usb_events(serial),
        "lnk_files": parse_recent_lnks(drive),
        "mountpoints2": read_mountpoints2(drive),
    }
