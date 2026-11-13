"""Event service behavior against Postgres: materialization, edits, and queries."""

import datetime as dt
from zoneinfo import ZoneInfo

import pytest
from cats.database.models import EventOccurrence, EventSeries
from cats.database.models.event import EventType
from cats.events import service
from cats.events.recurrence import build_rrule, expand_occurrences
from cats.events.service import EventError
from sqlalchemy import func, select

TZ_NAME = "America/Chicago"
CHICAGO = ZoneInfo(TZ_NAME)
NOW = dt.datetime(
    2027, 1, 1, 12, tzinfo=dt.UTC
)  # Jan 1 in Chicago too; horizon is 2028-01-01
MWF = build_rrule(freq="WEEKLY", by_weekday=["MO", "WE", "FR"])


def make(session, owner_id, **overrides):
    fields = {
        "event_type": "class",
        "title": "Senior Design I",
        "owner_id": owner_id,
        "timezone": TZ_NAME,
        "start_date": dt.date(2027, 1, 4),  # a Monday
        "start_time": dt.time(9, 0),
        "duration_min": 50,
        "location": "Pearce Hall 137",
        "rrule": MWF,
        "now": NOW,
    }
    fields.update(overrides)
    return service.create_series(session, **fields)


def local_dates(occurrences):
    return [o.start_at.astimezone(CHICAGO).date() for o in occurrences]


def original_starts(occurrences):
    return {o.original_start for o in occurrences}


def control_starts(series_kwargs, window_end=dt.date(2028, 1, 1)):
    """What a single unbroken series would produce, straight from the expander."""
    return {
        t.original_start
        for t in expand_occurrences(
            timezone=TZ_NAME,
            start_date=series_kwargs["start_date"],
            start_time=dt.time(9, 0),
            duration_min=50,
            rrule=series_kwargs["rrule"],
            window_start=series_kwargs["start_date"],
            window_end=window_end,
        )
    }


def count_rows(session, series_id):
    return session.scalar(
        select(func.count())
        .select_from(EventOccurrence)
        .where(EventOccurrence.series_id == series_id)
    )


# --- creating and materializing ----------------------------------------------------


def test_one_off_event_has_one_series_row_and_one_occurrence(session, owner_id):
    # Far past the 12-month horizon, but a one-off always gets its single occurrence.
    series = make(session, owner_id, rrule=None, start_date=dt.date(2028, 6, 1))

    assert series.rrule is None
    assert session.scalar(select(func.count()).select_from(EventSeries)) == 1
    (occurrence,) = service.occurrences_for_series(session, series.id)
    assert occurrence.start_at == occurrence.original_start
    assert occurrence.status == "scheduled"
    assert occurrence.end_at - occurrence.start_at == dt.timedelta(minutes=50)


def test_weekly_class_across_dst_stays_nine_am_local(session, owner_id):
    rrule = build_rrule(freq="WEEKLY", by_weekday=["MO", "WE", "FR"], count=6)
    series = make(session, owner_id, start_date=dt.date(2027, 3, 8), rrule=rrule)

    occurrences = service.occurrences_for_series(session, series.id)
    assert len(occurrences) == 6
    assert {o.start_at.astimezone(CHICAGO).time() for o in occurrences} == {
        dt.time(9, 0)
    }
    by_day = {
        d.day: o.start_at.astimezone(dt.UTC).hour
        for d, o in zip(local_dates(occurrences), occurrences)
    }
    assert (
        by_day[12] == 15 and by_day[15] == 14
    )  # UTC offset changed, local time did not


def test_monthly_on_the_31st_skips_short_months(session, owner_id):
    series = make(
        session,
        owner_id,
        start_date=dt.date(2027, 1, 31),
        rrule="FREQ=MONTHLY;BYMONTHDAY=31",
    )
    months = [
        d.month for d in local_dates(service.occurrences_for_series(session, series.id))
    ]
    assert months == [1, 3, 5, 7, 8, 10, 12]


def test_monthly_on_the_last_day_includes_every_month(session, owner_id):
    rrule = build_rrule(freq="MONTHLY", last_day_of_month=True)
    series = make(session, owner_id, start_date=dt.date(2027, 1, 31), rrule=rrule)
    months = [
        d.month for d in local_dates(service.occurrences_for_series(session, series.id))
    ]
    assert months == list(range(1, 13))


