"""Drives inserted before the collector starts fire no volume-change event, so
startup sweeps them. The WMI call itself is Windows-only and stubbed here."""
import sys
import types

from collector import collector


class FakeDisk:
    def __init__(self, device_id, size):
        self.DeviceID, self.Size = device_id, size


def fake_wmi(monkeypatch, disks=None, error=None):
    module = types.ModuleType("wmi")

    class Conn:
        def Win32_LogicalDisk(self, DriveType=None):
            assert DriveType == 2, "only removable volumes should be enumerated"
            return disks

    def WMI(*args, **kwargs):
        if error:
            raise error
        return Conn()

    module.WMI = WMI
    monkeypatch.setitem(sys.modules, "wmi", module)


def test_lists_mounted_removable_drives(monkeypatch):
    fake_wmi(monkeypatch, [FakeDisk("e:", 8_000_000_000), FakeDisk("F:", 16_000_000_000)])
    assert collector.list_removable_drives() == ["E:", "F:"]


def test_skips_card_readers_with_no_media(monkeypatch):
    # DriveType 2 also covers empty card readers, which report no Size.
    fake_wmi(monkeypatch, [FakeDisk("E:", 8_000_000_000), FakeDisk("G:", None),
                           FakeDisk(None, 123)])
    assert collector.list_removable_drives() == ["E:"]


def test_wmi_failure_does_not_stop_the_collector(monkeypatch):
    fake_wmi(monkeypatch, error=RuntimeError("RPC server unavailable"))
    assert collector.list_removable_drives() == []


def test_sweep_collects_each_drive_and_tracks_it(monkeypatch):
    fake_wmi(monkeypatch, [FakeDisk("E:", 1), FakeDisk("F:", 1)])
    collected = []
    monkeypatch.setattr(collector, "collect_drive",
                        lambda db, drive: collected.append(drive) or f"INC-{drive[0]}")
    connected, last_seen = {}, {}
    collector.collect_already_plugged(None, connected, last_seen)
    assert collected == ["E:", "F:"]
    assert connected == {"E:": "INC-E", "F:": "INC-F"}   # LNK refresh can find them
    assert set(last_seen) == {"E:", "F:"}                # and no duplicate insert


def test_sweep_ignores_drives_that_are_not_usb(monkeypatch):
    fake_wmi(monkeypatch, [FakeDisk("E:", 1)])
    monkeypatch.setattr(collector, "collect_drive", lambda db, drive: None)
    connected = {}
    collector.collect_already_plugged(None, connected, {})
    assert connected == {}


def test_dedup_window_still_allows_a_deliberate_replug():
    # Windows fires several ARRIVAL events per insertion, milliseconds apart;
    # an intentional unplug/replug takes seconds and must count as a new connection.
    assert collector.DEDUP_SECONDS == 3
