"""Message API and Server-Sent Events stream."""
import asyncio
import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..services.messaging import store
from ..services.sessions import get_session

router = APIRouter()


class MessageInput(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


def determine_sender(request: Request) -> str:
    """Use a verified Cognito email when logged in; otherwise client IP."""
    session = get_session(request.cookies.get("campus_session"))
    if session and session.get("email"):
        return session["email"]
    return request.client.host if request.client else "unknown"


@router.post("/data")
async def post_message(body: MessageInput, request: Request):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Message cannot be blank")
    message = await store.publish(determine_sender(request), text)
    return {"status": "success", "message": message}


@router.get("/messages")
async def list_messages():
    async with store.lock:
        return list(store.history)


@router.get("/stream")
async def stream_messages(request: Request):
    async def events():
        queue, history = await store.subscribe()
        try:
            for message in history:
                yield f"id: {message['id']}\ndata: {json.dumps(message)}\n\n"
            while not await request.is_disconnected():
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"id: {message['id']}\ndata: {json.dumps(message)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            await store.unsubscribe(queue)
    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
