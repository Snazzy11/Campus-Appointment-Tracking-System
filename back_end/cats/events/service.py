"""Create, schedule, edit, and look up calendar events.

Every function takes a SQLAlchemy `Session`, flushes, and leaves committing to the
caller. The `now` arguments exist so tests can control the clock.

Occurrences are inserted with `ON CONFLICT (series_id, original_start) DO NOTHING`.
That is what makes it safe to materialize a series again and again: rows that already
exist, including cancelled or moved ones, are never duplicated or overwritten.
"""

import copy
import datetime as dt
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, cast

from dateutil.relativedelta import relativedelta
from sqlalchemy import ColumnElement, CursorResult, and_, delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from cats.database.models.event import EventOccurrence, EventSeries, EventStatus
from cats.events.config import EVENT_HORIZON_MONTHS
from cats.events.details import validate_details
from cats.events.recurrence import (
    build_rule,
    end_before,
    expand_occurrences,
    get_timezone,
    last_occurrence_date,
    normalize_rrule,
    with_remaining_count,
)


class EventError(ValueError):
    """The requested change is not valid."""


_UNSET: Any = object()  # "argument not passed", so None can mean "clear this"

# Series fields an edit can change. start_date is left out on purpose: changing where the
# series starts is a "this and all following" split, and moving one meeting is an
# occurrence edit.
SERIES_EDITABLE = frozenset(
    {
        "event_type",
        "title",
        "location",
        "details",
        "timezone",
        "start_time",
        "duration_min",
        "rrule",
    }
)


def _now(now: dt.datetime | None) -> dt.datetime:
    """The current time unless one was passed in, which must be timezone-aware."""
    if now is None:
        return dt.datetime.now(dt.UTC)
    if now.tzinfo is None:
        raise EventError("now must be timezone-aware")
    return now


def horizon_end(today: dt.date) -> dt.date:
    """The last date that gets occurrences: EVENT_HORIZON_MONTHS after `today`."""
    return today + relativedelta(months=EVENT_HORIZON_MONTHS)


def _untouched(duration_min: int) -> ColumnElement[bool]:
    """SQL filter for occurrences nobody has edited.

    That means still scheduled, no overrides, not moved, and still the series' length.
    Only these are safe to delete and recreate when the series changes.
    """
    return and_(
        EventOccurrence.status == EventStatus.SCHEDULED.value,
        EventOccurrence.title_override.is_(None),
        EventOccurrence.location_override.is_(None),
        EventOccurrence.start_at == EventOccurrence.original_start,
        EventOccurrence.end_at - EventOccurrence.start_at
        == dt.timedelta(minutes=duration_min),
    )


def _get_series(session: Session, series_id: int, *, lock: bool = False) -> EventSeries:
    statement = select(EventSeries).where(EventSeries.id == series_id)
    if lock:
        # hold a row lock until commit so two edits (or the daily job) can't interleave
        statement = statement.with_for_update()
    series = session.scalars(statement).one_or_none()
    if series is None:
        raise EventError(f"event series {series_id} does not exist")
    return series


def _validate_fields(
    *,
    event_type: str,
    timezone: str,
    duration_min: int,
    title: str,
    rrule: str | None,
    details: dict[str, Any] | None,
) -> tuple[str | None, dict[str, Any]]:
    """Check the fields shared by create and edit; returns the cleaned rrule and details."""
    if not title.strip():
        raise EventError("title cannot be empty")
    if duration_min < 1:
        raise EventError("duration_min must be at least 1")
    get_timezone(timezone)
    normalized = None if rrule is None else normalize_rrule(rrule, timezone)
    return normalized, validate_details(event_type, details)


def create_series(
    session: Session,
    *,
    event_type: str,
    title: str,
    owner_id: int,
    timezone: str,
    start_date: dt.date,
    start_time: dt.time,
    duration_min: int,
    location: str | None = None,
    details: dict[str, Any] | None = None,
    rrule: str | None = None,
    now: dt.datetime | None = None,
) -> EventSeries:
    """Create an event and its occurrences.

    A one-off (`rrule=None`) gets a single occurrence. A recurring event gets them from
    `start_date` until the rule ends or the horizon is reached, whichever comes first.
    """
    normalized, valid_details = _validate_fields(
        event_type=event_type,
        timezone=timezone,
        duration_min=duration_min,
        title=title,
        rrule=rrule,
        details=details,
    )
    series = EventSeries(
        event_type=event_type,
        title=title,
        location=location,
        owner_id=owner_id,
        details=valid_details,
        timezone=timezone,
        start_date=start_date,
        start_time=start_time.replace(tzinfo=None),
        duration_min=duration_min,
        rrule=normalized,
    )
    session.add(series)
    session.flush()  # autoflush is off, and the occurrences need series.id
    materialize_series(session, series, now=now)
    return series


