# Module 1 — USB Monitoring & Artifact Collector

Windows only. Run as **Administrator** from the repo root:

| Command | What it does |
|---|---|
| `python -m collector.collector` | Watches for USB plug/unplug (demo mode) |
| `python -m collector.collector --once E:` | Collects one drive that is already plugged in |

## What happens on plug-in
1. **WMI** (`Win32_VolumeChangeEvent`) reports the new drive letter. Windows only
   raises that event at the moment a volume mounts, so on startup the collector first
   sweeps any drive that is **already plugged in** and collects it once — otherwise
   starting the collector after inserting the drive would collect nothing at all.
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

While the drive stays plugged in, the drive is re-checked every 10 s. Two kinds of late
evidence are picked up:

- **New LNK records** — files on the drive that the user opened after plug-in.
- **New files** — paths that did not exist during the first walk are hashed and appended,
  and the addition is recorded as a `files_added` entry in the chain of custody.

**Hashes already collected are never recomputed.** Evidence may grow, but what was already
recorded cannot be silently rewritten — each custody entry seals the evidence as it stood at
that moment, and the newest entry must match the files exactly as they are now. The 300-file
cap applies to the incident as a whole, so once a drive hits it nothing further is added.
On unplug, `timestamps.disconnect` is set.

Every reader is best-effort: if one artifact can't be read, it's left empty and collection continues.

Windows fires several ARRIVAL events for a single insertion, so repeats within
`DEDUP_SECONDS` (3 s) are ignored. A deliberate unplug/replug takes longer than that
and is recorded as a new connection, i.e. a new incident.

## If no new incident appears
- The **watcher must be running too** (`python -m engine.watcher`), or the incident
  stays at `risk.score: null` and shows as unscored.
- `--once E:` bypasses the event system entirely and is the reliable path for a demo.
- An empty `Serial` column means the WMI lookup failed (usually missing Administrator
  rights). `read_usbstor` then falls back to the most recently written USBSTOR entry,
  which may describe a **different** device — so don't trust the registry time in that case.
- The **Registry key** time on the Artifacts tab is the USBSTOR key's last-write time,
  which Windows sets when the device is *installed*, not on every insertion. It is
  normally much older than **Connected**, and that is the point of the artifact.

Tests (any OS): `python -m pytest collector -v`
