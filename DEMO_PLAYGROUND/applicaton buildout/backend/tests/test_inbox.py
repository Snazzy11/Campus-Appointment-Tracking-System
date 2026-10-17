from app.routers import conversations, groups
from test_mobile_api import client as client, login


def test_inbox_previews_are_latest_bounded_and_membership_scoped(client):
    owner, _ = login(client, 'alice')
    peer, bob = login(client, 'bob')
    outsider, _ = login(client, 'eve')
    chat = client.post('/api/conversations', headers=owner, json={'recipient_id': bob['id']}).json()
    assert chat['last_message'] is None
    path = f"/api/conversations/{chat['id']}/messages"
    client.post(path, headers=owner, json={'text': 'Earlier'})
    sent = client.post(path, headers=peer, json={'text': 'x' * 300}).json()
    rows = client.get('/api/conversations', headers=owner).json()
    assert rows[0]['last_message']['id'] == sent['id']
    assert rows[0]['last_message']['text'] == 'x' * 160
    assert client.get(path, headers=owner).json()[-1]['text'] == 'x' * 300
    assert client.get('/api/conversations', headers=outsider).json() == []
    assert client.get('/api/conversations').status_code == 401


def test_group_status_is_latest_preview_and_removed_members_cannot_read_it(client, monkeypatch):
    monkeypatch.setattr(groups, "SessionLocal", conversations.SessionLocal)
    owner, _ = login(client, 'alice')
    peer, bob = login(client, 'bob')
    group = client.post('/api/groups', headers=owner, json={'name': 'Study', 'member_ids': [bob['id']]}).json()
    root = f"/api/groups/{group['id']}"
    client.post(root + '/rename', headers=owner, json={'name': 'New study'})
    rows = client.get('/api/conversations', headers=peer).json()
    assert rows[0]['last_message']['kind'] == 'system'
    assert 'New study' in rows[0]['last_message']['text']
    client.post(root + '/remove-member', headers=owner, json={'user_id': bob['id']})
    assert client.get('/api/conversations', headers=peer).json() == []
