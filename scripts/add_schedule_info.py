"""Import schedule info into a schedule table.

Usage (from the repo root, after `make db-migrate` has created the tables):
    uv run python scripts/add_schedule_info.py
"""

import json

from cats.database.database import SessionLocal


def main() -> None:
    # print("Creating user schedule table")
    # UserSchedule.__table__.create(bind=engine, checkfirst=True)

    with SessionLocal() as session, open("data/schedule_info.json", "r") as file:
        # Adds class information stored in json
        classes = json.load(file)
        print(f"Found {len(classes)} classes in json file")


if __name__ == "__main__":
    main()
