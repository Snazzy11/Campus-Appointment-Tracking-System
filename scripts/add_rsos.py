"""
Adds RSO objects scraped from the engage website to a
RSO table in the database.

Usage (from the repo root, with the db container running via Docker using "make db-up")

Scrape the data first from the website, then run this script to properly update the RSO table
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

from cats.database.database import SessionLocal, engine
from cats.schemas.rso import RSOBase
from cats.database.models.rso import RSO
from pydantic import ValidationError
from sqlalchemy import cast, func, select
from sqlalchemy.exc import DataError
os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg2://cats:cats-devonly@localhost:5432/cats"
)


def printRSO(values):
    print(f"{values['id']} {values['email']}")


def main():
    RSO.__table__.create(bind=engine, checkfirst=True)
    print("Created RSO table")
    
    id = 0
    email = ""
    
    with SessionLocal() as session:
        with open("data/rso_info.json") as file:
            json_data = json.load(file)
            seen_names = set(session.scalars(select(RSO.name)))
            for values in json_data:
                # pydantic magic
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
                    
                    if rso_obj.name in seen_names:
                        continue
                
                except ValidationError:
                    print(f"Couldnt validate email for id {id} with email {email}")
                    continue
                
                seen_names.add(rso_obj.name)
                
                exists = session.scalar(select(RSO).where(RSO.name == rso_obj.name))
                
                if exists:
                    continue;
                
                session.add(RSO(**rso_obj.model_dump()))

            try:
                session.commit()
            except DataError as e:
                print(e)
                
            print("Successfully added RSO data to database")


if __name__ == "__main__":
    main()
