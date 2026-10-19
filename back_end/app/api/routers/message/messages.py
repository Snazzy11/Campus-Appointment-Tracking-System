import asyncio

from fastapi import APIRouter
from fastapi.sse import EventSourceResponse
from pydantic import BaseModel

router = APIRouter(tags=["Messaging"])
# Each connected browser gets its own queue.
subscribers: set[asyncio.Queue] = set()

@router.get("/messaging", response_class=EventSourceResponse)

async def stream_messages():
    message_queue = asyncio.Queue()
    subscribers.add(message_queue)

    try:
        while True:
            # Wait here until the POST handler adds a message.
            event = await message_queue.get()

            # Send that message to this browser.
            yield event
    finally:
        # Remove this subscription when the connection closes.
        subscribers.discard(message_queue)



class MessageInput(BaseModel):
    message: str


@router.post("/messaging")
async def post_message(data: MessageInput):
    event = {"message": data.message}

    # Give every connected browser a copy.
    for queue in subscribers:
        queue.put_nowait(event)

    return {"status": "sent"}