def materialize_series(
    session: Session,
    series: EventSeries,
    *,
    now: dt.datetime | None = None,
    regenerate_from: dt.date | None = None,
    not_before: dt.datetime | None = None,
) -> int:
    """Create the occurrences that are missing and return how many were added.

    By default it picks up after `generated_until`. `regenerate_from` starts from a given
    local date instead, which is safe to do over existing rows. `not_before` skips
    occurrences that start before that moment.
    """
    now = _now(now)
    tz = get_timezone(series.timezone)
    horizon = horizon_end(now.astimezone(tz).date())

    if series.rrule is None:
        window_start = window_end = series.start_date
        target = series.start_date
    else:
        rule_end = last_occurrence_date(
            timezone=series.timezone,
            start_date=series.start_date,
            start_time=series.start_time,
            rrule=series.rrule,
        )
        window_end = horizon if rule_end is None else min(horizon, rule_end)
        target = window_end
        if regenerate_from is not None:
            window_start = max(series.start_date, regenerate_from)
        elif series.generated_until is None:
            window_start = series.start_date
        else:
            if series.generated_until >= target:
                return 0  # nothing new to create yet
            window_start = max(
                series.start_date, series.generated_until + dt.timedelta(days=1)
            )

    series.generated_until = target
    if window_start > window_end:
        session.flush()
        return 0

    times = expand_occurrences(
        timezone=series.timezone,
        start_date=series.start_date,
        start_time=series.start_time,
        duration_min=series.duration_min,
        rrule=series.rrule,
        window_start=window_start,
        window_end=window_end,
        not_before=not_before,
    )
    if not times:
        session.flush()
        return 0
    statement = (
        pg_insert(EventOccurrence)
        .values(
            [
                {
                    "series_id": series.id,
                    "original_start": t.original_start,
                    "start_at": t.start_at,
                    "end_at": t.end_at,
                    "status": EventStatus.SCHEDULED.value,
                }
                for t in times
            ]
        )
        .on_conflict_do_nothing(index_elements=["series_id", "original_start"])
    )
    result = cast("CursorResult[Any]", session.execute(statement))
    session.flush()
    return result.rowcount


def extend_series_occurrences(
    session: Session, *, now: dt.datetime | None = None
) -> int:
    """The daily job: bring every recurring series up to the current horizon.

    Safe to run repeatedly. Returns how many occurrences were added.
    """
    now = _now(now)
    # A rough filter in SQL; materialize_series makes the exact call for each series'
    # timezone. The extra day covers timezones ahead of UTC.
    cutoff = horizon_end(now.astimezone(dt.UTC).date()) + dt.timedelta(days=1)
    candidates = session.scalars(
        select(EventSeries).where(
            EventSeries.rrule.is_not(None),
            or_(
                EventSeries.generated_until.is_(None),
                EventSeries.generated_until < cutoff,
            ),
        )
    ).all()
    return sum(materialize_series(session, series, now=now) for series in candidates)


# --- editing -----------------------------------------------------------------------


def cancel_occurrence(session: Session, occurrence_id: int) -> EventOccurrence:
    """Cancel one occurrence.

    The row stays, marked cancelled, so regenerating the series doesn't bring it back.
    """
    return update_occurrence(session, occurrence_id, status=EventStatus.CANCELLED.value)


