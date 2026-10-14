"""Report policy. Database locks enforce limits and transitions across workers."""

from datetime import datetime, timezone
from typing import Literal
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text


class Submission(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    category: str = Field(max_length=40, pattern=r"^[a-z_]+$")
    description: str = Field(min_length=10, max_length=1000)
    longitude: float = Field(ge=-84.80, le=-84.74)
    latitude: float = Field(ge=43.56, le=43.62)
    severity: Literal["low", "medium", "high"] = "medium"
    expires_at: datetime

    @field_validator("description")
    @classmethod
    def clean(cls, value):
        value = value.strip()
        if len(value) < 10 or any(ord(c) < 32 and c not in "\n\t" for c in value):
            raise ValueError("Provide 10–1000 characters without control characters")
        return value

    @field_validator("expires_at")
    @classmethod
    def expiration(cls, value):
        if value.tzinfo is None:
            raise ValueError("Expiration requires a timezone")
        remaining = (value - datetime.now(timezone.utc)).total_seconds()
        if not 60 <= remaining <= 30 * 86400:
            raise ValueError("Expiration must be between one minute and 30 days away")
        return value


class Moderation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["approve", "reject", "activate", "resolve"]
    note: str = Field(max_length=500)
    verified: bool = False
    edge_ids: list[int] = Field(default_factory=list, max_length=30)

    @field_validator("edge_ids")
    @classmethod
    def edges(cls, value):
        if any(x < 1 or x > 9223372036854775807 for x in value) or len(value) != len(
            set(value)
        ):
            raise ValueError("Use distinct positive edge IDs")
        return value

    @field_validator("note")
    @classmethod
    def note_text(cls, value):
        if len(value.strip()) < 10:
            raise ValueError("Moderation reason: enter at least 10 characters explaining your decision")
        return value.strip()


def role(db, user_id):
    return (
        db.execute(
            text("SELECT role FROM geo.blip_roles WHERE user_id=:id"), {"id": user_id}
        ).scalar()
        or "user"
    )


def require_moderator(db, user_id):
    if role(db, user_id) not in ("moderator", "admin"):
        raise HTTPException(403, "Moderator permission required")


def audit(db, id_, actor, action, note):
    db.execute(
        text(
            "INSERT INTO geo.blip_audit(blip_id,actor_id,action,note) VALUES(:id,:actor,:action,:note)"
        ),
        {"id": id_, "actor": actor, "action": action, "note": note},
    )


def submit(db, user_id, payload):
    # Per-author transaction lock serializes both rate and duplicate checks.
    db.execute(text("SELECT pg_advisory_xact_lock(73521,:id)"), {"id": user_id})
    count = db.execute(
        text(
            "SELECT count(*) FROM geo.blips WHERE author_id=:id AND created_at>now()-interval '1 hour'"
        ),
        {"id": user_id},
    ).scalar()
    if count >= 5:
        raise HTTPException(429, "Limit of five reports per hour. Please try later.")
    params = {**payload.model_dump(), "author": user_id}
    if not db.execute(
        text("SELECT 1 FROM geo.blip_categories WHERE slug=:category AND enabled"),
        params,
    ).scalar():
        raise HTTPException(422, "Unknown report category")
    if db.execute(
        text("""SELECT 1 FROM geo.blips WHERE author_id=:author AND category=:category
      AND status IN ('pending','approved','active') AND expires_at>now()
      AND ST_DWithin(geom::geography,ST_SetSRID(ST_MakePoint(:longitude,:latitude),4326)::geography,10)
      LIMIT 1"""),
        params,
    ).scalar():
        raise HTTPException(
            409, "You already have an open report of this category here."
        )
    id_ = db.execute(
        text("""INSERT INTO geo.blips(author_id,category,description,geom,severity,expires_at)
      VALUES(:author,:category,:description,ST_SetSRID(ST_MakePoint(:longitude,:latitude),4326),:severity,:expires_at)
      RETURNING id"""),
        params,
    ).scalar_one()
    audit(db, id_, user_id, "submit", "Submitted for moderation")
    return {"id": id_, "status": "pending"}


def reports(db, user_id=None, scope="public", after=0):
    if scope == "queue":
        require_moderator(db, user_id)
    conditions = {
        "public": "status='active' AND expires_at>now()",
        "mine": "author_id=:user",
        "queue": "status IN ('pending','approved','active') AND expires_at>now()",
    }
    rows = (
        db.execute(
            text(f"""SELECT id,category,description,severity,
      CASE WHEN expires_at<=now() AND status IN ('pending','approved','active') THEN 'expired' ELSE status END AS status,
      verified,created_at,updated_at,expires_at,ST_AsGeoJSON(geom)::json AS geometry
      FROM geo.blips WHERE {conditions[scope]} AND id>:after ORDER BY id LIMIT 101"""),
            {"user": user_id, "after": after},
        )
        .mappings()
        .all()
    )
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": r["id"],
                "geometry": r["geometry"],
                "properties": {
                    "kind": "blip",
                    **{k: v for k, v in r.items() if k != "geometry"},
                },
            }
            for r in rows[:100]
        ],
        "next_after": rows[99]["id"] if len(rows) > 100 else None,
    }


