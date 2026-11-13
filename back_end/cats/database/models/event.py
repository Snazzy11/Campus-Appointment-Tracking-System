"""For events on the calendar
EventSeries has metadata and "base" time
EventOccurrence` per meeting.

Every event, including one-offs, has a series row (a one-off has `rrule = NULL`) and at
least one occurrence row. The calendar UI reads `event_occurrences` joined to the series.
See `cats.events` for the code that creates, expands, and edits these rows.
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


# The columns store the plain string `.value`. Members are also `str` (because of the
# `str` mixin), so they can be passed anywhere a string is expected.
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

    __table_args__ = (  # Check duration has makes sense
        CheckConstraint("duration_min > 0", name="ck_event_series_duration_positive"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(
        Text
    )  # TODO make a FK when locations are fully implemented

    # restrict deletes a user with events cannot be deleted
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )

    # An EventType value. Annotated `str` because that is what the database returns;
    # cats.events validates it against EventType.
    event_type: Mapped[str] = mapped_column(String)

    # Type-specific fields. Validated in application code, one schema per event_type
    # (cats.events.details).
    details: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )

    # Not stored as fixed time
    timezone: Mapped[str] = mapped_column(String)  # IANA time e.g. 'America/Chicago'
    start_date: Mapped[datetime.date] = mapped_column(Date)  # first local date
    start_time: Mapped[datetime.time] = mapped_column(
        Time
    )  # "wall-clock" time in timezone
    duration_min: Mapped[int]  # minutes

    rrule: Mapped[str | None] = mapped_column(  # RFC 5545 RRULE value
        Text,
        nullable=True,  # Null when event is one-time
    )
    generated_until: Mapped[datetime.date | None] = mapped_column(
        Date
    )  # occurrences go up to and through this date

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

    original_start: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))
    start_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True)
    )  # only differs from original_start if it was moved
    end_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))

    status: Mapped[str] = mapped_column(
        String,
        default=EventStatus.SCHEDULED.value,
        server_default=EventStatus.SCHEDULED.value,
    )

    title_override: Mapped[str | None] = mapped_column(Text)
    location_override: Mapped[str | None] = mapped_column(Text)  # NULL = inherit

    series: Mapped[EventSeries] = relationship(back_populates="occurrences")
