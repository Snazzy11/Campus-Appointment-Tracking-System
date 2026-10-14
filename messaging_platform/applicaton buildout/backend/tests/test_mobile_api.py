import asyncio
from types import SimpleNamespace

import httpx
import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models import Base
from app.routers import auth, conversations
from app.services.db_dependency import get_db
from app.services.private_events import private_events
from app.services.sessions import _sessions, create_session


@pytest.fixture
def client(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False)

    def db():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = db
    monkeypatch.setattr(conversations, "SessionLocal", factory)
    _sessions.clear()
    private_events.subscribers.clear()
    with TestClient(app) as instance:
        yield instance
    app.dependency_overrides.clear()
    _sessions.clear()
    private_events.subscribers.clear()
    engine.dispose()


def login(client, subject):
    token = create_session(subject, f"{subject}@example.test")
    headers = {"Authorization": f"Bearer {token}"}
    result = client.get("/api/me", headers=headers)
    assert result.status_code == 200
    return headers, result.json()


def test_bearer_sessions_provision_users_and_logout(client):
    headers, user = login(client, "alice")
    assert user["id"] > 0 and user["sub"] == "alice"
    assert client.get("/api/me").status_code == 401
    # A malformed bearer must not fall back to a valid cookie.
    client.cookies.set("campus_session", headers["Authorization"].split()[1])
    assert client.get("/api/me", headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert client.post("/api/auth/logout").status_code == 401
    response = client.post("/api/auth/logout", headers=headers)
    assert response.status_code == 204
    assert 'campus_session=""' in response.headers['set-cookie']
    assert 'Max-Age=0' in response.headers['set-cookie']
    assert client.get("/api/me", headers=headers).status_code == 401


def test_expired_bearer_session(client):
    headers, _ = login(client, "alice")
    token = headers["Authorization"].split()[1]
    _sessions[token]["expires"] = 0
    assert client.get("/api/me", headers=headers).status_code == 401
    assert token not in _sessions


def test_private_membership_and_public_separation(client):
    alice, a = login(client, "alice")
    bob, b = login(client, "bob")
    charlie, _ = login(client, "charlie")
    created = client.post("/api/conversations", headers=alice, json={"recipient_id": b["id"]})
    assert created.status_code == 201
    conversation_id = created.json()["id"]
    reused = client.post("/api/conversations", headers=bob, json={"recipient_id": a["id"]})
    assert reused.json()["id"] == conversation_id
    path = f"/api/conversations/{conversation_id}/messages"
    alice_queue = private_events.subscribe(a["id"])
    bob_queue = private_events.subscribe(b["id"])
    saved = client.post(path, headers=alice, json={"text": "Private hello"})
    assert saved.status_code == 201
    assert alice_queue.get_nowait()["id"] == saved.json()["id"]
    assert bob_queue.get_nowait()["text"] == "Private hello"
    assert client.get(path, headers=bob).json()[0]["text"] == "Private hello"
    assert client.get(path, headers=charlie).status_code == 404
    assert client.post(path, headers=charlie, json={"text": "intrusion"}).status_code == 404
    assert client.get(path).status_code == 401
    assert client.get("/api/data").json() == []
    public = client.post("/api/data", headers=alice, json={"text": "Public hello"})
    assert public.json()["sender"] == a["email"]
    assert len(client.get("/api/data").json()) == 1
    assert client.post("/api/conversations", headers=alice, json={"recipient_id": a["id"]}).status_code == 400


def test_app_code_exchange_requires_allowlisted_redirect_and_pkce(client, monkeypatch):
    exchanges = []

    async def exchange(code, verifier, redirect):
        exchanges.append((code, verifier, redirect))
        return {"sub": "alice", "email": "alice@example.test"}

    monkeypatch.setattr(auth, "exchange_code", exchange)
    payload = {"code": "test-code", "code_verifier": "v" * 43, "redirect_uri": "campusmessaging://auth/callback"}
    assert client.post("/api/auth/session", json={**payload, "redirect_uri": "evil://callback"}).status_code == 400
    assert client.post("/api/auth/session", json={**payload, "code_verifier": "short"}).status_code == 422
    assert exchanges == []
    response = client.post("/api/auth/session", json=payload)
    assert response.status_code == 200
    assert response.json()["expires_in"] == 28800
    token = response.json()["session_token"]
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token}"}).json()["email"] == "alice@example.test"
    assert exchanges == [("test-code", "v" * 43, "campusmessaging://auth/callback")]


