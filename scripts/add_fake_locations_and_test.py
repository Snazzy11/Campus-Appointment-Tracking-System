"""Seed the database with a few campus locations, then print the distance between each pair.

Usage (from the repo root, after `make db-migrate` has created the tables):
    uv run python scripts/add_fake_locations_and_test.py
"""

from cats.database.database import SessionLocal
from cats.database.models.location import Location
from geoalchemy2 import Geography, WKTElement
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session, aliased

# (name, longitude, latitude) -- note WKT/PostGIS uses longitude first.
LOCATIONS = [
    ("Library", -84.123456, 43.123456),
    ("Student Union", -84.124000, 43.124000),
]


def main() -> None:
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

        print_distances(session)


def print_distances(session: Session) -> None:
    """Print the distance between every pair of locations, computed by PostGIS."""
    a = aliased(Location)
    b = aliased(Location)
    # Casting to geography makes ST_Distance return meters on the earth's surface instead of degrees.
    distance = func.ST_Distance(
        cast(a.position, Geography), cast(b.position, Geography)
    )
    rows = session.execute(
        select(a.name, b.name, distance).where(a.id < b.id).order_by(a.id, b.id)
    )

    print("\nDistances:")
    for name_a, name_b, meters in rows:
        print(f"  {name_a} <-> {name_b}: {meters:.1f} m")


if __name__ == "__main__":
    main()
