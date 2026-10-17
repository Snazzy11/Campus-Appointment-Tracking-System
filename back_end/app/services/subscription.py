# class to handle subscription services using subscription model
#unimplemented class
import asyncio
from typing import AsyncIterator, Awaitable, Callable


class SubscriptionService:
    def __init__(self, subscription_model):
        self.subscription_model = subscription_model

    # to handle subscribing users to events
    def subscribe(self, user_id: int, event_type: str):
        return

    # to handle unsubscribing users from events
    def unsubscribe(self, user_id: int, event_type: str):
        return

    # to handle adding events to each users queue
    def publish(self, user_ids: list[int], event: dict[str, Any]):
        return

    # stream method to stream events to subscribers in real-time
    def stream(self, user_id: int, queue: asyncio.Queue, authorized: Callable[[], bool] = lambda: True, permitted: Callable[[dict], Awaitable[bool]] | None = None) -> AsyncIterator[str]:
        return
        