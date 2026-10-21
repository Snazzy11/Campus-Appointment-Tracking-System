from datetime import date
import pytest
from app.routers import schedules
from app.services.schedule_import import parse_csv
from test_mobile_api import client as client, login

HEADER = 'Section,Course,Title,Credits,Days,Time,Dates,Location,Delivery,Instructor\n'
ROW = '1,CPS 410,Senior Design I,3,M W F,10:00 AM - 10:50 AM,8/31/26 - 12/18/26,Pearce Hall 137,Face to Face,"Kinnicutt, Patrick"\n'
TERM = dict(season='Fall', year=2026, start_date='2026-08-31', end_date='2026-12-18')


@pytest.fixture(autouse=True)
def today(monkeypatch):
    monkeypatch.setattr(schedules, 'campus_today', lambda: date(2026, 10, 13))


def preview(client, headers, csv=HEADER + ROW, term=TERM):
    response = client.post('/api/schedule/preview', headers=headers, json={'term': term, 'csv': csv})
    assert response.status_code == 200, response.text
    return response.json()


def save(client, headers, csv=HEADER + ROW, term=TERM, result=None):
    result = result or preview(client, headers, csv, term)
    return client.post('/api/schedule/import', headers=headers, json={'term': term, 'csv': csv, 'version': result['version'], 'sections': [c['section'] for c in result['courses']]})


def test_private_roundtrip_add_duplicate_change_and_remove(client):
    alice, _ = login(client, 'alice')
    bob, _ = login(client, 'bob')
    assert client.get('/api/schedule').status_code == 401
    assert client.post('/api/schedule/import', json={}).status_code == 401
    assert preview(client, alice)['courses'][0]['status'] == 'new'
    assert client.get('/api/schedule', headers=alice).json()['terms'] == []
    assert save(client, alice).json() == {'added': 1, 'updated': 0}
    assert preview(client, alice)['courses'][0]['status'] == 'duplicate'
    assert save(client, alice).json() == {'added': 0, 'updated': 0}
    added = HEADER + ROW.replace('1,CPS 410', '2,CPS 450')
    assert save(client, alice, added).json()['added'] == 1
    changed = HEADER + ROW.replace('Pearce Hall 137', 'Pearce Hall 424')
    result = preview(client, alice, changed)
    assert result['courses'][0]['status'] == 'changed'
    assert result['courses'][0]['previous']['meetings'][0]['location'] == 'Pearce Hall 137'
    assert save(client, alice, changed).json()['updated'] == 1
    terms = client.get('/api/schedule', headers=alice).json()['terms']
    assert len(terms[0]['courses']) == 2
    assert client.get('/api/schedule', headers=bob).json()['terms'] == []
    course_id = terms[0]['courses'][0]['id']
    assert client.post(f'/api/schedule/courses/{course_id}/remove', headers=bob).status_code == 404
    assert client.post(f'/api/schedule/courses/{course_id}/remove', headers=alice).status_code == 200


def test_ended_terms_hidden_and_cannot_reactivate(client, monkeypatch):
    alice, _ = login(client, 'alice')
    assert save(client, alice).status_code == 200
    monkeypatch.setattr(schedules, 'campus_today', lambda: date(2026, 12, 18))
    assert len(client.get('/api/schedule', headers=alice).json()['terms']) == 1
    monkeypatch.setattr(schedules, 'campus_today', lambda: date(2026, 12, 19))
    assert client.get('/api/schedule', headers=alice).json()['terms'] == []
    assert client.post('/api/schedule/preview', headers=alice, json={'term': {**TERM, 'end_date': '2026-12-31'}, 'csv': HEADER + ROW}).status_code == 422
    assert client.post('/api/schedule/courses/1/remove', headers=alice).status_code == 404


