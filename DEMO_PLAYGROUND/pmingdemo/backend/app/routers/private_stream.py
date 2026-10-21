
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from ..models import User
from ..services.auth_dependency import require_user
from ..services.private_events import private_events
from ..services.sessions import get_session, request_session_id

router = APIRouter(prefix="/api/private")


@router.get("/stream")
async def private_stream(
    request: Request,
    user: User = Depends(require_user),
):
    queue = private_events.subscribe(user.id)
    session_id = request_session_id(request)

    return StreamingResponse(
        private_events.stream(user.id, queue, lambda: get_session(session_id) is not None),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
