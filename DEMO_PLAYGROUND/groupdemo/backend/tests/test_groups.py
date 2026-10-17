import asyncio

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Conversation, Message
from app.routers import conversations, groups, private_stream
from app.services.private_events import private_events
from test_mobile_api import client as client, login


@pytest.fixture(autouse=True)
def group_database(client, monkeypatch):
    monkeypatch.setattr(groups, "SessionLocal", conversations.SessionLocal)
    monkeypatch.setattr(private_stream, "SessionLocal", conversations.SessionLocal)


def setup_group(client):
    accounts = [login(client, name) for name in ("alice", "bob", "carson", "eve")]
    response = client.post("/api/groups", headers=accounts[0][0], json={"name": " Study group ", "member_ids": [accounts[1][1]["id"], accounts[2][1]["id"]]})
    assert response.status_code == 201, response.text
    return response.json(), accounts


def history(client, group_id, headers, **params):
    return client.get(f"/api/conversations/{group_id}/messages", headers=headers, params=params)


def test_create_group_and_owner_only_changes(client):
    group, accounts = setup_group(client)
    owner, bob, _, eve = accounts
    assert group["name"] == "Study group" and group["owner_ids"] == [owner[1]["id"]]
    assert len(group["members"]) == 3
    notices = history(client, group["id"], bob[0]).json()
    assert len(notices) == 3 and all(row["kind"] == "system" and row["user_id"] is None for row in notices)
    assert history(client, group["id"], eve[0]).status_code == 404
    for operation, payload in (("rename", {"name": "New name"}), ("members", {"user_id": eve[1]["id"]}), ("promote", {"user_id": bob[1]["id"]}), ("remove-member", {"user_id": owner[1]["id"]})):
        assert client.post(f'/api/groups/{group["id"]}/{operation}', headers=bob[0], json=payload).status_code == 403
        assert client.post(f'/api/groups/{group["id"]}/{operation}', headers=eve[0], json=payload).status_code == 404
    assert len(history(client, group["id"], owner[0]).json()) == 3


def test_multiple_owners_and_last_owner_protection(client):
    group, accounts = setup_group(client)
    owner, bob, carson, _ = accounts
    root = f'/api/groups/{group["id"]}'
    assert client.post(root + '/leave', headers=owner[0]).status_code == 409
    assert client.post(root + '/remove-member', headers=owner[0], json={"user_id": owner[1]["id"]}).status_code == 409
    assert client.post(root + '/promote', headers=owner[0], json={"user_id": bob[1]["id"]}).status_code == 200
    promoted = client.post(root + '/promote', headers=bob[0], json={"user_id": carson[1]["id"]})
    assert promoted.status_code == 200 and len(promoted.json()["owner_ids"]) == 3
    assert client.post(root + '/leave', headers=owner[0]).status_code == 200
    assert history(client, group["id"], owner[0]).status_code == 404
    updated = client.post(root + '/rename', headers=bob[0], json={"name": "After creator leaves"})
    assert updated.status_code == 200 and len(updated.json()["owner_ids"]) == 2
    assert client.post(root + '/leave', headers=bob[0]).status_code == 200
    assert client.post(root + '/leave', headers=carson[0]).status_code == 409
    statuses = history(client, group["id"], carson[0]).json()
    assert any('promoted' in row["text"] for row in statuses)
    assert any('left' in row["text"] for row in statuses)


def test_new_member_can_paginate_entire_pre_join_history(client):
    group, accounts = setup_group(client)
    owner, _, _, eve = accounts
    with conversations.SessionLocal() as db:
        db.add_all([Message(conversation_id=group["id"], user_id=owner[1]["id"], sender=owner[1]["email"], text=f"Earlier {i}") for i in range(205)])
        db.commit()
    assert client.post(f'/api/groups/{group["id"]}/members', headers=owner[0], json={"user_id": eve[1]["id"]}).status_code == 200
    rows = []
    cursor = None
    while True:
        response = history(client, group["id"], eve[0], **({"before_id": cursor} if cursor else {}))
        assert response.status_code == 200
        page = response.json()
        if not page:
            break
        rows = page + rows
        cursor = page[0]["id"]
    assert len(rows) == 209 and len({row["id"] for row in rows}) == 209
    assert len([row for row in rows if row["text"].startswith('Earlier')]) == 205
    assert [row["id"] for row in rows] == sorted(row["id"] for row in rows)
    assert history(client, group["id"], eve[0], before_id=0).status_code == 422
    assert history(client, group["id"], eve[0], limit=101).status_code == 422


