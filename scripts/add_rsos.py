"""
Adds RSO objects scraped from the engage website to a
RSO table in the database.

Usage (from the repo root, with the db container running via Docker using "make db-up")
"""

import os
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1] / "back_end" / "app"
sys.path.insert(0, str(APP_DIR))

os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg2://cats:cats-devonly@localhost:5432/cats"
)
import json

from cats.database.database import SessionLocal
from cats.schemas.rso import RSOBase
from pydantic import ValidationError

os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg2://cats:cats-devonly@localhost:5432/cats"
)


def printRSO(values):
    print(f"{values['id']} {values['email']}")


def main():
    # RSO.__table__.create(bind=engine, checkfirst=True)
    # print("Created RSO table")
    id = 0
    email = ""
    with SessionLocal() as session:
        with open("rso_info.json") as file:
            json_data = json.load(file)
            for values in json_data:
                # pydantic magic
                rso_obj = None
                try:
                    rso_obj = RSOBase(
                        id=values["id"],
                        name=values["name"],
                        description=values["description"],
                        link=values["link"],
                        email=values["email"],
                        phone=values["phone"],
                        location=values["location"],
                    )
                    id = rso_obj.id
                    email = rso_obj.email
                except ValidationError:
                    print(f"Couldnt validate email for id {id} with email {email}")


if __name__ == "__main__":
    main()
