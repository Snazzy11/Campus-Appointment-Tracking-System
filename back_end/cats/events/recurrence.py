"""Recurrence rules and how they turn into real meeting times.

A rule is an RFC 5545 RRULE string such as `FREQ=WEEKLY;BYDAY=MO,WE,FR`, and
python-dateutil does the expanding. The rule runs in the series' own timezone so the
local start time stays put across daylight saving changes, and each result is then
converted to UTC.

Nothing in here touches the database.
"""

import datetime as dt
import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal, cast
from zoneinfo import ZoneInfo

from dateutil.rrule import rrule as DateutilRule
from dateutil.rrule import rrulestr

Frequency = Literal["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]
Weekday = Literal["MO", "TU", "WE", "TH", "FR", "SA", "SU"]

_WEEKDAYS = ("MO", "TU", "WE", "TH", "FR", "SA", "SU")
_UNTIL_FORMAT = "%Y%m%dT%H%M%SZ"
_UNTIL_UTC = re.compile(r"^\d{8}T\d{6}Z$")
_UNTIL_FLOATING = re.compile(r"^\d{8}T\d{6}$")
_UNTIL_DATE = re.compile(r"^\d{8}$")


class RecurrenceError(ValueError):
    """The rule or timezone is invalid."""


@dataclass(frozen=True)
class OccurrenceTimes:
    """One meeting, in UTC. start_at only differs from original_start once it's moved."""

    original_start: dt.datetime
    start_at: dt.datetime
    end_at: dt.datetime


def get_timezone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (KeyError, ValueError, OSError) as error:
        raise RecurrenceError(f"unknown IANA timezone {name!r}") from error


def _until_to_utc(value: str, tz: ZoneInfo) -> dt.datetime:
    """Convert an UNTIL value to a UTC time.

    dateutil only accepts a UTC UNTIL for a timezone-aware series, so date-only and
    local date-time values get converted. A date-only UNTIL includes that whole day, so
    it becomes the end of that day in the series' timezone.
    """
    if _UNTIL_UTC.match(value):
        return dt.datetime.strptime(value, _UNTIL_FORMAT).replace(tzinfo=dt.UTC)
    if _UNTIL_FLOATING.match(value):
        local = dt.datetime.strptime(value, "%Y%m%dT%H%M%S").replace(tzinfo=tz)
        return local.astimezone(dt.UTC)
    if _UNTIL_DATE.match(value):
        day = dt.datetime.strptime(value, "%Y%m%d").date()
        local = dt.datetime.combine(day, dt.time(23, 59, 59), tzinfo=tz)
        return local.astimezone(dt.UTC)
    raise RecurrenceError(f"invalid UNTIL value {value!r}")


def _split_rule(rrule: str) -> list[tuple[str, str]]:
    """Split 'FREQ=DAILY;COUNT=3' into [('FREQ', 'DAILY'), ('COUNT', '3')]."""
    text = rrule.strip()
    if text.upper().startswith("RRULE:"):
        text = text[len("RRULE:") :]
    if not text or "\n" in text or "DTSTART" in text.upper():
        raise RecurrenceError(
            "rrule must be a single RRULE value without DTSTART, "
            "e.g. 'FREQ=WEEKLY;BYDAY=MO,WE,FR'"
        )
    parts: list[tuple[str, str]] = []
    for piece in text.split(";"):
        key, separator, value = piece.partition("=")
        if not separator or not key or not value:
            raise RecurrenceError(f"invalid rrule part {piece!r}")
        parts.append((key.upper(), value))
    return parts


def _join_rule(parts: list[tuple[str, str]]) -> str:
    return ";".join(f"{key}={value}" for key, value in parts)


def normalize_rrule(rrule: str, timezone: str) -> str:
    """Check an RRULE and return it in the form we store.

    Drops a leading "RRULE:" and rewrites UNTIL in UTC (see _until_to_utc). Raises
    RecurrenceError if the rule can't be used.
    """
    tz = get_timezone(timezone)
    parts = _split_rule(rrule)
    keys = [key for key, _ in parts]
    if "FREQ" not in keys:
        raise RecurrenceError("rrule needs a FREQ")
    if len(set(keys)) != len(keys):
        raise RecurrenceError("rrule repeats a part")
    if "UNTIL" in keys and "COUNT" in keys:
        raise RecurrenceError("rrule cannot have both UNTIL and COUNT")
    normalized = [
        (key, _until_to_utc(value, tz).strftime(_UNTIL_FORMAT))
        if key == "UNTIL"
        else (key, value)
        for key, value in parts
    ]
    result = _join_rule(normalized)
    # A trial parse catches rules that look fine but aren't valid, like FREQ=SOMETIMES.
    try:
        _parse(result, dt.datetime(2000, 1, 1, tzinfo=tz))
    except (ValueError, KeyError) as error:
        raise RecurrenceError(f"invalid rrule {rrule!r}: {error}") from error
    return result


def _parse(rrule: str, dtstart: dt.datetime) -> DateutilRule:
    return cast(DateutilRule, rrulestr(rrule, dtstart=dtstart))


def _local_start(start_date: dt.date, start_time: dt.time, tz: ZoneInfo) -> dt.datetime:
    return dt.datetime.combine(start_date, start_time.replace(tzinfo=None), tzinfo=tz)


def build_rule(
    *, timezone: str, start_date: dt.date, start_time: dt.time, rrule: str
) -> DateutilRule:
    """The dateutil rule for a series, anchored at its first local start time."""
    tz = get_timezone(timezone)
    return _parse(rrule, _local_start(start_date, start_time, tz))


def expand_occurrences(
    *,
    timezone: str,
    start_date: dt.date,
    start_time: dt.time,
    duration_min: int,
    rrule: str | None,
    window_start: dt.date,
    window_end: dt.date,
    not_before: dt.datetime | None = None,
) -> list[OccurrenceTimes]:
    """Return the occurrences whose local date falls in [window_start, window_end].

    A one-off (`rrule=None`) produces its single occurrence if `start_date` is inside
    the window. `not_before` drops anything that starts before that moment.

    The end is the start plus `duration_min` of real elapsed time, so a meeting that
    spans a daylight saving change keeps its true length.
    """
    tz = get_timezone(timezone)
    first = _local_start(start_date, start_time, tz)
    if rrule is None:
        locals_ = [first] if window_start <= start_date <= window_end else []
    else:
        rule = _parse(rrule, first)
        locals_ = rule.between(
            dt.datetime.combine(window_start, dt.time.min, tzinfo=tz),
            dt.datetime.combine(window_end, dt.time.max, tzinfo=tz),
            inc=True,
        )
    duration = dt.timedelta(minutes=duration_min)
    result: list[OccurrenceTimes] = []
    for local in locals_:
        start_utc = local.astimezone(dt.UTC)
        if not_before is not None and start_utc < not_before:
            continue
        result.append(OccurrenceTimes(start_utc, start_utc, start_utc + duration))
    return result


def last_occurrence_date(
    *, timezone: str, start_date: dt.date, start_time: dt.time, rrule: str
) -> dt.date | None:
    """Local date of the rule's last occurrence, or None if it repeats forever.

    A rule with neither UNTIL nor COUNT never ends. A finite rule that happens to have
    no occurrences at all returns `start_date`.
    """
    keys = {key for key, _ in _split_rule(rrule)}
    if not keys & {"UNTIL", "COUNT"}:
        return None
    rule = build_rule(
        timezone=timezone, start_date=start_date, start_time=start_time, rrule=rrule
    )
    last: dt.datetime | None = None
    for last in rule:  # walk to the final occurrence
        pass
    return start_date if last is None else last.date()


def build_rrule(
    *,
    freq: Frequency,
    interval: int = 1,
    by_weekday: Sequence[Weekday] | None = None,
    by_month_day: int | None = None,
    nth_weekday: tuple[int, Weekday] | None = None,
    last_day_of_month: bool = False,
    until: dt.datetime | None = None,
    count: int | None = None,
) -> str:
    """Build an RRULE string from the choices a UI would offer.

    - Weekly on chosen days: `freq="WEEKLY", by_weekday=["MO", "WE", "FR"]`
    - Monthly on a day number: `freq="MONTHLY", by_month_day=31`
    - Monthly on the last day: `freq="MONTHLY", last_day_of_month=True`
    - Monthly on a weekday: `nth_weekday=(2, "TU")` is the second Tuesday and
      `(-1, "FR")` is the last Friday

    A month without the chosen day number (like the 31st) is skipped, as the standard
    says, which is why "last day" is its own option. Pass `until` (an aware datetime) or
    `count` to end the series; with neither it repeats forever.
    """
    if interval < 1:
        raise RecurrenceError("interval must be at least 1")
    if until is not None and count is not None:
        raise RecurrenceError("use either until or count, not both")
    if count is not None and count < 1:
        raise RecurrenceError("count must be at least 1")
    monthly_options = [
        by_month_day is not None,
        nth_weekday is not None,
        last_day_of_month,
    ]
    if sum(monthly_options) > 1:
        raise RecurrenceError(
            "choose one of by_month_day, nth_weekday, last_day_of_month"
        )
    if any(monthly_options) and freq != "MONTHLY":
        raise RecurrenceError(
            "by_month_day, nth_weekday and last_day_of_month need freq=MONTHLY"
        )
    if by_weekday and freq != "WEEKLY":
        raise RecurrenceError("by_weekday needs freq=WEEKLY")

    parts = [f"FREQ={freq}"]
    if interval != 1:
        parts.append(f"INTERVAL={interval}")
    if by_weekday:
        for day in by_weekday:
            if day not in _WEEKDAYS:
                raise RecurrenceError(f"unknown weekday {day!r}")
        parts.append("BYDAY=" + ",".join(by_weekday))
    if by_month_day is not None:
        if not 1 <= by_month_day <= 31:
            raise RecurrenceError(
                "by_month_day must be 1-31; use last_day_of_month for the last day"
            )
        parts.append(f"BYMONTHDAY={by_month_day}")
    if last_day_of_month:
        parts.append("BYMONTHDAY=-1")
    if nth_weekday is not None:
        n, day = nth_weekday
        if n == 0 or abs(n) > 5 or day not in _WEEKDAYS:
            raise RecurrenceError("nth_weekday is (n, day) with n in 1..5 or -5..-1")
        parts.append(f"BYDAY={n}{day}")
    if until is not None:
        if until.tzinfo is None:
            raise RecurrenceError("until must be timezone-aware")
        parts.append("UNTIL=" + until.astimezone(dt.UTC).strftime(_UNTIL_FORMAT))
    if count is not None:
        parts.append(f"COUNT={count}")
    return ";".join(parts)


def end_before(rrule: str, until: dt.datetime) -> str:
    """Return the rule with its end set to `until` (an aware datetime).

    Replaces any existing UNTIL or COUNT, since a rule can't have both.
    """
    if until.tzinfo is None:
        raise RecurrenceError("until must be timezone-aware")
    parts = [(k, v) for k, v in _split_rule(rrule) if k not in ("UNTIL", "COUNT")]
    parts.append(("UNTIL", until.astimezone(dt.UTC).strftime(_UNTIL_FORMAT)))
    return _join_rule(parts)


def with_remaining_count(rrule: str, already_used: int) -> str:
    """Reduce a COUNT by the occurrences already used up.

    When a series is split, the second half only gets the occurrences the first half
    didn't use. Rules without a COUNT come back unchanged.
    """
    parts = _split_rule(rrule)
    result: list[tuple[str, str]] = []
    for key, value in parts:
        if key == "COUNT":
            remaining = int(value) - already_used
            if remaining < 1:
                raise RecurrenceError("no occurrences remain after the split")
            result.append((key, str(remaining)))
        else:
            result.append((key, value))
    return _join_rule(result)
