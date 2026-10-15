from fastapi import FastAPI
from sqlalchemy import text

from api.dependencies import db_session

app = FastAPI(title="Campus Appointment and Tracking System", version="0.1.0")


@app.get("/health")
def health(db: db_session):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
