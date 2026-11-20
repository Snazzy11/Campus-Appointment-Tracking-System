"""Load the sample schedule in data/schedule_info.json into the calendar tables.

Usage (from the repo root): `make seed-schedule`, or after `make db-migrate`:
    uv run python scripts/add_schedule_info.py [--start YYYY-MM-DD]

Every entry becomes an event series owned by user 1, which is the user the calendar
screen currently asks for. If there is no user 1 yet, a test user is created.

Running it again is safe: an entry is skipped when its owner already has an event with
the same title and start time.
"""

import argparse
import datetime as dt
import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from cats.database.database import SessionLocal
from cats.database.models.event import EventSeries, EventType
from cats.database.models.user.user import User
from cats.events.recurrence import Weekday, build_rrule
from cats.events.service import create_series

DATA_FILE = "data/schedule_info.json"
TIMEZONE = "America/Detroit"  # CMU's timezone
OWNER_ID = 1  # matches the hard-coded user in front_end/src/features/calendar/CalendarScreen.tsx
TEST_USER_EMAIL = "test.user@cmich.edu"

WEEKDAY_CODES: dict[str, Weekday] = {
    "Monday": "MO",
    "Tuesday": "TU",
    "Wednesday": "WE",
    "Thursday": "TH",
    "Friday": "FR",
    "Saturday": "SA",
    "Sunday": "SU",
}
# date.weekday() numbers, Monday = 0
WEEKDAY_NUMBERS = {name: number for number, name in enumerate(WEEKDAY_CODES)}


def semester_start(today: dt.date) -> dt.date:
    """Roughly when the current semester began: Jan 1, May 1, or Aug 1."""
    if today.month < 5:
        return dt.date(today.year, 1, 1)
    if today.month < 8:
        return dt.date(today.year, 5, 1)
    return dt.date(today.year, 8, 1)


def first_meeting(start: dt.date, days: list[str]) -> dt.date:
    """The first date on or after `start` that falls on one of `days`."""
    wanted = {WEEKDAY_NUMBERS[day] for day in days}
    date = start
    while date.weekday() not in wanted:
        date += dt.timedelta(days=1)
    return date


def get_owner(session: Session) -> User:
    """User 1 if it exists; otherwise the test user, created if needed."""
    user = session.get(User, OWNER_ID)
    if user is not None:
        return user
    user = session.scalar(select(User).where(User.email == TEST_USER_EMAIL))
    if user is None:
        user = User(email=TEST_USER_EMAIL, first_name="Test", last_name="User")
        session.add(user)
        session.flush()
        print(f"Created test user {TEST_USER_EMAIL} with id {user.id}")
    if user.id != OWNER_ID:
        print(
            f"Note: the events belong to user {user.id}, but the calendar screen asks "
            f"for user {OWNER_ID}, so they won't show up there."
        )
    return user


def add_entry(
    session: Session, owner: User, entry: dict[str, Any], start: dt.date
) -> bool:
    """Create a series for one JSON entry. Returns False if it already exists."""
    start_time = dt.time.fromisoformat(entry["start_time"])
    exists = session.scalar(
        select(EventSeries.id).where(
            EventSeries.owner_id == owner.id,
            EventSeries.title == entry["title"],
            EventSeries.start_time == start_time,
        )
    )
    if exists is not None:
        return False

    days = entry["days_of_week"]
    event_type = entry["tag"]
    # Only class details have a field for the person; other types would reject it.
    details = {}
    if event_type == EventType.CLASS.value and entry.get("with_who"):
        details["instructor_name"] = entry["with_who"]
    rrule = None
    if entry["is_repeating"]:
        rrule = build_rrule(
            freq="WEEKLY", by_weekday=[WEEKDAY_CODES[day] for day in days]
        )

    create_series(
        session,
        event_type=event_type,
        title=entry["title"],
        owner_id=owner.id,
        timezone=TIMEZONE,
        start_date=first_meeting(start, days),
        start_time=start_time,
        duration_min=entry["length"],
        location=entry.get("location") or None,
        details=details,
        rrule=rrule,
    )
    return True


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Load the sample schedule into the database."
    )
    parser.add_argument(
        "--start",
        type=dt.date.fromisoformat,
        default=semester_start(dt.date.today()),
        help="first day the events can happen (default: start of this semester)",
    )
    args = parser.parse_args()

    with open(DATA_FILE) as file:
        entries = json.load(file)
    print(f"Found {len(entries)} events in {DATA_FILE}")

    with SessionLocal() as session:
        owner = get_owner(session)
        added = 0
        for entry in entries:
            if add_entry(session, owner, entry, args.start):
                added += 1
            else:
                print(f"Skipping {entry['title']!r}: already in the database")
        owner_id = owner.id  # read before commit; the session expires objects after it
        session.commit()
    print(f"Added {added} events for user {owner_id}, starting {args.start}")


if __name__ == "__main__":
    main()
