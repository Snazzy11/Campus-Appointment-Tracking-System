"""Recurrence rules (RFC 5545 RRULE) and turning them into concrete occurrence times.

Pure functions, no database. Rules are expanded by python-dateutil; there is no custom
date-expansion logic here. The rule is expanded in the series' own timezone, so the
local wall-clock start time is constant across daylight saving changes, and each
occurrence is then converted to UTC.
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
    original_start: dt.datetime  # what the rule produced (UTC)
    start_at: dt.datetime  # same as original_start until someone moves it (UTC)
    end_at: dt.datetime  # UTC


def get_timezone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (KeyError, ValueError, OSError) as error:
        raise RecurrenceError(f"unknown IANA timezone {name!r}") from error


def _until_to_utc(value: str, tz: ZoneInfo) -> dt.datetime:
    """Parse an UNTIL value into a UTC instant.

    A date-only value is inclusive of that whole local day (RFC 5545), so it means the
    end of that day. A floating date-time is read in the series' timezone.
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
    """Validate an RRULE and return it in canonical form.

    Strips an optional "RRULE:" prefix and rewrites UNTIL as a UTC date-time, which is
    what dateutil needs for a timezone-aware series. Raises RecurrenceError if the rule
    is not usable.
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
    # Parse once so a bad rule fails here, not later during materialization.
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
    """The dateutil rule for a series, anchored at its local start."""
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
    """Occurrences whose local date is in [window_start, window_end].

    `rrule=None` is a one-off: a single occurrence on `start_date`, if it is in the
    window. `not_before` (an aware datetime) drops occurrences that start earlier.

    end_at is start_at plus `duration_min` of real elapsed time, computed from the
    occurrence's own start, so a daylight saving change cannot corrupt it.
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
    """Local date of the rule's last occurrence, or None if the rule never ends.

    A rule with neither UNTIL nor COUNT is open-ended. A finite rule with no occurrences
    at all returns `start_date`.
    """
    keys = {key for key, _ in _split_rule(rrule)}
    if not keys & {"UNTIL", "COUNT"}:
        return None
    rule = build_rule(
        timezone=timezone, start_date=start_date, start_time=start_time, rrule=rrule
    )
    last: dt.datetime | None = None
    for last in rule:
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
    """Build an RRULE string from the options the UI offers.

    - Weekly on chosen days: `freq="WEEKLY", by_weekday=["MO", "WE", "FR"]`.
    - Monthly on a day of the month: `by_month_day=31`. Months without that day are
      skipped, as the standard says.
    - Monthly on the last day: `last_day_of_month=True` (a separate, explicit option).
    - Monthly on the nth weekday: `nth_weekday=(2, "TU")` is the second Tuesday, and
      `(-1, "FR")` is the last Friday.
    - End with `until` (an aware datetime) or `count`; with neither, it is open-ended.
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
    """The rule ending at `until` (an aware datetime; an occurrence exactly at `until`
    is still included). Any COUNT or existing UNTIL is replaced, since RFC 5545 does not
    allow both."""
    if until.tzinfo is None:
        raise RecurrenceError("until must be timezone-aware")
    parts = [(k, v) for k, v in _split_rule(rrule) if k not in ("UNTIL", "COUNT")]
    parts.append(("UNTIL", until.astimezone(dt.UTC).strftime(_UNTIL_FORMAT)))
    return _join_rule(parts)


def with_remaining_count(rrule: str, already_used: int) -> str:
    """The rule for the tail of a split series: COUNT reduced by the occurrences the
    earlier series already used. Rules without COUNT are returned unchanged."""
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
