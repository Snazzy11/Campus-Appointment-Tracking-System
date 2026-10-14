"""Authenticated, bounded directory lookup for choosing a DM recipient."""
from collections import OrderedDict, deque
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import User
from ..services.auth_dependency import require_user
from ..services.db_dependency import get_db

router = APIRouter(prefix="/api/users", tags=["directory"])
SEARCH_LIMIT = 30
WINDOW_SECONDS = 60
MAX_ACTIVE_USERS = 4096
_searches: OrderedDict[int, deque[float]] = OrderedDict()
_lock = Lock()


class Recipient(BaseModel):
    id: int
    email: str


def check_search_limit(user_id: int) -> None:
    now = monotonic()
    with _lock:
        # Evict idle buckets; active buckets are not discarded to bypass limits.
        for key in list(_searches):
            if not _searches[key] or _searches[key][-1] <= now - WINDOW_SECONDS:
                del _searches[key]
        if user_id not in _searches:
            if len(_searches) >= MAX_ACTIVE_USERS:
                raise HTTPException(503, "Directory is busy. Try again shortly.", headers={"Retry-After": "60"})
            _searches[user_id] = deque()
        bucket = _searches[user_id]
        while bucket and bucket[0] <= now - WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= SEARCH_LIMIT:
            retry = max(1, int(WINDOW_SECONDS - (now - bucket[0])) + 1)
            raise HTTPException(429, "Too many searches. Pause for a minute and try again.", headers={"Retry-After": str(retry)})
        bucket.append(now)


@router.get("/search", response_model=list[Recipient])
def search_users(
    response: Response,
    q: str = Query(min_length=3, max_length=320),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    if not user.email_verified:
        raise HTTPException(403, "Verify your email with Cognito, then sign in again to search recipients.")
    check_search_limit(user.id)
    prefix = q.strip().lower()
    if len(prefix) < 3:
        raise HTTPException(422, "Type at least 3 characters.")
    # %, _ and backslash are literal input, not directory-wide SQL wildcards.
    pattern = prefix.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    email = func.lower(User.email)
    match = email.like(pattern, escape="\\")
    unique_emails = (
        select(email).where(User.email_verified.is_(True), match)
        .group_by(email).having(func.count(User.id) == 1)
    )
    statement = (
        select(User.id, User.email)
        .where(User.email_verified.is_(True), match, User.id != user.id, email.in_(unique_emails))
        .order_by(email, User.id).limit(10)
    )
    return [{"id": row.id, "email": row.email} for row in db.execute(statement)]
