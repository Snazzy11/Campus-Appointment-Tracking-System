"""Tests for the /events endpoints, run against a real Postgres."""

import datetime as dt

import pytest
from cats.api.main import app
from cats.database.database import get_db
from cats.events import service
from cats.events.recurrence import build_rrule
from fastapi.testclient import TestClient

NOW = dt.datetime(2027, 1, 1, 12, tzinfo=dt.UTC)
JAN_4 = "2027-01-04T00:00:00-06:00"  # Monday, midnight in Chicago
JAN_9 = "2027-01-09T00:00:00-06:00"


@pytest.fixture
def client(session):
    app.dependency_overrides[get_db] = lambda: session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def series(session, owner_id):
    return service.create_series(
        session,
        event_type="class",
        title="Senior Design I",
        owner_id=owner_id,
        timezone="America/Chicago",
        start_date=dt.date(2027, 1, 4),
        start_time=dt.time(10, 0),
        duration_min=50,
        location="Pearce Hall 137",
        details={"course_code": "CPS 410"},
        rrule=build_rrule(freq="WEEKLY", by_weekday=["MO", "WE", "FR"]),
        now=NOW,
    )


def week(client, owner_id):
    return client.get(
        "/events", params={"owner_id": owner_id, "start": JAN_4, "end": JAN_9}
    )


def test_list_returns_flattened_meetings(client, session, owner_id, series):
    first, second, third = service.occurrences_for_series(session, series.id)[:3]
    service.cancel_occurrence(session, second.id)
    service.update_occurrence(session, third.id, title_override="Exam")

    response = week(client, owner_id)

    assert response.status_code == 200
    events = response.json()
    assert [e["occurrence_id"] for e in events] == [first.id, third.id]
    assert events[0] == {
        "occurrence_id": first.id,
        "series_id": series.id,
        "event_type": "class",
        "title": "Senior Design I",
        "location": "Pearce Hall 137",
        "start_at": "2027-01-04T16:00:00Z",  # 10:00 in Chicago
        "end_at": "2027-01-04T16:50:00Z",
        "status": "scheduled",
        "is_recurring": True,
        "details": {"course_code": "CPS 410"},
    }
    assert events[1]["title"] == "Exam"


def test_list_only_shows_the_owners_events(client, owner_id, series):
    response = client.get(
        "/events", params={"owner_id": owner_id + 1, "start": JAN_4, "end": JAN_9}
    )
    assert response.json() == []


@pytest.mark.parametrize(
    ("start", "end"),
    [
        ("2027-01-04T00:00:00", JAN_9),  # no timezone, so the moment is ambiguous
        (JAN_9, JAN_4),  # backwards
        ("2027-01-01T00:00:00Z", "2028-06-01T00:00:00Z"),  # too long
    ],
)
def test_list_rejects_bad_ranges(client, owner_id, start, end):
    response = client.get(
        "/events", params={"owner_id": owner_id, "start": start, "end": end}
    )
    assert response.status_code == 422


def test_get_one_includes_cancelled_meetings(client, session, series):
    occurrence = service.occurrences_for_series(session, series.id)[1]
    service.cancel_occurrence(session, occurrence.id)

    response = client.get(f"/events/{occurrence.id}")

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    assert response.json()["series_id"] == series.id


def test_get_one_off_is_not_recurring(client, session, owner_id):
    one_off = service.create_series(
        session,
        event_type="meeting",
        title="Advisor meeting",
        owner_id=owner_id,
        timezone="America/Chicago",
        start_date=dt.date(2027, 1, 6),
        start_time=dt.time(14, 0),
        duration_min=30,
        now=NOW,
    )
    (occurrence,) = service.occurrences_for_series(session, one_off.id)

    response = client.get(f"/events/{occurrence.id}")

    assert response.json()["is_recurring"] is False
    assert response.json()["location"] is None


def test_get_missing_event_is_404(client):
    assert client.get("/events/999999999").status_code == 404
