"""Calendar / Schedule events API

An event is stored as two pieces
    EventSeries: Data a rrule
    EventOccurrence: One per event
The frontend doesn't want both, so endpoints will return unified occurrences
"""

from datetime import datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import AwareDatetime, BaseModel

from cats.api.dependencies import db_session
from cats.events.service import calendar_entries, calendar_entry

router = APIRouter(tags=["Schedule"])

# Keeps one request from asking for years of events at once.
MAX_RANGE = timedelta(days=366)


class EventOut(BaseModel):
    """One instance of an event"""

    occurrence_id: int
    series_id: int  # the series it belongs to; needed to get other related events
    event_type: str
    title: str
    location: str | None
    start_at: datetime  # always includes a UTC offset
    end_at: datetime
    status: str  # "scheduled", "cancelled", etc.
    is_recurring: bool
    details: dict[str, Any]  # type-specific fields, e.g. a class's course_code


@router.get("/events", response_model=list[EventOut])
def list_events(
    db: db_session,
    # TODO: get user from authentication
    owner_id: int,
    start: Annotated[AwareDatetime, Query(description="Range start, with an offset")],
    end: Annotated[AwareDatetime, Query(description="Range end (exclusive)")],
):
    """A user's events that start between `start` and `end`, minus cancelled ones."""
    if end <= start:
        raise HTTPException(status_code=422, detail="end must be after start")
    if end - start > MAX_RANGE:
        raise HTTPException(status_code=422, detail="range can be at most 366 days")
    entries = calendar_entries(db, owner_id, start, end)
    return [EventOut.model_validate(entry, from_attributes=True) for entry in entries]


@router.get("/events/{occurrence_id}", response_model=EventOut)
def get_event(db: db_session, occurrence_id: int):
    """One meeting by its occurrence id. Cancelled meetings are returned too."""
    entry = calendar_entry(db, occurrence_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="event not found")
    return EventOut.model_validate(entry, from_attributes=True)
