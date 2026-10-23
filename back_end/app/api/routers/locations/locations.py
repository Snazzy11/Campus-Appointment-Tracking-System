from api.dependencies import db_session
from database.models.location import Location
from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import func, select

router = APIRouter(tags=["Locations"])


class LocationOut(BaseModel):
    id: int
    name: str
    longitude: float
    latitude: float


@router.get("/locations", response_model=list[LocationOut])
def list_locations(db: db_session):
    rows = db.execute(
        select(
            Location.id,
            Location.name,
            func.ST_X(Location.position).label("longitude"),
            func.ST_Y(Location.position).label("latitude"),
        ).order_by(Location.name)
    )
    return [LocationOut.model_validate(row, from_attributes=True) for row in rows]
