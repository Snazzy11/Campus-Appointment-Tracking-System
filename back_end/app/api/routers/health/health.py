from api.dependencies import db_session
from fastapi import APIRouter
from sqlalchemy import text

router = APIRouter(tags=["Health"])


@router.get("/health")
def health(db: db_session):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