def test_code_exchange_handles_provider_outage(client, monkeypatch):
    async def exchange(*args):
        raise httpx.ConnectError("offline")
    monkeypatch.setattr(auth, "exchange_code", exchange)
    response = client.post("/api/auth/session", json={"code": "x", "code_verifier": "v" * 43, "redirect_uri": "campusmessaging://auth/callback"})
    assert response.status_code == 502


def test_cors_allows_expo_bearer_requests(client):
    response = client.options("/api/me", headers={
        "Origin": "http://localhost:8081", "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"


@pytest.mark.parametrize("token_use,email,expected", [("access", "a@example.test", 401), ("id", None, 400), ("id", "a@example.test", 200)])
def test_exchange_verifies_id_token_and_requires_email(monkeypatch, token_use, email, expected):
    sent = {}

    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, data, headers):
            sent.update(data)
            return httpx.Response(200, json={"id_token": "signed-token"})

    monkeypatch.setattr(auth.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(auth.jwks_client, "get_signing_key_from_jwt", lambda token: SimpleNamespace(key="key"))

    def decode(token, key, **kwargs):
        assert kwargs["algorithms"] == ["RS256"]
        assert kwargs["audience"] == "test-client"
        assert kwargs["issuer"] == auth.ISSUER
        return {"sub": "alice", "email": email, "token_use": token_use}

    monkeypatch.setattr(auth.jwt, "decode", decode)
    if expected == 200:
        assert asyncio.run(auth.exchange_code("code", "v" * 43, "campusmessaging://auth/callback"))["sub"] == "alice"
    else:
        with pytest.raises(HTTPException) as error:
            asyncio.run(auth.exchange_code("code", "v" * 43, "campusmessaging://auth/callback"))
        assert error.value.status_code == expected
    assert sent["code_verifier"] == "v" * 43
    assert sent["redirect_uri"] == "campusmessaging://auth/callback"


def test_exchange_rejects_invalid_signature(monkeypatch):
    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, *args, **kwargs): return httpx.Response(200, json={"id_token": "bad"})
    monkeypatch.setattr(auth.httpx, "AsyncClient", FakeClient)
    def invalid(token): raise jwt.InvalidSignatureError("bad signature")
    monkeypatch.setattr(auth.jwks_client, "get_signing_key_from_jwt", invalid)
    with pytest.raises(HTTPException) as error:
        asyncio.run(auth.exchange_code("code", "v" * 43, "campusmessaging://auth/callback"))
    assert error.value.status_code == 401


def test_private_overflow_ends_stream_for_reconnect():
    from app.services.private_events import PrivateEventManager
    manager = PrivateEventManager()
    queue = manager.subscribe(1)
    for index in range(101):
        manager.publish([1], {"id": index})
    assert 1 not in manager.subscribers

    async def collect():
        frames = [frame async for frame in manager.stream(1, queue)]
        assert frames[0] == ": connected\n\n"
        assert len(frames) == 100  # connected + 99 retained events, then close sentinel
    asyncio.run(collect())


def test_private_stream_closes_when_session_expires():
    from app.services.private_events import PrivateEventManager
    manager = PrivateEventManager()
    queue = manager.subscribe(1)
    async def collect():
        frames = [frame async for frame in manager.stream(1, queue, lambda: False)]
        assert frames == [": connected\n\n"]
    asyncio.run(collect())
    assert 1 not in manager.subscribers
