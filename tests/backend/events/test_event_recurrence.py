"""Tests for recurrence rules and expanding them into meeting times (no database)."""

import datetime as dt
from zoneinfo import ZoneInfo

import pytest
from cats.events.recurrence import (
    RecurrenceError,
    build_rrule,
    end_before,
    expand_occurrences,
    last_occurrence_date,
    normalize_rrule,
    with_remaining_count,
)

CHICAGO = ZoneInfo("America/Chicago")
NINE = dt.time(9, 0)


def expand(rrule, start_date, window_end, *, window_start=None, tz="America/Chicago"):
    return expand_occurrences(
        timezone=tz,
        start_date=start_date,
        start_time=NINE,
        duration_min=50,
        rrule=rrule,
        window_start=window_start or start_date,
        window_end=window_end,
    )


def local_dates(times, tz=CHICAGO):
    return [t.start_at.astimezone(tz).date() for t in times]


def test_weekly_mwf_keeps_local_time_across_dst_and_utc_offset_changes():
    # US daylight saving time began Sunday 2027-03-14.
    rrule = build_rrule(freq="WEEKLY", by_weekday=["MO", "WE", "FR"], count=6)
    times = expand(rrule, dt.date(2027, 3, 8), dt.date(2027, 4, 1))

    assert local_dates(times) == [dt.date(2027, 3, d) for d in (8, 10, 12, 15, 17, 19)]
    assert {t.start_at.astimezone(CHICAGO).time() for t in times} == {NINE}
    utc_hours = {d.day: t.start_at.hour for d, t in zip(local_dates(times), times)}
    assert utc_hours[12] == 15  # CST, UTC-6
    assert utc_hours[15] == 14  # CDT, UTC-5


def test_end_is_start_plus_duration():
    (only,) = expand(None, dt.date(2027, 5, 3), dt.date(2027, 5, 3))
    assert only.end_at - only.start_at == dt.timedelta(minutes=50)
    assert only.original_start == only.start_at


def test_monthly_on_the_31st_skips_months_without_a_31st():
    times = expand(
        "FREQ=MONTHLY;BYMONTHDAY=31", dt.date(2027, 1, 31), dt.date(2027, 12, 31)
    )
    assert [d.month for d in local_dates(times)] == [1, 3, 5, 7, 8, 10, 12]
    assert {d.day for d in local_dates(times)} == {31}


def test_monthly_on_the_last_day_includes_every_month():
    rrule = build_rrule(freq="MONTHLY", last_day_of_month=True)
    assert rrule == "FREQ=MONTHLY;BYMONTHDAY=-1"
    times = expand(rrule, dt.date(2027, 1, 31), dt.date(2027, 12, 31))
    dates = local_dates(times)
    assert [d.month for d in dates] == list(range(1, 13))
    assert dates[1] == dt.date(2027, 2, 28)


def test_second_tuesday_of_the_month():
    rrule = build_rrule(freq="MONTHLY", nth_weekday=(2, "TU"))
    assert rrule == "FREQ=MONTHLY;BYDAY=2TU"
    dates = local_dates(expand(rrule, dt.date(2027, 1, 12), dt.date(2027, 12, 31)))
    assert len(dates) == 12
    assert all(d.weekday() == 1 and 8 <= d.day <= 14 for d in dates)


def test_daily_with_interval_and_count():
    times = expand(
        "FREQ=DAILY;INTERVAL=2;COUNT=4", dt.date(2027, 1, 1), dt.date(2027, 3, 1)
    )
    assert local_dates(times) == [dt.date(2027, 1, d) for d in (1, 3, 5, 7)]


def test_weekly_interval_two_weeks():
    times = expand(
        "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", dt.date(2027, 1, 4), dt.date(2027, 2, 28)
    )
    assert local_dates(times) == [
        dt.date(2027, 1, 4), dt.date(2027, 1, 18), dt.date(2027, 2, 1),
        dt.date(2027, 2, 15),
    ]  # fmt: skip


def test_yearly():
    times = expand("FREQ=YEARLY", dt.date(2027, 3, 15), dt.date(2030, 12, 31))
    assert local_dates(times) == [dt.date(y, 3, 15) for y in range(2027, 2031)]


def test_until_stops_the_series_and_open_ended_does_not():
    until = expand(
        "FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261215T000000Z",
        dt.date(2026, 12, 7),
        dt.date(2027, 6, 1),
    )
    assert local_dates(until)[-1] == dt.date(
        2026, 12, 14
    )  # Dec 15 00:00Z is Dec 14 evening
    assert len(expand("FREQ=WEEKLY", dt.date(2026, 12, 7), dt.date(2027, 6, 1))) > len(
        until
    )


def test_window_start_skips_earlier_occurrences_but_keeps_the_rule_anchor():
    times = expand(
        "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO",
        dt.date(2027, 1, 4),
        dt.date(2027, 2, 28),
        window_start=dt.date(2027, 1, 20),
    )
    assert local_dates(times) == [dt.date(2027, 2, 1), dt.date(2027, 2, 15)]


