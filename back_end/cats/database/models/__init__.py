# Import every model here so they all register on Base.metadata.
# If you dont import here the table is invisible

from cats.database.models.event import EventOccurrence, EventSeries
from cats.database.models.location import Location
from cats.database.models.rso import RSO
from cats.database.models.user.user import User

__all__ = [
    "RSO",
    "EventOccurrence",
    "EventSeries",
    "Location",
    "User",
]
