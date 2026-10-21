import pytest

from app.routers import auth, users
from app.services.sessions import create_session
from test_mobile_api import client as client


@pytest.fixture(autouse=True)
def clear_directory_limits():
    users._searches.clear()
    yield
    users._searches.clear()


def account(client, subject, email=None, verified=True):
    token = create_session(subject, email or f"{subject}@example.test", verified)
    headers = {"Authorization": f"Bearer {token}"}
    result = client.get("/api/me", headers=headers)
    assert result.status_code == 200
    return headers, result.json()


def search(client, headers, prefix):
    return client.get("/api/users/search", params={"q": prefix}, headers=headers)


def test_directory_requires_authentication_and_verification(client):
    assert search(client, {}, "car").status_code == 401
    headers, _ = account(client, "alice", verified=False)
    assert search(client, headers, "car").status_code == 403
    headers, _ = account(client, "alice", verified=True)
    assert search(client, headers, "car").status_code == 200


def test_prefix_is_case_insensitive_literal_and_excludes_self(client):
    headers, me = account(client, "carter")
    _, carson = account(client, "carson", "Carson@example.test")
    _, hyphen = account(client, "hyphen", "car-son@example.test")
    _, _ = account(client, "unverified", "car-unverified@example.test", verified=False)
    result = search(client, headers, "  CAR  ")
    assert result.status_code == 200
    assert result.headers["cache-control"] == "no-store"
    assert result.json() == [
        {"id": hyphen["id"], "email": "car-son@example.test"},
        {"id": carson["id"], "email": "Carson@example.test"},
    ]
    assert all(row["id"] != me["id"] for row in result.json())
    assert search(client, headers, "car-").json() == [{"id": hyphen["id"], "email": "car-son@example.test"}]
    assert search(client, headers, "ars").json() == []


@pytest.mark.parametrize("literal", ["%", "_", "\\"])
def test_sql_wildcards_are_escaped(client, literal):
    headers, _ = account(client, "alice")
    _, recipient = account(client, "special", f"car{literal}literal@example.test")
    account(client, "carter")
    assert search(client, headers, "car" + literal).json() == [{"id": recipient["id"], "email": recipient["email"]}]


def test_validation_result_cap_and_duplicate_emails(client):
    headers, _ = account(client, "alice")
    for prefix in ("ca", "   ", "a" * 321):
        assert search(client, headers, prefix).status_code == 422
    for i in range(15):
        account(client, f"car{i:02}")
    result = search(client, headers, "car")
    assert len(result.json()) == 10
    assert [row["email"] for row in result.json()] == [f"car{i:02}@example.test" for i in range(10)]
    assert all(set(row) == {"id", "email"} for row in result.json())
    account(client, "duplicate-one", "car00@example.test")
    assert "car00@example.test" not in [row["email"] for row in search(client, headers, "car").json()]
    account(client, "duplicate-two", "CAR01@example.test")
    assert search(client, headers, "car01").json() == []


def test_rate_limit_is_per_user_not_per_token_and_recovers(client, monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(users, "monotonic", lambda: clock[0])
    headers, _ = account(client, "alice")
    for _ in range(users.SEARCH_LIMIT):
        assert search(client, headers, "car").status_code == 200
    blocked = search(client, headers, "car")
    assert blocked.status_code == 429 and int(blocked.headers["retry-after"]) > 0
    renewed, _ = account(client, "alice")
    assert search(client, renewed, "car").status_code == 429
    other, _ = account(client, "bob")
    assert search(client, other, "car").status_code == 200
    clock[0] += 61
    assert search(client, headers, "car").status_code == 200


@pytest.mark.parametrize("verified,status", [(True, 200), (False, 403), ("true", 403)])
def test_verification_status_comes_from_cognito_claims(client, monkeypatch, verified, status):
    async def exchange(*args):
        return {"sub": "signed-in", "email": "carter@example.test", "email_verified": verified}
    monkeypatch.setattr(auth, "exchange_code", exchange)
    login = client.post("/api/auth/session", json={"code": "code", "code_verifier": "v" * 43, "redirect_uri": "http://localhost:8081/auth/callback"})
    assert login.status_code == 200
    headers = {"Authorization": "Bearer " + login.json()["session_token"]}
    assert search(client, headers, "car").status_code == status


def test_email_verification_is_refreshed_when_profile_changes(client):
    headers, _ = account(client, "alice")
    assert search(client, headers, "car").status_code == 200
    changed, _ = account(client, "alice", "new-address@example.test", verified=False)
    assert search(client, changed, "car").status_code == 403


def test_selected_id_creates_and_reuses_private_conversation(client):
    headers, _ = account(client, "alice")
    _, recipient = account(client, "carter")
    selected = search(client, headers, "car").json()[0]
    assert selected["id"] == recipient["id"]
    first = client.post("/api/conversations", headers=headers, json={"recipient_id": selected["id"]})
    second = client.post("/api/conversations", headers=headers, json={"recipient_id": selected["id"]})
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
