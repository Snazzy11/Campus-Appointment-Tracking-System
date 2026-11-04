from fastapi import APIRouter
from sqlalchemy import text

from cats.api.dependencies import db_session

router = APIRouter(tags=["Health"])


@router.get("/health")
def health(db: db_session):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