def update_occurrence(
    session: Session,
    occurrence_id: int,
    *,
    start_at: dt.datetime = _UNSET,
    end_at: dt.datetime = _UNSET,
    status: str = _UNSET,
    title_override: str | None = _UNSET,
    location_override: str | None = _UNSET,
) -> EventOccurrence:
    """Change a single occurrence. `original_start` never changes.

    Only pass what should change. Setting an override to None goes back to the series'
    value, and moving `start_at` without `end_at` keeps the same length.
    """
    occurrence = session.get(EventOccurrence, occurrence_id)
    if occurrence is None:
        raise EventError(f"occurrence {occurrence_id} does not exist")
    for name, value in (("start_at", start_at), ("end_at", end_at)):
        if value is not _UNSET and value.tzinfo is None:
            raise EventError(f"{name} must be timezone-aware")
    if status is not _UNSET and status not in {s.value for s in EventStatus}:
        allowed = ", ".join(repr(s.value) for s in EventStatus)
        raise EventError(f"status must be one of {allowed}")

    length = occurrence.end_at - occurrence.start_at
    if start_at is not _UNSET:
        occurrence.start_at = start_at
        if end_at is _UNSET:
            occurrence.end_at = start_at + length
    if end_at is not _UNSET:
        occurrence.end_at = end_at
    if occurrence.end_at <= occurrence.start_at:
        raise EventError("end_at must be after start_at")
    if status is not _UNSET:
        occurrence.status = status
    if title_override is not _UNSET:
        occurrence.title_override = title_override
    if location_override is not _UNSET:
        occurrence.location_override = location_override
    session.flush()
    return occurrence


def _check_changes(changes: Mapping[str, Any]) -> None:
    unknown = set(changes) - SERIES_EDITABLE
    if unknown:
        raise EventError(
            f"cannot edit {sorted(unknown)}; editable: {sorted(SERIES_EDITABLE)}"
        )


def _normalized_changes(
    base: Mapping[str, Any], changes: Mapping[str, Any]
) -> dict[str, Any]:
    """Validate the series as it would look after `changes`; return `changes` cleaned up.

    The rrule and details in the result are the normalized versions.
    """
    merged = {**base, **changes}
    rrule, details = _validate_fields(
        event_type=merged["event_type"],
        timezone=merged["timezone"],
        duration_min=merged["duration_min"],
        title=merged["title"],
        rrule=merged["rrule"],
        details=merged["details"],
    )
    result = dict(changes)
    if "rrule" in changes:
        result["rrule"] = rrule
    if "details" in changes or "event_type" in changes:
        result["details"] = details
    if "start_time" in result:
        result["start_time"] = result["start_time"].replace(tzinfo=None)
    return result


def _series_fields(series: EventSeries) -> dict[str, Any]:
    """The editable fields of a series, as a dict."""
    return {
        "event_type": series.event_type,
        "title": series.title,
        "location": series.location,
        "details": series.details,
        "timezone": series.timezone,
        "start_time": series.start_time,
        "duration_min": series.duration_min,
        "rrule": series.rrule,
    }


def edit_series_all(
    session: Session,
    series_id: int,
    *,
    now: dt.datetime | None = None,
    **changes: Any,
) -> EventSeries:
    """Apply changes to every occurrence in the series.

    The series is updated, and future occurrences nobody has touched are deleted and
    recreated from the new settings. Past occurrences, and any that were moved,
    overridden, or cancelled, are left alone.
    """
    _check_changes(changes)
    now = _now(now)
    series = _get_series(session, series_id, lock=True)
    changes = _normalized_changes(_series_fields(series), changes)

    session.execute(
        delete(EventOccurrence)
        .where(
            EventOccurrence.series_id == series.id,
            EventOccurrence.original_start >= now,
            _untouched(series.duration_min),
        )
        .execution_options(synchronize_session="fetch")
    )
    for name, value in changes.items():
        setattr(series, name, value)
    session.flush()

    local_today = now.astimezone(get_timezone(series.timezone)).date()
    materialize_series(
        session, series, now=now, regenerate_from=local_today, not_before=now
    )
    return series


