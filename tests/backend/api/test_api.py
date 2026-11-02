import asyncio
import os

# App import needs a URL; health uses an isolated test database below.
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest
from cats.api.main import app
from cats.api.routers.message.messages import (
    MessageInput,
    post_message,
    stream_messages,
    subscribers,
)
from cats.api.routers.message.messages import router as messaging_router
from cats.database.database import get_db
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    def test_db():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = test_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# The messaging router isn't mounted on the main app yet, so test it on its own app.
@pytest.fixture
def messaging_client():
    messaging_app = FastAPI()
    messaging_app.include_router(messaging_router)
    with TestClient(messaging_app) as test_client:
        yield test_client


def test_post_message(messaging_client):
    response = messaging_client.post("/messaging", json={"message": "Hello"})
    assert response.status_code == 200
    assert response.json() == {"status": "sent"}


@pytest.mark.parametrize("payload", [None, {}, {"message": 123}])
def test_invalid_message(messaging_client, payload):
    response = messaging_client.post("/messaging", json=payload)
    assert response.status_code == 422


def test_message_broadcast_and_disconnect():
    async def check():
        initial_count = len(subscribers)
        streams = [stream_messages(), stream_messages()]
        pending = [asyncio.create_task(anext(events)) for events in streams]
        try:
            await asyncio.sleep(0)  # Let both listeners register before posting.
            assert len(subscribers) == initial_count + 2
            assert await post_message(MessageInput(message="Hello")) == {
                "status": "sent"
            }
            received = await asyncio.wait_for(asyncio.gather(*pending), 1)
            assert received == [{"message": "Hello"}, {"message": "Hello"}]
        finally:
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            for events in streams:
                await events.aclose()
        assert len(subscribers) == initial_count

    asyncio.run(check())
