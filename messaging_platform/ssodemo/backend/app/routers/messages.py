import asyncio
import json
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from app.services.messaging import store

router = APIRouter()

class MessageInput(BaseModel):
    text: str = Field(min_length=1, max_length=4000)

@router.post("/data")
async def post_message(body: MessageInput, request: Request):
    text = body.text.strip()
    if not text:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Message cannot be blank")
    sender = request.client.host if request.client else "unknown"
    message = await store.publish(sender, text)
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
    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