def test_second_tuesday_club_meeting(session, owner_id):
    rrule = build_rrule(freq="MONTHLY", nth_weekday=(2, "TU"))
    series = make(
        session,
        owner_id,
        event_type="club",
        start_date=dt.date(2027, 1, 12),
        rrule=rrule,
    )
    dates = local_dates(service.occurrences_for_series(session, series.id))
    assert len(dates) == 12
    assert all(d.weekday() == 1 and 8 <= d.day <= 14 for d in dates)


def test_generation_stops_at_the_horizon_and_records_generated_until(session, owner_id):
    series = make(session, owner_id)
    assert series.generated_until == dt.date(2028, 1, 1)
    assert max(
        local_dates(service.occurrences_for_series(session, series.id))
    ) <= dt.date(2028, 1, 1)


def test_finite_series_ends_at_its_rule_not_the_horizon(session, owner_id):
    rrule = build_rrule(freq="WEEKLY", by_weekday=["MO"], count=3)
    series = make(session, owner_id, rrule=rrule)
    assert len(service.occurrences_for_series(session, series.id)) == 3
    assert series.generated_until == dt.date(2027, 1, 18)


def test_open_ended_series_is_extended_by_the_job_without_duplicates(session, owner_id):
    series = make(session, owner_id)
    before = count_rows(session, series.id)

    later = dt.datetime(2027, 4, 1, 12, tzinfo=dt.UTC)
    added = service.extend_series_occurrences(session, now=later)
    session.refresh(series)

    assert added > 0
    assert series.generated_until == dt.date(2028, 4, 1)
    rows = service.occurrences_for_series(session, series.id)
    assert len(rows) == before + added
    assert len(original_starts(rows)) == len(rows)  # no duplicates
    assert original_starts(rows) == control_starts(
        {"start_date": series.start_date, "rrule": series.rrule}, dt.date(2028, 4, 1)
    )

    assert (
        service.extend_series_occurrences(session, now=later) == 0
    )  # rerun adds nothing
    assert count_rows(session, series.id) == len(rows)


def test_invalid_input_is_rejected(session, owner_id):
    with pytest.raises(ValueError):
        make(session, owner_id, rrule="FREQ=NOPE")
    with pytest.raises(ValueError):
        make(session, owner_id, timezone="Mars/Olympus")
    with pytest.raises(ValueError):
        make(session, owner_id, title="  ")
    with pytest.raises(ValueError):
        make(session, owner_id, duration_min=0)
    with pytest.raises(ValueError):
        make(session, owner_id, details={"not_a_class_field": 1})
    with pytest.raises(ValueError):
        make(session, owner_id, event_type="nonsense")


def test_event_type_accepts_enum_members_and_their_lowercase_strings(session, owner_id):
    by_enum = make(session, owner_id, event_type=EventType.CLUB, rrule=None)
    by_text = make(session, owner_id, event_type="club", rrule=None)
    session.expire_all()

    assert by_enum.event_type == by_text.event_type == "club"
    assert {t.value for t in EventType} == {"class", "club", "meeting", "work"}
    with pytest.raises(ValueError):
        make(session, owner_id, event_type="CLUB", rrule=None)  # values are lowercase


def test_details_are_validated_and_stored(session, owner_id):
    series = make(session, owner_id, details={"course_code": "CPS 410", "section": 1})
    assert series.details == {"course_code": "CPS 410", "section": 1}


# --- editing one occurrence --------------------------------------------------------


def test_cancelled_occurrence_stays_cancelled_after_regeneration(session, owner_id):
    series = make(session, owner_id)
    target = service.occurrences_for_series(session, series.id)[2]
    total = count_rows(session, series.id)

    service.cancel_occurrence(session, target.id)
    added = service.materialize_series(
        session, series, now=NOW, regenerate_from=series.start_date
    )

    assert added == 0
    assert count_rows(session, series.id) == total
    session.refresh(target)
    assert target.status == "cancelled"


