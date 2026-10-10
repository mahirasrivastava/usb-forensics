# Module 1 — USB Monitoring & Artifact Collector

Windows only. Run as **Administrator** from the repo root:

| Command | What it does |
|---|---|
| `python -m collector.collector` | Watches for USB plug/unplug (demo mode) |
| `python -m collector.collector --once E:` | Collects one drive that is already plugged in |

## What happens on plug-in
1. **WMI** (`Win32_VolumeChangeEvent`) reports the new drive letter.
2. The drive letter is mapped to its USB disk (`Win32_DiskDrive` → partition → logical disk) to get the **serial**, volume label and **VID/PID**.
3. Five artifacts are read, each matched to this device:

| Artifact | Source | What it proves |
|---|---|---|
| USBSTOR | `HKLM\SYSTEM\CurrentControlSet\Enum\USBSTOR` | Device identity + first-seen key time |
| MountPoints2 | `HKLM\SYSTEM\MountedDevices` + `HKCU\...\Explorer\MountPoints2` | Drive letter ↔ volume GUID, seen by this user |
| SetupAPI | `C:\Windows\INF\setupapi.dev.log` | Driver install for the device |
| Event Log | Partition/Diagnostic, Kernel-PnP/Configuration, DriverFrameworks, System | Connection events |
| LNK files | `%APPDATA%\Microsoft\Windows\Recent\*.lnk` | Files on the drive the user actually opened |

4. Every file on the drive is hashed with SHA-256 (`engine.hashing`), up to 300 files and 500 MB each.
5. The incident is inserted with `risk.score: null`; Module 2 analyzes it automatically.

While the drive stays plugged in, LNK files are re-checked every 10 s; new "opened file" evidence is added and the incident is re-queued for analysis. File hashes are never re-collected, because that would change the evidence the custody chain protects. On unplug, `timestamps.disconnect` is set.

Every reader is best-effort: if one artifact can't be read, it's left empty and collection continues.

Tests (any OS): `python -m pytest collector -v`