def edit_series_following(
    session: Session,
    series_id: int,
    split_date: dt.date,
    *,
    now: dt.datetime | None = None,
    **changes: Any,
) -> tuple[EventSeries, EventSeries]:
    """Apply changes from `split_date` (a local date) onward; earlier meetings stay as is.

    The existing series is ended just before `split_date`, its untouched occurrences from
    then on are deleted, and a new series carrying the changes takes over. Together they
    cover the original schedule with no overlap and no gap. Returns (old, new).
    """
    _check_changes(changes)
    now = _now(now)
    series = _get_series(session, series_id, lock=True)
    if series.rrule is None:
        raise EventError("a one-off event has nothing to split; use edit_series_all")
    tz = get_timezone(series.timezone)
    if split_date <= series.start_date:
        raise EventError("split_date is the series start; use edit_series_all instead")
    if split_date < now.astimezone(tz).date():
        raise EventError("split_date cannot be in the past")

    new_fields = _normalized_changes(_series_fields(series), changes)
    rule = build_rule(
        timezone=series.timezone,
        start_date=series.start_date,
        start_time=series.start_time,
        rrule=series.rrule,
    )
    split_start = dt.datetime.combine(split_date, dt.time.min, tzinfo=tz)
    first_after = rule.after(split_start, inc=True)
    if first_after is None:
        raise EventError("the series has no occurrences on or after split_date")

    # The new series normally starts at the first real occurrence on or after the split,
    # which keeps a rule like INTERVAL=2 in step. If the caller gives a new rule, it
    # starts on the split date itself.
    new_start_date = split_date if "rrule" in changes else first_after.date()
    if "rrule" in changes:
        new_rrule = new_fields["rrule"]
    else:
        # Count what the old series keeps, so the new one only gets what's left of a
        # COUNT rule.
        day_before_start = dt.datetime.combine(
            series.start_date - dt.timedelta(days=1), dt.time.min, tzinfo=tz
        )
        used = len(rule.between(day_before_start, split_start, inc=False))
        new_rrule = with_remaining_count(series.rrule, used)

    old_duration = series.duration_min
    series.rrule = end_before(series.rrule, split_start - dt.timedelta(seconds=1))
    last_kept = split_date - dt.timedelta(days=1)
    if series.generated_until is None or series.generated_until > last_kept:
        series.generated_until = last_kept
    session.execute(
        delete(EventOccurrence)
        .where(
            EventOccurrence.series_id == series.id,
            EventOccurrence.original_start >= max(split_start, now),
            _untouched(old_duration),
        )
        .execution_options(synchronize_session="fetch")
    )

    fields = {**_series_fields(series), **new_fields}
    fields["rrule"] = new_rrule
    fields["details"] = copy.deepcopy(fields["details"])
    tail = EventSeries(owner_id=series.owner_id, start_date=new_start_date, **fields)
    session.add(tail)
    session.flush()
    materialize_series(session, tail, now=now)
    return series, tail


def delete_series(session: Session, series_id: int) -> None:
    """Delete a series. The database removes its occurrences too."""
    session.delete(_get_series(session, series_id))
    session.flush()


# --- queries -----------------------------------------------------------------------


@dataclass(frozen=True)
class CalendarEntry:
    """One occurrence ready to display, with any overrides already applied."""

    occurrence_id: int
    series_id: int
    event_type: str
    title: str  # the override if there is one, otherwise the series'
    location: str | None  # same
    start_at: dt.datetime
    end_at: dt.datetime
    details: dict[str, Any]


def calendar_entries(
    session: Session,
    owner_id: int,
    range_start: dt.datetime,
    range_end: dt.datetime,
) -> list[CalendarEntry]:
    """A user's events that start in [range_start, range_end), minus cancelled ones.

    This is a range query on the indexed start_at column, joined to the series for the
    display fields.
    """
    rows = session.execute(
        select(
            EventOccurrence,
            func.coalesce(EventOccurrence.title_override, EventSeries.title),
            func.coalesce(EventOccurrence.location_override, EventSeries.location),
            EventSeries,
        )
        .join(EventSeries, EventOccurrence.series_id == EventSeries.id)
        .where(
            EventSeries.owner_id == owner_id,
            EventOccurrence.start_at >= range_start,
            EventOccurrence.start_at < range_end,
            EventOccurrence.status != EventStatus.CANCELLED.value,
        )
        .order_by(EventOccurrence.start_at, EventOccurrence.id)
    ).all()
    return [
        CalendarEntry(
            occurrence_id=occurrence.id,
            series_id=occurrence.series_id,
            event_type=series.event_type,
            title=title,
            location=location,
            start_at=occurrence.start_at,
            end_at=occurrence.end_at,
            details=series.details,
        )
        for occurrence, title, location, series in rows
    ]


def occurrences_for_series(session: Session, series_id: int) -> list[EventOccurrence]:
    """All occurrences of a series in time order, including cancelled ones."""
    return list(
        session.scalars(
            select(EventOccurrence)
            .where(EventOccurrence.series_id == series_id)
            .order_by(EventOccurrence.start_at)
        )
    )
