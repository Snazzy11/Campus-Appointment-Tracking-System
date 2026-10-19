import asyncio

from fastapi import APIRouter
from fastapi.sse import EventSourceResponse

router = APIRouter(tags=["Counter"])

@router.get("/counter", response_class=EventSourceResponse)
async def stream():
    count = 0
    yield{"message":"Open for this many seconds: ", "count": 0}

    while True:
        count += 1
        yield {"count": count}  # send one update, while keeping that function going
        await asyncio.sleep(1)