def moderate(db, user_id, id_, payload):
    require_moderator(db, user_id)
    row = (
        db.execute(text("SELECT * FROM geo.blips WHERE id=:id FOR UPDATE"), {"id": id_})
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(404, "Report not found")
    target = {
        "approve": ("pending", "approved"),
        "reject": ("pending", "rejected"),
        "activate": ("approved", "active"),
    }
    if payload.action == "resolve":
        valid = row["status"] in ("pending", "approved", "active")
        status = "resolved"
    else:
        previous, status = target[payload.action]
        valid = row["status"] == previous and row["expires_at"] > datetime.now(
            timezone.utc
        )
    if not valid:
        raise HTTPException(
            409, "Report changed, expired, or transition is not allowed"
        )
    if payload.action != "activate" and (payload.edge_ids or payload.verified):
        raise HTTPException(422, "Verification and paths belong to activation only")
    if payload.edge_ids:
        if not payload.verified:
            raise HTTPException(422, "Route impact requires verification")
        if (
            db.execute(text("SELECT dirty FROM geo.routing_state")).scalar()
            is not False
        ):
            raise HTTPException(
                409, "Rebuild the routing graph before associating paths"
            )
        edges = (
            db.execute(
                text("""SELECT e.feature_id,e.source,e.target FROM geo.routing_edges e
          JOIN geo.blips b ON b.id=:id WHERE e.id=ANY(:edges)
          AND ST_DWithin(e.geom::geography,b.geom::geography,50)"""),
                {"id": id_, "edges": payload.edge_ids},
            )
            .mappings()
            .all()
        )
        if len(edges) != len(payload.edge_ids):
            raise HTTPException(
                422, "Select existing path segments within 50 meters of this report"
            )
        for edge in edges:
            db.execute(
                text(
                    "INSERT INTO geo.blip_edges VALUES(:id,:feature_id,:source,:target)"
                ),
                {"id": id_, **dict(edge)},
            )
    db.execute(
        text("""UPDATE geo.blips SET status=:status,
      verified=CASE WHEN :activate THEN :verified ELSE verified END,updated_at=now() WHERE id=:id"""),
        {
            "id": id_,
            "status": status,
            "activate": payload.action == "activate",
            "verified": payload.verified,
        },
    )
    audit(db, id_, user_id, payload.action, payload.note)
    return {"id": id_, "status": status}


class RoleGrant(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: int = Field(ge=1, le=2147483647)
    role: Literal["user", "moderator"]
    note: str = Field(min_length=10, max_length=500)


def grant_role(db, actor, payload):
    if role(db, actor) != "admin":
        raise HTTPException(403, "Administrator permission required")
    if (
        db.execute(
            text("SELECT role FROM geo.blip_roles WHERE user_id=:id FOR UPDATE"),
            {"id": payload.user_id},
        ).scalar()
        == "admin"
    ):
        raise HTTPException(409, "Administrator grants are managed by the operator")
    if payload.role == "user":
        db.execute(
            text("DELETE FROM geo.blip_roles WHERE user_id=:id"),
            {"id": payload.user_id},
        )
    else:
        db.execute(
            text("""INSERT INTO geo.blip_roles(user_id,role) VALUES(:id,'moderator')
          ON CONFLICT(user_id) DO UPDATE SET role='moderator'"""),
            {"id": payload.user_id},
        )
    audit(
        db,
        None,
        actor,
        "role",
        f"User {payload.user_id}: {payload.role}. {payload.note}",
    )
    return {"user_id": payload.user_id, "role": payload.role}
