"""A dropped Atlas connection must not kill the watcher or blacklist an incident."""
import pytest
from pymongo.errors import AutoReconnect

from engine import watcher


class Stop(Exception):
    """Breaks the watcher's infinite loop from inside time.sleep."""


class ScriptedIncidents:
    """Each find() returns the next scripted result, or raises it."""

    def __init__(self, script):
        self.script, self.calls = script, 0

    def find(self, *args, **kwargs):
        step = self.script[min(self.calls, len(self.script) - 1)]
        self.calls += 1
        if isinstance(step, Exception):
            raise step
        return [{"_id": inc_id} for inc_id in step]


def run_watcher(monkeypatch, script, process, ticks):
    db = type("DB", (), {"incidents": ScriptedIncidents(script)})()
    counter = {"n": 0}

    def sleep(_seconds):
        counter["n"] += 1
        if counter["n"] >= ticks:
            raise Stop

    monkeypatch.setattr(watcher, "get_db", lambda: db)
    monkeypatch.setattr(watcher, "process_incident", process)
    monkeypatch.setattr(watcher.time, "sleep", sleep)
    with pytest.raises(Stop):
        watcher.run()


def test_survives_a_dropped_connection_while_polling(monkeypatch):
    processed = []
    run_watcher(monkeypatch,
                [AutoReconnect("connection pool paused"), ["INC-A"], []],
                lambda inc_id, db: processed.append(inc_id), ticks=3)
    assert processed == ["INC-A"]


def test_connection_error_while_analyzing_leaves_incident_pending(monkeypatch):
    attempts = []

    def flaky(inc_id, db):
        attempts.append(inc_id)
        if len(attempts) == 1:
            raise AutoReconnect("socket closed")

    run_watcher(monkeypatch, [["INC-B"], ["INC-B"], []], flaky, ticks=3)
    assert attempts == ["INC-B", "INC-B"]   # retried, not written off


def test_a_genuinely_broken_incident_is_still_tried_only_once(monkeypatch):
    attempts = []

    def broken(inc_id, db):
        attempts.append(inc_id)
        raise ValueError("malformed custody_log")

    run_watcher(monkeypatch, [["INC-C"], ["INC-C"], ["INC-C"]], broken, ticks=3)
    assert attempts == ["INC-C"]
