"""Import schedule info into a schedule table.

Usage (from the repo root, after `make db-migrate` has created the tables):
    uv run python scripts/add_schedule_info.py
"""
from cats.database.database import SessionLocal, engine
from cats.database.models.schedule import Schedule
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session, aliased
import json

def main() -> None:
    print("Creating user schedule table")
    Schedule.__table__.create(bind=engine, checkfirst=True)
    
    with SessionLocal() as session:
        with open("data/schedule_info.json", "r") as file:
            classes = json.load(file)
            print(f"Found {len(classes)} classes in json file")
            print(classes)
            # check if class exists
            for class_item in classes:
                exists = session.scalar(select(Schedule).where(Schedule.section == class_item["section"]))
                if not exists:
                    print(f"{class_item["section"]} doesn't exist in table")
                                
        
    
if __name__ == "__main__":
    main()