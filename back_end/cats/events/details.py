"""Type-specific event fields stored in `event_series.details` (JSONB).

One pydantic schema per `event_type`. Fields that are filtered, sorted, or joined on
belong in real columns, not here. If a type needs real relationships (for example a class
tied to a course and an instructor), give it an extension table keyed by series_id
instead of adding to these schemas.
"""

from typing import Any

from pydantic import BaseModel, ConfigDict, ValidationError

from cats.database.models.event import EventType


class _Details(BaseModel):
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


# One schema per EventType; adding a type to the enum without one fails the import-time
# check below, so the two cannot drift apart.
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
    """Return `details` validated against the schema for `event_type`.

    `event_type` is an EventType or its string value (e.g. "class"). Raises ValueError
    for an unknown event type or invalid fields.
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