def test_term_isolation_and_bounds(client):
    alice, _ = login(client, 'alice')
    assert save(client, alice).status_code == 200
    spring = dict(season='Spring', year=2027, start_date='2027-01-11', end_date='2027-05-07')
    spring_csv = HEADER + ROW.replace('8/31/26 - 12/18/26', '1/11/27 - 5/7/27')
    assert save(client, alice, spring_csv, spring).json()['added'] == 1
    assert len(client.get('/api/schedule', headers=alice).json()['terms']) == 2
    invalid = preview(client, alice, HEADER + ROW.replace('8/31/26', '8/30/26'))
    assert not invalid['courses'] and invalid['issues']
    assert client.post('/api/schedule/preview', headers=alice, json={'term': {**TERM, 'start_date': '2026-09-01'}, 'csv': HEADER + ROW}).status_code == 409


def test_stale_preview_does_not_overwrite(client):
    alice, _ = login(client, 'alice')
    old = preview(client, alice)
    assert save(client, alice, HEADER + ROW.replace('1,CPS 410', '2,CPS 450')).status_code == 200
    assert save(client, alice, result=old).status_code == 409


def test_multimeeting_async_quoted_bom_and_duplicate_rows():
    csv = '\ufeff' + HEADER + ROW + ROW + ROW.replace('M W F,10:00 AM - 10:50 AM', 'W,12:00 PM - 2:50 PM')
    courses, issues = parse_csv(csv)
    assert not issues and len(courses) == 1 and len(courses[0]['meetings']) == 2
    assert courses[0]['instructor'] == 'Kinnicutt, Patrick'
    csv = HEADER + ROW.replace('M W F,10:00 AM - 10:50 AM', ',').replace('Face to Face', 'Online Asynchronous')
    courses, issues = parse_csv(csv)
    assert not issues and courses[0]['meetings'][0]['start'] is None
    csv = HEADER + ROW.replace('M W F,10:00 AM - 10:50 AM', '"M W F\nW","10:00 AM - 10:50 AM\n12:00 PM - 2:50 PM"')
    assert len(parse_csv(csv)[0][0]['meetings']) == 2


@pytest.mark.parametrize('replacement', ['T,10:00 AM - 10:50 AM', 'M,11:00 AM - 10:00 AM', ',TBA', 'M W F,W,10:00 AM - 10:50 AM'])
def test_bad_lab_excludes_entire_section(replacement):
    courses, issues = parse_csv(HEADER + ROW + ROW.replace('M W F,10:00 AM - 10:50 AM', replacement))
    assert not courses and issues[0]['row'] == 3


def test_reject_bad_dates_and_headers():
    assert parse_csv(HEADER + ROW.replace('8/31/26', '2/30/26'))[1]
    with pytest.raises(ValueError):
        parse_csv('wrong,header\nx,y')


def test_exact_registration_csv_and_lab(client):
    from pathlib import Path
    csv = Path(__file__).with_name('fixtures').joinpath('registration-schedule.csv').read_text(encoding='utf-8-sig')
    courses, issues = parse_csv(csv)
    assert not issues and len(courses) == 6
    assert sum(c['credits'] for c in courses) == 19
    bio = next(c for c in courses if c['course'] == 'BIO 213')
    assert len(bio['meetings']) == 2
    lab = next(m for m in bio['meetings'] if m['location'] == 'Biosciences Building 2016')
    assert lab == dict(days=[2], start=720, end=890, start_date='2026-08-31', end_date='2026-12-18', location='Biosciences Building 2016')
    alice, _ = login(client, 'alice')
    assert save(client, alice, csv).json()['added'] == 6
    stored = client.get('/api/schedule', headers=alice).json()['terms'][0]['courses']
    assert next(c for c in stored if c['course'] == 'BIO 213')['meetings'] == bio['meetings']
    assert all(c['status'] == 'duplicate' for c in preview(client, alice, csv)['courses'])


def test_continuations_reject_orphans_and_do_not_drop_bad_labs():
    lab = ',,,,W,12:00 PM - 2:50 PM,,Lab 2016,,\n'
    assert not parse_csv(HEADER + lab)[0]
    assert parse_csv(HEADER + lab)[1]
    courses, issues = parse_csv(HEADER + ROW + lab.replace('12:00 PM - 2:50 PM', 'TBA'))
    assert not courses and issues
    assert len(parse_csv(HEADER + ROW + lab)[0][0]['meetings']) == 2