def test_moving_one_occurrence_keeps_original_start_and_length(session, owner_id):
    series = make(session, owner_id)
    target = service.occurrences_for_series(session, series.id)[3]
    original = target.original_start

    moved = service.update_occurrence(
        session, target.id, start_at=target.start_at + dt.timedelta(hours=2)
    )

    assert moved.original_start == original
    assert moved.start_at == original + dt.timedelta(hours=2)
    assert moved.end_at - moved.start_at == dt.timedelta(minutes=50)
    with pytest.raises(EventError):
        service.update_occurrence(
            session, target.id, end_at=target.start_at - dt.timedelta(minutes=1)
        )


def test_range_query_excludes_cancelled_and_coalesces_overrides(
    session, owner_id, engine
):
    series = make(session, owner_id)
    first, second, third = service.occurrences_for_series(session, series.id)[:3]
    service.cancel_occurrence(session, second.id)
    service.update_occurrence(
        session, third.id, title_override="Exam", location_override="Gym"
    )

    entries = service.calendar_entries(
        session,
        owner_id,
        dt.datetime(2027, 1, 4, tzinfo=CHICAGO),
        dt.datetime(2027, 1, 9, tzinfo=CHICAGO),
    )

    assert [e.occurrence_id for e in entries] == [
        first.id,
        third.id,
    ]  # Mon and Fri; Wed cancelled
    assert (entries[0].title, entries[0].location) == (
        "Senior Design I",
        "Pearce Hall 137",
    )
    assert (entries[1].title, entries[1].location) == ("Exam", "Gym")
    assert (
        service.calendar_entries(
            session,
            owner_id + 999,
            dt.datetime(2027, 1, 1, tzinfo=dt.UTC),
            dt.datetime(2028, 1, 1, tzinfo=dt.UTC),
        )
        == []
    )


# --- editing the series ------------------------------------------------------------


def test_editing_all_keeps_moved_and_overridden_occurrences(session, owner_id):
    series = make(session, owner_id)
    rows = service.occurrences_for_series(session, series.id)
    moved, overridden, cancelled, plain = rows[1], rows[2], rows[3], rows[4]
    service.update_occurrence(
        session, moved.id, start_at=moved.start_at + dt.timedelta(hours=1)
    )
    service.update_occurrence(session, overridden.id, title_override="Exam")
    service.cancel_occurrence(session, cancelled.id)
    total = count_rows(session, series.id)
    moved_start = moved.start_at

    service.edit_series_all(session, series.id, now=NOW, title="Senior Design II")
    session.expire_all()

    assert count_rows(session, series.id) == total
    kept = {o.id: o for o in service.occurrences_for_series(session, series.id)}
    assert kept[moved.id].start_at == moved_start
    assert kept[overridden.id].title_override == "Exam"
    assert kept[cancelled.id].status == "cancelled"
    assert plain.id not in kept  # untouched ones were regenerated, with new ids
    assert session.get(EventSeries, series.id).title == "Senior Design II"
    titles = {
        e.title
        for e in service.calendar_entries(
            session, owner_id, NOW, dt.datetime(2028, 6, 1, tzinfo=dt.UTC)
        )
    }
    assert titles == {"Senior Design II", "Exam"}


def test_editing_all_never_touches_past_occurrences(session, owner_id):
    series = make(session, owner_id)
    feb_first = dt.datetime(2027, 2, 1, tzinfo=dt.UTC)
    past_ids = {
        o.id: o.start_at
        for o in service.occurrences_for_series(session, series.id)
        if o.start_at < feb_first
    }

    service.edit_series_all(
        session, series.id, now=feb_first, start_time=dt.time(10, 30)
    )
    session.expire_all()

    rows = service.occurrences_for_series(session, series.id)
    assert {
        o.id: o.start_at for o in rows if o.id in past_ids
    } == past_ids  # same rows, same times
    future = [o for o in rows if o.id not in past_ids]
    assert future and all(o.start_at >= feb_first for o in future)
    assert {o.start_at.astimezone(CHICAGO).time() for o in future} == {dt.time(10, 30)}
    assert {
        o.start_at.astimezone(CHICAGO).time() for o in rows if o.id in past_ids
    } == {dt.time(9, 0)}


def test_edit_rejects_unknown_fields(session, owner_id):
    series = make(session, owner_id)
    with pytest.raises(EventError):
        service.edit_series_all(session, series.id, now=NOW, owner_id=999)
    with pytest.raises(EventError):
        service.edit_series_all(session, 123456789, now=NOW, title="x")


