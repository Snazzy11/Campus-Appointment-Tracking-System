"""Daily job: create the upcoming occurrences for recurring events.

Run it with `make events-extend`, or `uv run python scripts/extend_event_occurrences.py`.
It only adds occurrences that are missing, so running it more than once a day is
harmless. Nothing in the repo schedules it yet; use cron or a cloud scheduler. How far
ahead it looks is EVENT_HORIZON_MONTHS in back_end/cats/events/config.py.
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
