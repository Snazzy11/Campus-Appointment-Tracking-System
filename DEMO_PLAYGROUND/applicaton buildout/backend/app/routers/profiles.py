"""Bearer-only self-service profile editing and bounded photo uploads."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from ..models import User
from ..services.auth_dependency import require_user
from ..services.db_dependency import get_db
from ..services.profiles import account_profile, public_profile
from ..services import avatars

router = APIRouter(tags=["profiles"])


def editable_user(request: Request, user: User = Depends(require_user)):
    if not request.headers.get("authorization", "").lower().startswith("bearer "):
        raise HTTPException(401, "Bearer authentication required")
    return user


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str | None = Field(default=None, min_length=3, max_length=30, pattern=r"^[a-z0-9_]+$")
    display_name: str | None = Field(default=None, max_length=80)
    bio: str = Field(default="", max_length=300)

    @field_validator("username", "display_name", "bio", mode="before")
    @classmethod
    def clean(cls, value, info):
        if isinstance(value, str):
            value = value.strip()
            if any(ord(c) < 32 and c not in "\n\t" for c in value):
                raise ValueError("Control characters are not allowed")
            if info.field_name == "username":
                value = value.lower()
            if info.field_name != "bio" and not value:
                return None
        return value


def locked_user(db, user_id):
    return db.scalar(select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True))


@router.post("/api/me/profile")
def update_profile(payload: ProfileUpdate, response: Response, user: User = Depends(editable_user), db: Session = Depends(get_db)):
    user = locked_user(db, user.id)
    for name, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, name, value)
    user.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "That username is already taken. Choose another") from None
    response.headers["Cache-Control"] = "no-store"
    return account_profile(user)


@router.post("/api/me/avatar")
async def upload_avatar(request: Request, user: User = Depends(editable_user), db: Session = Depends(get_db)):
    # Limit actual streamed bytes, including requests without Content-Length.
    encoded = bytearray()
    async for chunk in request.stream():
        if len(encoded) + len(chunk) > avatars.MAX_ENCODED:
            raise HTTPException(413, "Choose a photo smaller than 5 MB")
        encoded.extend(chunk)
    actor_id = user.id

    def save():
        data = avatars.normalize(encoded)
        current = locked_user(db, actor_id)
        previous = current.avatar_key
        key = avatars.put(data)
        try:
            current.avatar_key = key
            current.updated_at = datetime.now(timezone.utc)
            db.commit()
        except Exception:
            db.rollback()
            avatars.discard(key)
            raise
        avatars.discard(previous)
        return account_profile(current)

    result = await run_in_threadpool(save)
    return result


@router.post("/api/me/avatar/remove")
def remove_avatar(user: User = Depends(editable_user), db: Session = Depends(get_db)):
    current = locked_user(db, user.id)
    previous = current.avatar_key
    current.avatar_key = None
    current.updated_at = datetime.now(timezone.utc)
    db.commit()
    avatars.discard(previous)
    return account_profile(current)


@router.get("/api/avatars/{key}")
def get_avatar(key: str, db: Session = Depends(get_db)):
    # Only active profile photos are served; removed/replaced keys stop resolving.
    if not avatars.KEY.fullmatch(key) or db.scalar(select(User.id).where(User.avatar_key == key)) is None:
        raise HTTPException(404, "Photo not found")
    return Response(content=avatars.read(key), media_type="image/jpeg", headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


@router.get("/api/users/{user_id}/profile")
def view_profile(user_id: int, response: Response, user: User = Depends(require_user), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "Profile not found")
    response.headers["Cache-Control"] = "no-store"
    return {**public_profile(target), "bio": target.bio}
