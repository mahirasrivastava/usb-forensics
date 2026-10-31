"""Auto-analyze new incidents. Run alongside the collector:  python -m engine.watcher"""
import time
from pymongo.errors import PyMongoError
from engine.processor import get_db, process_incident

POLL_SECONDS = 3

def pending_ids(db):
    # risk.score == None also matches documents where the field is missing
    return [d["_id"] for d in db.incidents.find({"risk.score": None}, {"_id": 1})]

def run():
    db = get_db()
    failed = set()
    print(f"Watcher running — checking every {POLL_SECONDS}s (Ctrl+C to stop)")
    while True:
        try:
            ids = pending_ids(db)
        except PyMongoError as e:
            # Atlas drops idle connections; the driver reconnects on a later poll,
            # so keep waiting instead of letting the watcher die.
            print(f"Database unreachable ({type(e).__name__}); retrying in {POLL_SECONDS}s")
            time.sleep(POLL_SECONDS)
            continue
        for inc_id in ids:
            if inc_id in failed:
                continue
            try:
                print(f"New incident detected: {inc_id}")
                process_incident(inc_id, db)
            except PyMongoError as e:
                # A connection blip is not a broken document: leave it pending
                # and re-poll rather than blacklisting it.
                print(f"Database error on {inc_id} ({type(e).__name__}); will retry")
                break
            except Exception as e:
                failed.add(inc_id)          # don't retry a broken doc forever
                print(f"Failed on {inc_id}: {e}")
        time.sleep(POLL_SECONDS)

if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("\nWatcher stopped")
