"""In-memory message history and per-client event queues (development only)."""
import asyncio
from collections import deque

class MessageStore:
    def __init__(self):
        self.history = deque(maxlen=500)
        self.subscribers = set()
        self.lock = asyncio.Lock()
        self.next_id = 0

    async def publish(self, sender: str, text: str):
        async with self.lock:
            self.next_id += 1
            item = {"id": self.next_id, "sender": sender, "text": text}
            self.history.append(item)
            for queue in self.subscribers:
                if not queue.full():
                    queue.put_nowait(item)
            return item

    async def subscribe(self):
        queue = asyncio.Queue(maxsize=100)
        async with self.lock:
            self.subscribers.add(queue)
            history = list(self.history)
        return queue, history

    async def unsubscribe(self, queue):
        async with self.lock:
            self.subscribers.discard(queue)

store = MessageStore()