def test_individual_event_crud_privacy_bounds_and_versions(client, monkeypatch):
    alice, _ = login(client, 'alice')
    bob, _ = login(client, 'bob')
    term = client.post('/api/schedule/terms', headers=alice, json=TERM).json()['id']
    assert client.get('/api/schedule', headers=alice).json()['terms'][0]['courses'] == []
    payload = dict(title='Study group', date='2026-10-14', start=900, end=960, location='Pearce Hall 137', notes='Bring notes')
    assert client.post(f'/api/schedule/terms/{term}/events', headers=bob, json=payload).status_code == 404
    assert client.post(f'/api/schedule/terms/{term}/events', headers=alice, json={**payload, 'end': 899}).status_code == 422
    assert client.post(f'/api/schedule/terms/{term}/events', headers=alice, json={**payload, 'date': '2026-12-19'}).status_code == 422
    result = client.post(f'/api/schedule/terms/{term}/events', headers=alice, json=payload)
    assert result.status_code == 200, result.text
    event = result.json()
    assert len(client.get('/api/schedule', headers=alice).json()['terms'][0]['events']) == 1
    path = f"/api/schedule/events/{event['id']}"
    assert client.post(path, headers=bob, json={**payload, 'version': 1}).status_code == 404
    assert client.post(path, headers=alice, json={**payload, 'title': 'Updated', 'version': 1}).json()['version'] == 2
    assert client.post(path, headers=alice, json={**payload, 'version': 1}).status_code == 409
    assert client.post(path + '/remove', headers=alice, json={'version': 1}).status_code == 409
    assert client.post(path + '/remove', headers=bob, json={'version': 2}).status_code == 404
    assert client.post(path + '/remove', headers=alice, json={'version': 2}).status_code == 200
    assert client.get('/api/schedule', headers=alice).json()['terms'][0]['events'] == []
    another = client.post(f'/api/schedule/terms/{term}/events', headers=alice, json=payload).json()
    monkeypatch.setattr(schedules, 'campus_today', lambda: date(2026, 12, 19))
    assert client.get('/api/schedule', headers=alice).json()['terms'] == []
    assert client.post(f"/api/schedule/events/{another['id']}", headers=alice, json={**payload, 'version': 1}).status_code == 404


def test_event_location_optional_pin_clear_and_building_validation(client, monkeypatch):
    alice, _ = login(client, 'alice')
    term = client.post('/api/schedule/terms', headers=alice, json=TERM).json()['id']
    base = dict(title='Meet up', date='2026-10-14', start=900, end=960)
    path = f'/api/schedule/terms/{term}/events'
    event = client.post(path, headers=alice, json=base).json()
    assert event['place'] is None and event['location'] == ''
    pin = dict(kind='pin', longitude=-84.775, latitude=43.59)
    saved = client.post(f"/api/schedule/events/{event['id']}", headers=alice, json={**base, 'place': pin, 'version': 1}).json()
    assert saved['place'] == pin
    assert client.post(path, headers=alice, json={**base, 'place': {**pin, 'latitude': 0}}).status_code == 422
    cleared = client.post(f"/api/schedule/events/{event['id']}", headers=alice, json={**base, 'place': None, 'version': 2}).json()
    assert cleared['place'] is None
    from app.geospatial import database
    from app.routers import geographic
    from fastapi import HTTPException
    def geo():
        yield object()
    def building(identifier, db):
        if identifier != 42:
            raise HTTPException(404, 'Building not found')
        return {'properties': {'name': 'Pearce Hall'}}
    monkeypatch.setattr(database, 'get_geo_db', geo)
    monkeypatch.setattr(geographic, 'building', building)
    selected = client.post(path, headers=alice, json={**base, 'place': {'kind': 'building', 'id': 42, 'label': 'Untrusted label'}})
    assert selected.status_code == 200
    assert selected.json()['place']['label'] == 'Pearce Hall'
    assert client.post(path, headers=alice, json={**base, 'place': {'kind': 'building', 'id': 43}}).status_code == 404
