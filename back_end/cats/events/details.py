"""Validation for the type-specific `details` JSON on an event series.

Each event type has a small pydantic model listing the fields it allows. Anything you
need to filter or join on should be a real column instead, and a type that needs real
relationships (a class tied to a course, say) is better off with its own table keyed by
series id.
"""

from typing import Any

from pydantic import BaseModel, ConfigDict, ValidationError

from cats.database.models.event import EventType


class _Details(BaseModel):
    # Reject unknown keys so a typo doesn't get saved silently.
    model_config = ConfigDict(extra="forbid")


class ClassDetails(_Details):
    course_code: str | None = None
    section: int | None = None
    instructor_name: str | None = None
    delivery: str | None = None


class ClubDetails(_Details):
    rso_id: int | None = None


class MeetingDetails(_Details):
    agenda: str | None = None
    attendees: list[str] = []


class WorkDetails(_Details):
    pass


# Every EventType needs an entry here; the assert below catches a new type added without one.
DETAILS_SCHEMAS: dict[EventType, type[_Details]] = {
    EventType.CLASS: ClassDetails,
    EventType.CLUB: ClubDetails,
    EventType.MEETING: MeetingDetails,
    EventType.WORK: WorkDetails,
}
assert set(DETAILS_SCHEMAS) == set(EventType), "every EventType needs a details schema"


def validate_details(
    event_type: str | EventType, details: dict[str, Any] | None
) -> dict[str, Any]:
    """Check `details` against the schema for `event_type` and return the cleaned dict.

    Accepts an EventType or its string value (like "class"). Raises ValueError for an
    unknown type or invalid fields.
    """
    try:
        kind = EventType(event_type)
    except ValueError:
        known = ", ".join(t.value for t in EventType)
        raise ValueError(
            f"unknown event_type {event_type!r} (known types: {known})"
        ) from None
    try:
        return (
            DETAILS_SCHEMAS[kind]
            .model_validate(details or {})
            .model_dump(exclude_none=True)
        )
    except ValidationError as error:
        raise ValueError(f"invalid details for {kind.value!r}: {error}") from error
