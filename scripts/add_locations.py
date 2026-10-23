"""Seed the database with a few campus locations.

Usage (from the repo root, with the db container running via `make db-up`):
    uv run python scripts/add_locations.py
"""

import os
import sys
from pathlib import Path

# The backend imports modules relative to back_end/app (e.g. `from database.database import Base`),
# so put that directory on the path before importing anything from it.
APP_DIR = Path(__file__).resolve().parents[1] / "back_end" / "app"
sys.path.insert(0, str(APP_DIR))

# database.py reads DATABASE_URL at import time. When running from the host, the db container
# is reachable on localhost rather than the `db` hostname used inside docker compose.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg2://cats:cats-devonly@localhost:5432/cats"
)

from geoalchemy2 import WKTElement  # noqa: E402
from sqlalchemy import select  # noqa: E402

from database.database import SessionLocal, engine  # noqa: E402
from database.models.location import Location  # noqa: E402

# (name, longitude, latitude) -- note WKT/PostGIS uses longitude first.
LOCATIONS = [
    ("Library", -84.123456, 43.123456),
    ("Student Union", -84.124000, 43.124000),
]


def main() -> None:
    # Create the locations table if it doesn't exist yet (no-op otherwise).
    Location.__table__.create(bind=engine, checkfirst=True)

    with SessionLocal() as session:
        for name, lon, lat in LOCATIONS:
            exists = session.scalar(select(Location).where(Location.name == name))
            if exists:
                print(f"Skipping {name!r}: already exists")
                continue

            session.add(
                Location(
                    name=name,
                    position=WKTElement(f"POINT({lon} {lat})", srid=4326),
                )
            )
            print(f"Adding {name!r}")

        session.commit()


if __name__ == "__main__":
    main()
