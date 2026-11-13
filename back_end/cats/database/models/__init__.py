# Import every model here so they all register on Base.metadata.
# If you dont import here the table is invisible

from cats.database.models.class_schedule import ClassSchedule
from cats.database.models.location import Location
from cats.database.models.rso import RSO
from cats.database.models.schedule_item import ScheduleItem
from cats.database.models.user.user import User

__all__ = ["RSO", "ClassSchedule", "Location", "ScheduleItem", "User"]
