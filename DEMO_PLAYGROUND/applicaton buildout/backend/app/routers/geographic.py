"""Public read-only campus data. Import/verification remain offline operator actions."""
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from ..geospatial.database import get_geo_db
from ..geospatial.queries import parse_bbox, feature_collection
from ..geospatial.importer import BOUNDS

router = APIRouter(prefix="/api/geo", tags=["campus geography"])
DEFAULT_BBOX = ",".join(str(v) for v in BOUNDS)


@router.get("/features")
def features(bbox: str = Query(default=DEFAULT_BBOX, max_length=100),
             kind: str | None = Query(default=None, max_length=20),
             limit: int = Query(default=200, ge=1, le=500),
             after: int = Query(default=0, ge=0, le=9223372036854775807), db=Depends(get_geo_db)):
    return feature_collection(db, parse_bbox(bbox), kind, limit, after)


@router.get("/buildings")
def buildings(bbox: str = Query(default=DEFAULT_BBOX, max_length=100),
              limit: int = Query(default=200, ge=1, le=500),
              after: int = Query(default=0, ge=0, le=9223372036854775807), db=Depends(get_geo_db)):
    return feature_collection(db, parse_bbox(bbox), "building", limit, after)


@router.get("/landmarks")
def landmarks(bbox: str = Query(default=DEFAULT_BBOX, max_length=100),
              after: int = Query(default=0, ge=0, le=9223372036854775807),
              limit: int = Query(default=200, ge=1, le=500), db=Depends(get_geo_db)):
    return feature_collection(db, parse_bbox(bbox), "landmark", limit, after)


@router.get("/buildings/search")
def search(q: str = Query(default="", max_length=120),
           limit: int = Query(default=20, ge=1, le=30), db=Depends(get_geo_db)):
    from ..geospatial.search import search_buildings
    return search_buildings(db, q, limit)


@router.get("/buildings/{building_id}")
def building(building_id: int = Path(ge=1, le=9223372036854775807), db=Depends(get_geo_db)):
    result = feature_collection(db, parse_bbox(DEFAULT_BBOX), "building", feature_id=building_id)
    if not result["features"]:
        raise HTTPException(404, "Building not found")
    from sqlalchemy import text
    feature = result["features"][0]
    feature["properties"]["aliases"] = [dict(row) for row in db.execute(text(
        "SELECT label,kind FROM geo.building_aliases WHERE building_id=:id ORDER BY label"),
        {"id": building_id}).mappings()]
    return feature


@router.get("/buildings/{building_id}/entrances")
def entrances(building_id: int = Path(ge=1, le=9223372036854775807),
              after: int = Query(default=0, ge=0, le=9223372036854775807), db=Depends(get_geo_db)):
    building(building_id, db)
    result = feature_collection(db, parse_bbox(DEFAULT_BBOX), "entrance", limit=500, after=after, building_id=building_id)
    result["association"] = "Within 3m of footprint; unverified proximity association"
    return result


from ..geospatial.routing import RouteRequest, route  # noqa: E402


@router.post('/routes')
def walking_route(request: RouteRequest, db=Depends(get_geo_db)):
    import os
    if os.getenv('GEO_ROUTING_ENABLED') != 'true':
        raise HTTPException(503, 'Campus walking routes are not enabled')
    return route(db, request)
