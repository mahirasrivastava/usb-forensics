import winreg
import re
import win32evtlog
import os
from LnkParse3 import lnk_file


def read_usbstor():
    devices = []

    key_path = r"SYSTEM\CurrentControlSet\Enum\USBSTOR"

    try:
        with winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            key_path
        ) as key:

            number_of_devices = winreg.QueryInfoKey(key)[0]

            for i in range(number_of_devices):

                device_class = winreg.EnumKey(key, i)

                with winreg.OpenKey(
                    key,
                    device_class
                ) as class_key:

                    number_of_serials = winreg.QueryInfoKey(class_key)[0]

                    for j in range(number_of_serials):

                        serial = winreg.EnumKey(class_key, j)

                        with winreg.OpenKey(
                            class_key,
                            serial
                        ) as serial_key:

                            try:
                                friendly_name, _ = winreg.QueryValueEx(
                                    serial_key,
                                    "FriendlyName"
                                )
                            except FileNotFoundError:
                                friendly_name = "Unknown"

                            devices.append({
                                "device_class": device_class,
                                "serial": serial,
                                "friendly_name": friendly_name
                            })

    except FileNotFoundError:
        print("USBSTOR registry key not found.")

    return devices

def read_mountpoints2():
    entries = []

    key_path = r"Software\Microsoft\Windows\CurrentVersion\Explorer\MountPoints2"

    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            key_path
        ) as key:

            number_of_entries = winreg.QueryInfoKey(key)[0]

            for i in range(number_of_entries):
                entry = winreg.EnumKey(key, i)
                entries.append(entry)

    except FileNotFoundError:
        print("MountPoints2 registry key not found.")

    return entries

def parse_setupapi_log(path=r"C:\Windows\inf\setupapi.dev.log"):
    try:
        with open(path, "r", errors="ignore") as f:
            content = f.read()

        # Split the SetupAPI log into sections beginning with >>>
        blocks = re.split(r"(?m)(?=^>>>)", content)

        # Keep only sections containing USBSTOR
        relevant = [
            block.strip()
            for block in blocks
            if "USBSTOR" in block
        ]

        # Return the most recent 20 matching sections
        return relevant[-20:]

    except FileNotFoundError:
        print("SetupAPI log not found.")
        return []



def read_eventlog():
    events = []

    server = None
    log_type = "Security"

    try:
        handle = win32evtlog.OpenEventLog(
            server,
            log_type
        )

        flags = (
            win32evtlog.EVENTLOG_BACKWARDS_READ
            | win32evtlog.EVENTLOG_SEQUENTIAL_READ
        )

        while True:

            records = win32evtlog.ReadEventLog(
                handle,
                flags,
                0
            )

            if not records:
                break

            for record in records:

                if record.EventID in (6416, 4663):

                    message = ""

                    if record.StringInserts:
                        message = " | ".join(
                            str(x)
                            for x in record.StringInserts
                        )

                    events.append({
                        "event_id": record.EventID,
                        "timestamp": str(record.TimeGenerated),
                        "source": record.SourceName,
                        "message": message
                    })

        win32evtlog.CloseEventLog(handle)

    except Exception as e:
        print(f"Event Log error: {e}")

    return events

def read_recent_lnk():
    entries = []

    recent_path = os.path.join(
        os.environ["APPDATA"],
        r"Microsoft\Windows\Recent"
    )

    if not os.path.exists(recent_path):
        return entries

    for filename in os.listdir(recent_path):
        if not filename.lower().endswith(".lnk"):
            continue

        path = os.path.join(recent_path, filename)

        try:
            with open(path, "rb") as f:
                lnk = lnk_file(f)
                data = lnk.get_json()

            header = data.get("header", {})
            link_data = data.get("data", {})
            link_info = data.get("link_info", {})
            extra = data.get("extra", {})

            entries.append({
                "shortcut": filename,
                "target": link_data.get("relative_path"),
                "working_directory": link_data.get("working_directory"),
                "local_base_path": link_info.get("local_base_path"),
                "creation_time": header.get("creation_time"),
                "modified_time": header.get("modified_time"),
                "machine_identifier": extra.get(
                    "DISTRIBUTED_LINK_TRACKER_BLOCK", {}
                ).get("machine_identifier")
            })

        except Exception as e:
            print(f"Could not parse {filename}: {e}")

    return entries

if __name__ == "__main__":

    # --------------------------------------------------------
    # USBSTOR
    # --------------------------------------------------------

    devices = read_usbstor()

    print("\nUSBSTOR DEVICES")
    print("=" * 60)

    for device in devices:
        print(f"Device Class : {device['device_class']}")
        print(f"Serial       : {device['serial']}")
        print(f"Friendly Name: {device['friendly_name']}")
        print("-" * 60)


    # --------------------------------------------------------
    # MountPoints2
    # --------------------------------------------------------

    mountpoints = read_mountpoints2()

    print("\nMOUNTPOINTS2")
    print("=" * 60)

    for mountpoint in mountpoints:
        print(mountpoint)


    # --------------------------------------------------------
    # SetupAPI
    # --------------------------------------------------------

    setupapi_entries = parse_setupapi_log()

    print("\nSETUPAPI USBSTOR ENTRIES")
    print("=" * 60)

    print(f"Found {len(setupapi_entries)} entries.")

    for i, entry in enumerate(
        setupapi_entries,
        start=1
    ):

        print(f"\nEntry {i}:")

        position = entry.find("USBSTOR")

        if position != -1:

            start = max(
                0,
                position - 250
            )

            end = min(
                len(entry),
                position + 750
            )

            print(entry[start:end])

        else:
            print("USBSTOR not found in this entry.")

        print("-" * 60)


    # --------------------------------------------------------
    # Security Event Log
    # --------------------------------------------------------

    eventlog_entries = read_eventlog()

    print("\nSECURITY EVENT LOG")
    print("=" * 60)

    print(
        f"Found {len(eventlog_entries)} relevant events."
    )

    for event in eventlog_entries[:20]:

        print(
            f"Event ID  : {event['event_id']}"
        )

        print(
            f"Timestamp : {event['timestamp']}"
        )

        print(
            f"Source    : {event['source']}"
        )

        print(
            f"Details   : {event['message']}"
        )

        print("-" * 60)

        lnk_entries = read_recent_lnk()

    print("\nRECENT LNK FILES")
    print("=" * 60)
    print(f"Found {len(lnk_entries)} shortcut files.")

    for entry in lnk_entries[:20]:
        print(f"Shortcut           : {entry['shortcut']}")
        print(f"Target             : {entry['target']}")
        print(f"Working Directory  : {entry['working_directory']}")
        print(f"Local Target Path  : {entry['local_base_path']}")
        print(f"Creation Time      : {entry['creation_time']}")
        print(f"Modified Time      : {entry['modified_time']}")
        print(f"Machine Identifier : {entry['machine_identifier']}")
        print("-" * 60)
