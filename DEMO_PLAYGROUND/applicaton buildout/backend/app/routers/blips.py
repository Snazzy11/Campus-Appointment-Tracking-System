"""Authenticated report submission; public active reports exclude author identity."""

from typing import Literal
from fastapi import APIRouter, Depends, Query, Response, Path, Request, HTTPException
from sqlalchemy import text
from ..geospatial.database import get_blip_db
from ..geospatial import blips
from .profiles import editable_user

router = APIRouter(prefix="/api/geo/reports", tags=["campus reports"])


@router.get("/categories")
def categories(db=Depends(get_blip_db)):
    return [
        dict(row)
        for row in db.execute(
            text(
                "SELECT slug,label FROM geo.blip_categories WHERE enabled ORDER BY label"
            )
        ).mappings()
    ]


@router.get("")
def public(
    response: Response,
    after: int = Query(0, ge=0, le=9223372036854775807),
    db=Depends(get_blip_db),
):
    response.headers["Cache-Control"] = "no-store"
    return blips.reports(db, after=after)


@router.get("/account")
def account(response: Response, user=Depends(editable_user), db=Depends(get_blip_db)):
    response.headers["Cache-Control"] = "no-store"
    return {"role": blips.role(db, user.id)}


@router.get("/private")
def private(
    response: Response,
    scope: Literal["mine", "queue"] = "mine",
    after: int = Query(0, ge=0, le=9223372036854775807),
    user=Depends(editable_user),
    db=Depends(get_blip_db),
):
    response.headers["Cache-Control"] = "no-store"
    return blips.reports(db, user.id, scope, after)


@router.post("", status_code=201)
def create(
    payload: blips.Submission, user=Depends(editable_user), db=Depends(get_blip_db)
):
    return blips.submit(db, user.id, payload)


@router.get("/{id_}/paths")
def paths(
    id_: int = Path(ge=1, le=9223372036854775807),
    user=Depends(editable_user),
    db=Depends(get_blip_db),
):
    blips.require_moderator(db, user.id)
    return [
        dict(row)
        for row in db.execute(
            text("""SELECT e.id,e.feature_id,e.source,e.target,
      round(e.length_m::numeric,1) AS length_m,
      ST_Distance(e.geom::geography,b.geom::geography) AS distance_m,
      ST_AsGeoJSON(e.geom)::json AS geometry
      FROM geo.routing_edges e JOIN geo.blips b ON b.id=:id
      WHERE ST_DWithin(e.geom::geography,b.geom::geography,50) ORDER BY distance_m,e.id LIMIT 100"""),
            {"id": id_},
        ).mappings()
    ]


@router.post("/{id_}/moderate")
def moderate(
    payload: blips.Moderation,
    id_: int = Path(ge=1, le=9223372036854775807),
    user=Depends(editable_user),
    db=Depends(get_blip_db),
):
    return blips.moderate(db, user.id, id_, payload)


@router.post("/roles")
def grant(
    payload: blips.RoleGrant, user=Depends(editable_user), db=Depends(get_blip_db)
):
    return blips.grant_role(db, user.id, payload)


@router.get("/stream")
async def live_public(request: Request):
    from ..geospatial.live import response

    return await response(request)


def stream_identity(request: Request):
    from ..services.sessions import get_request_session
    from ..services.database import SessionLocal
    from ..models import User
    from sqlalchemy import select

    if not request.headers.get("authorization", "").lower().startswith("bearer "):
        raise HTTPException(401, "Bearer authentication required")
    session = get_request_session(request)
    if not session:
        raise HTTPException(401, "Authentication required")
    with SessionLocal() as db:
        user_id = db.scalar(select(User.id).where(User.cognito_sub == session["sub"]))
    if not user_id:
        raise HTTPException(401, "Sign in again")
    return user_id


@router.get("/private/stream")
async def live_private(
    request: Request,
    scope: Literal["mine", "queue"] = "mine",
    user_id=Depends(stream_identity),
):
    from ..geospatial.live import response
    from ..services.sessions import request_session_id

    return await response(request, user_id, scope, request_session_id(request))
