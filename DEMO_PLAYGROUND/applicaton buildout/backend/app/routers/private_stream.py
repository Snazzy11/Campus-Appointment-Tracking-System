
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from ..models import User, ConversationMember
from ..services.database import SessionLocal
from ..services.auth_dependency import require_user
from ..services.private_events import private_events
from ..services.sessions import get_session, request_session_id

router = APIRouter(prefix="/api/private")


async def event_permitted(user_id, event):
    if event.get("_event") == "conversation_updated":
        return True  # Revocation signal contains only an already-known conversation ID.
    def check():
        with SessionLocal() as db:
            return db.scalar(select(ConversationMember.user_id).where(
                ConversationMember.conversation_id == event.get("conversation_id"),
                ConversationMember.user_id == user_id,
            )) is not None
    return await run_in_threadpool(check)


@router.get("/stream")
async def private_stream(
    request: Request,
    user: User = Depends(require_user),
):
    queue = private_events.subscribe(user.id)
    session_id = request_session_id(request)

    return StreamingResponse(
        private_events.stream(user.id, queue, lambda: get_session(session_id) is not None, lambda event: event_permitted(user.id, event)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
