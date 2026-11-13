"""Daily job: extend recurring events so occurrences always exist ~12 months ahead.

Usage (from the repo root, after `make db-migrate`):
    make events-extend
or:
    uv run python scripts/extend_event_occurrences.py

Safe to run as often as you like: it only adds occurrences that are missing, and never
duplicates, resurrects cancelled ones, or overwrites edited ones. The horizon length is
EVENT_HORIZON_MONTHS in back_end/cats/events/config.py. Schedule this once a day (cron,
a cloud scheduler, ...).
"""

from cats.database.database import SessionLocal
from cats.events.service import extend_series_occurrences


def main() -> None:
    with SessionLocal() as session:
        added = extend_series_occurrences(session)
        session.commit()
    print(f"Added {added} event occurrences")


if __name__ == "__main__":
    main()
