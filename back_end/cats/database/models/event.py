"""Calendar events.

An event is an `EventSeries` (what it is and when it starts) plus one `EventOccurrence`
row for each time it actually happens. A one-off event is a series with no `rrule` and a
single occurrence; a recurring one has a repeat rule and many occurrences.

The calendar reads occurrences and joins back to the series for display. The code that
creates and edits these rows lives in `cats.events`.
"""

import datetime
from enum import Enum
from typing import Any

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from cats.database.database import Base


class EventStatus(str, Enum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"


class EventType(str, Enum):
    CLASS = "class"
    CLUB = "club"
    MEETING = "meeting"
    WORK = "work"


class EventSeries(Base):
    __tablename__ = "event_series"

    __table_args__ = (  # a zero or negative length makes no sense
        CheckConstraint("duration_min > 0", name="ck_event_series_duration_positive"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(
        Text
    )  # TODO make a FK when locations are fully implemented

    # RESTRICT: a user who still owns events can't be deleted
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )

    # Holds an EventType value
    # see cats.events.details where it checks against EventType
    event_type: Mapped[str] = mapped_column(String)

    # Extra fields that depend on event_type like a course code
    # See cats.events.details
    details: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )

    # local time plus a timezone
    timezone: Mapped[str] = mapped_column(String)  # IANA name, e.g. 'America/Chicago'
    start_date: Mapped[datetime.date] = mapped_column(Date)  # date of the first meeting
    start_time: Mapped[datetime.time] = mapped_column(Time)  # local wall-clock time
    duration_min: Mapped[int]

    # RFC 5545 recurrence rule, e.g. 'FREQ=WEEKLY;BYDAY=MO,WE,FR'. NULL for a one time event
    rrule: Mapped[str | None] = mapped_column(Text)
    # Occurrences have been created up to this date; the daily job moves it forward.
    generated_until: Mapped[datetime.date | None] = mapped_column(Date)

    # passive_deletes: the database cascades the delete, so SQLAlchemy doesn't need to
    # load the occurrences first.
    occurrences: Mapped[list[EventOccurrence]] = relationship(
        back_populates="series", cascade="all, delete-orphan", passive_deletes=True
    )


class EventOccurrence(Base):
    __tablename__ = "event_occurrences"

    __table_args__ = (
        UniqueConstraint(
            "series_id", "original_start", name="uq_event_occurrences_series_original"
        ),
        CheckConstraint(
            f"status IN ({', '.join(f"'{s.value}'" for s in EventStatus)})",
            name="ck_event_occurrences_status",
        ),
        Index("ix_event_occurrences_start_at", "start_at"),
        Index("ix_event_occurrences_series_id_start_at", "series_id", "start_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    series_id: Mapped[int] = mapped_column(
        ForeignKey("event_series.id", ondelete="CASCADE")
    )

    # When the repeat rule produced this occurrence. Together with series_id it identifies
    # the occurrence, and it doesn't change if the occurrence is later moved.
    original_start: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))
    # The actual start, same as original_start unless the occurrence was moved
    start_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))

    status: Mapped[str] = mapped_column(
        String,
        default=EventStatus.SCHEDULED.value,
        server_default=EventStatus.SCHEDULED.value,
    )

    # NULL means use the series title/location
    title_override: Mapped[str | None] = mapped_column(Text)
    location_override: Mapped[str | None] = mapped_column(Text)

    series: Mapped[EventSeries] = relationship(back_populates="occurrences")
