from fastapi import APIRouter
from sqlalchemy import func, select
from cats.api.dependencies import db_session
from cats.database.models.rso import RSO
from cats.schemas.rso import RSOBase

router = APIRouter(tags=["RSOs"])


@router.get("/rsos", response_model=list[RSOBase])
def list_rsos(db: db_session):
    rows = db.execute(
        select(
            RSO.id,
            RSO.name,
            RSO.description,
            RSO.link,
            RSO.email,
            RSO.phone,
            RSO.location,
        ).order_by(RSO.name)
    )
    return [RSOBase.model_validate(row, from_attributes=True) for row in rows]
