import wmi
import pythoncom
from datetime import datetime, timezone


def watch_usb_events():
    pythoncom.CoInitialize()

    c = wmi.WMI()
    watcher = c.Win32_VolumeChangeEvent.watch_for()

    print("USB Monitor Started...")
    print("Waiting for USB connect/disconnect...")
    print("Press Ctrl+C to stop.\n")

    while True:
        event = watcher()

        if event.EventType == 2:
            event_type = "CONNECT"
        elif event.EventType == 3:
            event_type = "DISCONNECT"
        else:
            event_type = f"UNKNOWN ({event.EventType})"

        timestamp = datetime.now(timezone.utc).isoformat()

        print(f"[{timestamp}] USB {event_type}")
        print(f"Drive: {event.DriveName}")
        print("-" * 50)


if __name__ == "__main__":
    watch_usb_events()