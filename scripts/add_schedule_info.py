"""Import schedule info into a schedule table.

Usage (from the repo root, after `make db-migrate` has created the tables):
    uv run python scripts/add_schedule_info.py
"""
from cats.database.database import SessionLocal, engine
# from cats.database.models.user_schedule import UserSchedule
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session, aliased
import json

def main() -> None:
    # print("Creating user schedule table")
    # UserSchedule.__table__.create(bind=engine, checkfirst=True)
    
    with SessionLocal() as session:
        # Adds class information stored in json
        with open("data/schedule_info.json", "r") as file:
            classes = json.load(file)
            print(f"Found {len(classes)} classes in json file")
                
                                
        
    
if __name__ == "__main__":
    main()