def test_not_before_drops_earlier_occurrences():
    cutoff = dt.datetime(2027, 1, 12, tzinfo=dt.UTC)
    times = expand_occurrences(
        timezone="UTC",
        start_date=dt.date(2027, 1, 4),
        start_time=NINE,
        duration_min=60,
        rrule="FREQ=WEEKLY;BYDAY=MO",
        window_start=dt.date(2027, 1, 1),
        window_end=dt.date(2027, 1, 31),
        not_before=cutoff,
    )
    assert local_dates(times, ZoneInfo("UTC")) == [
        dt.date(2027, 1, 18), dt.date(2027, 1, 25),
    ]  # fmt: skip


def test_one_off_outside_the_window_has_no_occurrence():
    assert (
        expand(
            None,
            dt.date(2027, 5, 3),
            dt.date(2027, 4, 1),
            window_start=dt.date(2027, 4, 1),
        )
        == []
    )


@pytest.mark.parametrize(
    ("raw", "expected_until"),
    [
        (
            "FREQ=DAILY;UNTIL=20261215",
            "UNTIL=20261216T055959Z",
        ),  # end of Dec 15, Chicago
        (
            "FREQ=DAILY;UNTIL=20261215T120000",
            "UNTIL=20261215T180000Z",
        ),  # floating = local
        ("FREQ=DAILY;UNTIL=20261215T000000Z", "UNTIL=20261215T000000Z"),
    ],
)
def test_until_is_normalized_to_utc(raw, expected_until):
    assert normalize_rrule(raw, "America/Chicago").endswith(expected_until)


def test_normalize_strips_prefix_and_validates():
    assert (
        normalize_rrule("RRULE:FREQ=WEEKLY;BYDAY=MO", "UTC") == "FREQ=WEEKLY;BYDAY=MO"
    )
    for bad in [
        "", "BYDAY=MO", "FREQ=WEEKLY;COUNT=2;UNTIL=20270101T000000Z", "FREQ=SOMETIMES",
        "FREQ=DAILY;FREQ=WEEKLY", "DTSTART:20270101T000000\nRRULE:FREQ=DAILY",
    ]:  # fmt: skip
        with pytest.raises(RecurrenceError):
            normalize_rrule(bad, "UTC")
    with pytest.raises(RecurrenceError):
        normalize_rrule("FREQ=DAILY", "Not/AZone")


def test_build_rrule_rejects_contradictory_options():
    with pytest.raises(RecurrenceError):
        build_rrule(
            freq="WEEKLY", count=2, until=dt.datetime(2027, 1, 1, tzinfo=dt.UTC)
        )
    with pytest.raises(RecurrenceError):
        build_rrule(freq="MONTHLY", by_month_day=5, last_day_of_month=True)
    with pytest.raises(RecurrenceError):
        build_rrule(freq="MONTHLY", by_month_day=-1)  # last day is its own option
    with pytest.raises(RecurrenceError):
        build_rrule(freq="DAILY", nth_weekday=(2, "TU"))
    with pytest.raises(RecurrenceError):
        build_rrule(freq="WEEKLY", interval=0)
    with pytest.raises(RecurrenceError):
        build_rrule(freq="WEEKLY", until=dt.datetime(2027, 1, 1))  # naive


def test_build_rrule_variants():
    until = dt.datetime(2026, 12, 15, tzinfo=dt.UTC)
    assert (
        build_rrule(freq="WEEKLY", by_weekday=["MO", "WE", "FR"], until=until)
        == "FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261215T000000Z"
    )
    assert build_rrule(freq="MONTHLY", by_month_day=15, interval=2) == (
        "FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15"
    )
    assert (
        build_rrule(freq="MONTHLY", nth_weekday=(-1, "FR")) == "FREQ=MONTHLY;BYDAY=-1FR"
    )


def test_last_occurrence_date():
    kwargs = {
        "timezone": "America/Chicago",
        "start_date": dt.date(2027, 1, 4),
        "start_time": NINE,
    }
    assert last_occurrence_date(rrule="FREQ=WEEKLY;BYDAY=MO", **kwargs) is None
    assert last_occurrence_date(
        rrule="FREQ=WEEKLY;BYDAY=MO;COUNT=3", **kwargs
    ) == dt.date(2027, 1, 18)
    assert last_occurrence_date(
        rrule="FREQ=WEEKLY;BYDAY=MO;UNTIL=20270125T000000Z", **kwargs
    ) == dt.date(2027, 1, 18)


def test_end_before_replaces_count_and_until():
    until = dt.datetime(2027, 2, 2, 23, 59, 59, tzinfo=CHICAGO)
    assert end_before("FREQ=WEEKLY;BYDAY=MO;COUNT=9", until) == (
        "FREQ=WEEKLY;BYDAY=MO;UNTIL=20270203T055959Z"
    )
    assert end_before("FREQ=DAILY;UNTIL=20300101T000000Z", until).count("UNTIL") == 1


def test_with_remaining_count():
    assert with_remaining_count("FREQ=DAILY;COUNT=10", 4) == "FREQ=DAILY;COUNT=6"
    assert with_remaining_count("FREQ=DAILY", 4) == "FREQ=DAILY"
    with pytest.raises(RecurrenceError):
        with_remaining_count("FREQ=DAILY;COUNT=4", 4)