def test_removal_denies_reads_writes_and_queued_message_delivery(client):
    group, accounts = setup_group(client)
    owner, bob, _, _ = accounts
    queue = private_events.subscribe(bob[1]["id"])
    private_events.publish([bob[1]["id"]], {"id": 999, "conversation_id": group["id"], "text": "must not deliver"})
    removed = client.post(f'/api/groups/{group["id"]}/remove-member', headers=owner[0], json={"user_id": bob[1]["id"]})
    assert removed.status_code == 200
    assert history(client, group["id"], bob[0]).status_code == 404
    assert client.post(f'/api/conversations/{group["id"]}/messages', headers=bob[0], json={"text": "not allowed"}).status_code == 404
    queue.put_nowait(None)
    async def collect():
        return [frame async for frame in private_events.stream(bob[1]["id"], queue, permitted=lambda event: private_stream.event_permitted(bob[1]["id"], event))]
    frames = ''.join(asyncio.run(collect()))
    assert 'must not deliver' not in frames
    assert 'conversation_updated' in frames and 'removed_user_ids' in frames
    assert any('removed bob' in row["text"] for row in history(client, group["id"], owner[0]).json())


def test_duplicate_actions_do_not_spam_history_and_user_cannot_forge_system_message(client):
    group, accounts = setup_group(client)
    owner, bob, _, _ = accounts
    root = f'/api/groups/{group["id"]}'
    client.post(root + '/members', headers=owner[0], json={"user_id": bob[1]["id"]})
    client.post(root + '/rename', headers=owner[0], json={"name": group["name"]})
    assert len(history(client, group["id"], owner[0]).json()) == 3
    message = client.post(f'/api/conversations/{group["id"]}/messages', headers=bob[0], json={"text": "hello", "kind": "system", "sender": "Group"})
    assert message.status_code == 201 and message.json()["kind"] == "user" and message.json()["sender"] == bob[1]["email"]


def test_failed_commit_rolls_back_name_and_status_without_events(client, monkeypatch):
    group, accounts = setup_group(client)
    owner = accounts[0]
    queue = private_events.subscribe(owner[1]["id"])
    original = Session.commit
    def fail(self): raise RuntimeError('simulated commit failure')
    monkeypatch.setattr(Session, 'commit', fail)
    with pytest.raises(RuntimeError, match='simulated commit failure'):
        client.post(f'/api/groups/{group["id"]}/rename', headers=owner[0], json={"name": "Must rollback"})
    monkeypatch.setattr(Session, 'commit', original)
    with conversations.SessionLocal() as db:
        assert db.get(Conversation, group["id"]).name == "Study group"
        assert db.scalar(select(func.count()).select_from(Message).where(Message.conversation_id == group["id"])) == 3
    assert queue.empty()


def test_groups_validate_input_and_do_not_change_direct_messages(client):
    owner, alice = login(client, 'owner')
    peer, bob = login(client, 'peer')
    assert client.post('/api/groups', headers=owner, json={"name": "   "}).status_code == 422
    assert client.post('/api/groups', headers=owner, json={"name": "x" * 81}).status_code == 422
    assert client.post('/api/groups', headers=owner, json={"name": "Test", "member_ids": [999]}).status_code == 404
    direct = client.post('/api/conversations', headers=owner, json={"recipient_id": bob["id"]}).json()
    assert direct["type"] == 'direct' and direct["owner_ids"] == [] and direct["name"] is None
    assert client.post(f'/api/groups/{direct["id"]}/rename', headers=owner, json={"name": "No"}).status_code == 404
