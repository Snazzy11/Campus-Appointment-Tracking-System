
import asyncio
import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Message, User
from ..services.db_dependency import get_db
from ..services.sessions import get_request_session

router = APIRouter()

# Each connected browser receives its own queue.
subscribers: set[asyncio.Queue] = set()


class MessageInput(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


def serialize_message(message: Message) -> dict:
    return {
        "id": message.id,
        "sender": message.sender,
        "text": message.text,
        "created_at": message.created_at.isoformat(),
    }


@router.get("/api/data")
def get_messages(db: Session = Depends(get_db)):
    statement = (
        select(Message).where(
        Message.conversation_id.is_(None)
        ).order_by(Message.id.desc()).limit(100)
    )
    messages = db.scalars(statement).all()

    return [
        serialize_message(message)
        for message in reversed(messages)
    ]


@router.post("/api/data")
async def post_message(
    payload: MessageInput,
    request: Request,
    db: Session = Depends(get_db),
):
    session = get_request_session(request)

    user_id = None
    sender = request.client.host if request.client else "anonymous"

    if session:
        sender = session["email"]

        user = db.scalar(
            select(User).where(
                User.cognito_sub == session["sub"]
            )
        )

        if user is None:
            user = User(
                cognito_sub=session["sub"],
                email=session["email"],
                email_verified=session.get("email_verified") is True,
            )
            db.add(user)
            db.flush()
        else:
            user.email = session["email"]
            user.email_verified = session.get("email_verified") is True

        user_id = user.id

    message = Message(
        user_id=user_id,
        conversation_id=None, #belongs to a public conversation
        sender=sender,
        text=payload.text,
    )

    db.add(message)

    try:
        db.commit()
        db.refresh(message)
    except Exception:
        db.rollback()
        raise

    result = serialize_message(message)

    # Broadcast only after the database commit succeeds.
    for queue in tuple(subscribers):
        try:
            queue.put_nowait(result)
        except asyncio.QueueFull:
            subscribers.discard(queue)
            queue.get_nowait()
            queue.put_nowait(None)

    return result


@router.get("/api/stream")
async def stream_messages(request: Request):
    queue = asyncio.Queue(maxsize=100)
    subscribers.add(queue)

    async def event_generator():
        try:
            yield ": connected\n\n"

            while True:
                if await request.is_disconnected():
                    break

                try:
                    message = await asyncio.wait_for(
                        queue.get(),
                        timeout=15,
                    )
                    if message is None:
                        break
                    yield (
                        f"data: {json.dumps(message)}\n\n"
                    )
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"

        finally:
            subscribers.discard(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
