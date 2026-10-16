from datetime import date
from test_mobile_api import client as client, login
from test_schedules import save
from app.services.chat_calendar import common_free


def setup(client):
    alice, a = login(client, 'alice')
    bob, b = login(client, 'bob')
    outsider, _ = login(client, 'eve')
    cid = client.post('/api/conversations', headers=alice, json={'recipient_id': b['id']}).json()['id']
    for headers in (alice, bob):
        assert save(client, headers).status_code == 200
    return alice, bob, outsider, a, b, cid


def test_snapshot_and_ownership(client):
    alice, bob, outsider, a, b, cid = setup(client)
    response = client.post(f'/api/chat/{cid}/cards', headers=alice, json={'kind': 'schedule', 'scope': 'day', 'date': '2026-10-16'})
    assert response.status_code == 201, response.text
    msg = response.json()
    assert msg['attachment']['entries'][0]['title'] == 'CPS 410'
    history = client.get(f'/api/conversations/{cid}/messages', headers=bob).json()
    assert history[0]['attachment'] == msg['attachment']
    assert client.post(f'/api/chat/{cid}/cards', headers=outsider, json={'kind': 'schedule', 'date': '2026-10-16'}).status_code == 404
    path = f"/api/chat/messages/{msg['id']}"
    assert client.post(path+'/edit', headers=bob, json={'version': 1, 'text': 'tamper'}).status_code == 403
    assert client.post(path+'/edit', headers=alice, json={'version': 1, 'text': 'My Friday'}).json()['edited']
    assert client.post(path+'/remove', headers=alice, json={'version': 1}).status_code == 409
    removed = client.post(path+'/remove', headers=alice, json={'version': 2}).json()
    assert removed['attachment'] is None and removed['kind'] == 'deleted'


def test_opt_in_privacy_withdrawal_and_scope(client):
    alice, bob, outsider, a, b, cid = setup(client)
    card = client.post(f'/api/chat/{cid}/cards', headers=alice, json={'kind': 'availability', 'scope': 'week', 'date': '2026-10-16'}).json()
    path = f"/api/chat/cards/{card['id']}"
    payload = dict(user_ids=[a['id'], b['id']], start_date='2026-10-16', end_date='2026-10-16')
    assert client.post(path+'/availability', headers=alice, json=payload).status_code == 403
    for headers in (alice, bob):
        assert client.post(path+'/consent', headers=headers, json={'participate': True}).status_code == 200
    response = client.post(path+'/availability', headers=alice, json=payload)
    assert response.status_code == 200, response.text
    assert response.json()['windows'] == [dict(date='2026-10-16', start=480, end=600), dict(date='2026-10-16', start=650, end=1320)]
    assert 'CPS' not in response.text and 'Pearce' not in response.text
    assert client.post(path+'/availability', headers=outsider, json=payload).status_code == 404
    assert client.post(path+'/availability', headers=alice, json={**payload, 'end_date': '2026-11-01'}).status_code == 422
    client.post(path+'/consent', headers=bob, json={'participate': False})
    assert client.post(path+'/availability', headers=alice, json=payload).status_code == 403


def test_unknown_schedule_is_not_free(client):
    alice, bob, _, a, b, cid = setup(client)
    term = client.get('/api/schedule', headers=alice).json()['terms'][0]
    card = client.post(f'/api/chat/{cid}/cards', headers=alice, json={'kind': 'availability', 'scope': 'term', 'date': '2026-10-16', 'term_id': term['id']}).json()
    path = f"/api/chat/cards/{card['id']}"
    # End the participant's term before the queried day.
    from app.main import app
    from app.services.db_dependency import get_db
    from app.models.schedule import ScheduleTerm
    from sqlalchemy import select
    with next(app.dependency_overrides[get_db]()) as db:
        t = db.scalar(select(ScheduleTerm).where(ScheduleTerm.user_id == b['id']))
        t.end_date = date(2026, 10, 15)
        db.commit()
    for headers in (alice, bob):
        client.post(path+'/consent', headers=headers, json={'participate': True})
    assert client.post(path+'/availability', headers=alice, json=dict(user_ids=[a['id'], b['id']], start_date='2026-10-16', end_date='2026-10-16')).status_code == 422


def test_overlapping_busy_times_and_short_gaps():
    day = date(2026, 11, 1)  # DST boundary: date-only minutes stay campus-local.
    busy = [[dict(date=str(day), start=500, end=600), dict(date=str(day), start=580, end=700)], [dict(date=str(day), start=720, end=800)]]
    assert common_free(busy, day, day, 480, 900) == [dict(date=str(day), start=800, end=900)]


def test_public_edit_delete_and_private_notifications(client):
    from app.services.private_events import private_events
    alice, bob, _, a, b, cid = setup(client)
    queue = private_events.subscribe(b['id'])
    msg = client.post(f'/api/conversations/{cid}/messages', headers=alice, json={'text': 'before'}).json()
    assert queue.get_nowait()['text'] == 'before'
    path = f"/api/chat/messages/{msg['id']}"
    assert client.post(path+'/edit', headers=alice, json={'version': 1, 'text': 'after'}).status_code == 200
    assert queue.get_nowait()['text'] == 'after'
    assert client.post(path+'/remove', headers=alice, json={'version': 2}).status_code == 200
    assert queue.get_nowait()['kind'] == 'deleted'
    msg = client.post('/api/data', headers=alice, json={'text': 'public owned'}).json()
    path = f"/api/chat/messages/{msg['id']}"
    assert client.post(path+'/remove', headers=bob, json={'version': 1}).status_code == 403
    assert client.post(path+'/edit', headers=alice, json={'version': 1, 'text': 'updated public'}).status_code == 200
    assert client.get('/api/data').json()[-1]['edited']


def test_removed_member_loses_consent_even_when_readded(client, monkeypatch):
    from app.routers import groups, conversations
    monkeypatch.setattr(groups, 'SessionLocal', conversations.SessionLocal)
    alice, bob, _, a, b, _ = setup(client)
    cid = client.post('/api/groups', headers=alice, json={'name': 'Study', 'member_ids': [b['id']]}).json()['id']
    card = client.post(f'/api/chat/{cid}/cards', headers=alice, json={'kind': 'availability', 'scope': 'day', 'date': '2026-10-16'}).json()
    path = f"/api/chat/cards/{card['id']}"
    client.post(path+'/consent', headers=bob, json={'participate': True})
    assert client.post(f'/api/groups/{cid}/remove-member', headers=alice, json={'user_id': b['id']}).status_code == 200
    assert client.get(path+'/participants', headers=bob).status_code == 404
    assert client.post(f'/api/groups/{cid}/members', headers=alice, json={'user_id': b['id']}).status_code == 200
    assert b['id'] not in client.get(path+'/participants', headers=bob).json()['user_ids']
