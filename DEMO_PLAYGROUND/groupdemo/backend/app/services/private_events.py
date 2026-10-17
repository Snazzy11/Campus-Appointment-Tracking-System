
import asyncio
import json
from collections import defaultdict
from collections.abc import AsyncIterator, Callable, Awaitable
from typing import Any


class PrivateEventManager:
    def __init__(self):
        # user_id -> set of connected subscriber queues
        self.subscribers: dict[
            int, set[asyncio.Queue]
        ] = defaultdict(set)

    def subscribe(self, user_id: int) -> asyncio.Queue:
        queue = asyncio.Queue(maxsize=100)
        self.subscribers[user_id].add(queue)
        return queue

    def unsubscribe(
        self,
        user_id: int,
        queue: asyncio.Queue,
    ):
        connections = self.subscribers.get(user_id)

        if connections is None:
            return

        connections.discard(queue)

        if not connections:
            self.subscribers.pop(user_id, None)

    def publish(
        self,
        user_ids: list[int],
        event: dict[str, Any],
    ):
        for user_id in set(user_ids):
            for queue in tuple(
                self.subscribers.get(user_id, ())
            ):
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    # End this stream so the client reconnects and reloads persisted history.
                    self.unsubscribe(user_id, queue)
                    queue.get_nowait()
                    queue.put_nowait(None)

    async def stream(
        self,
        user_id: int,
        queue: asyncio.Queue,
        authorized: Callable[[], bool] = lambda: True,
        permitted: Callable[[dict], Awaitable[bool]] | None = None,
    ) -> AsyncIterator[str]:
        try:
            yield ": connected\n\n"
            while authorized():
                try:
                    event = await asyncio.wait_for(
                        queue.get(),
                        timeout=20,
                    )

                    if event is None or not authorized():
                        break
                    if permitted is not None and not await permitted(event):
                        continue
                    name = "conversation_updated" if event.get("_event") == "conversation_updated" else "private_message"
                    payload = {key: value for key, value in event.items() if key != "_event"}
                    yield f"event: {name}\ndata: {json.dumps(payload)}\n\n"

                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"

        finally:
            self.unsubscribe(user_id, queue)


private_events = PrivateEventManager()