@pytest.mark.parametrize(
    "split_date", [dt.date(2027, 2, 3), dt.date(2027, 2, 2)]
)  # a Wed, and a Tue
def test_split_makes_two_series_with_no_overlap_and_no_gap(
    session, owner_id, split_date
):
    series = make(session, owner_id)
    whole = control_starts({"start_date": series.start_date, "rrule": series.rrule})

    old, new = service.edit_series_following(
        session, series.id, split_date, now=NOW, title="Part two"
    )

    old_rows = service.occurrences_for_series(session, old.id)
    new_rows = service.occurrences_for_series(session, new.id)
    assert "UNTIL=" in old.rrule and old.id != new.id
    assert max(local_dates(old_rows)) < split_date <= min(local_dates(new_rows))
    assert new.start_date == dt.date(
        2027, 2, 3
    )  # first real occurrence on or after the split
    assert original_starts(old_rows).isdisjoint(original_starts(new_rows))
    assert original_starts(old_rows) | original_starts(new_rows) == whole
    assert (old.title, new.title) == ("Senior Design I", "Part two")


def test_split_of_a_counted_series_does_not_repeat_the_count(session, owner_id):
    rrule = build_rrule(freq="WEEKLY", by_weekday=["MO", "WE", "FR"], count=10)
    series = make(session, owner_id, rrule=rrule)
    whole = control_starts({"start_date": series.start_date, "rrule": rrule})

    old, new = service.edit_series_following(
        session, series.id, dt.date(2027, 1, 13), now=NOW, location="Room 2"
    )

    rows = service.occurrences_for_series(
        session, old.id
    ) + service.occurrences_for_series(session, new.id)
    assert len(rows) == 10
    assert original_starts(rows) == whole
    assert new.location == "Room 2"


def test_split_with_a_new_rule_starts_at_the_split_date(session, owner_id):
    series = make(session, owner_id)
    tuesdays = build_rrule(freq="WEEKLY", by_weekday=["TU"])

    old, new = service.edit_series_following(
        session, series.id, dt.date(2027, 2, 3), now=NOW, rrule=tuesdays
    )

    assert new.start_date == dt.date(2027, 2, 3)
    assert min(local_dates(service.occurrences_for_series(session, new.id))) == dt.date(
        2027, 2, 9
    )
    assert max(local_dates(service.occurrences_for_series(session, old.id))) == dt.date(
        2027, 2, 1
    )


def test_split_keeps_edited_occurrences_and_removes_untouched_future_ones(
    session, owner_id
):
    series = make(session, owner_id)
    rows = service.occurrences_for_series(session, series.id)
    after_split = [o for o in rows if local_dates([o])[0] >= dt.date(2027, 2, 3)]
    cancelled = after_split[1]
    service.cancel_occurrence(session, cancelled.id)

    old, _ = service.edit_series_following(
        session, series.id, dt.date(2027, 2, 3), now=NOW, title="Part two"
    )
    session.expire_all()

    remaining = service.occurrences_for_series(session, old.id)
    assert [o.id for o in remaining if local_dates([o])[0] >= dt.date(2027, 2, 3)] == [
        cancelled.id
    ]


def test_split_validation(session, owner_id):
    series = make(session, owner_id)
    with pytest.raises(EventError):
        service.edit_series_following(
            session, series.id, series.start_date, now=NOW, title="x"
        )
    with pytest.raises(EventError):
        service.edit_series_following(
            session, series.id, dt.date(2026, 6, 1), now=NOW, title="x"
        )
    one_off = make(session, owner_id, rrule=None)
    with pytest.raises(EventError):
        service.edit_series_following(
            session, one_off.id, dt.date(2027, 2, 1), now=NOW, title="x"
        )


def test_deleting_a_series_deletes_its_occurrences(session, owner_id):
    series = make(session, owner_id)
    other = make(session, owner_id, title="Other")
    series_id = series.id
    assert count_rows(session, series_id) > 0

    service.delete_series(session, series_id)

    assert count_rows(session, series_id) == 0
    assert count_rows(session, other.id) > 0


def test_a_user_who_owns_events_cannot_be_deleted(session, owner_id):
    from cats.database.models import User
    from sqlalchemy.exc import IntegrityError

    make(session, owner_id)
    session.delete(session.get(User, owner_id))
    with pytest.raises(IntegrityError):
        session.flush()
