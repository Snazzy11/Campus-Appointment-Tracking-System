from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from cats.database.database import get_db

app = FastAPI(title="Campus Appointment and Tracking System", version="0.1.0")

@app.get("/health")
def db_health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}