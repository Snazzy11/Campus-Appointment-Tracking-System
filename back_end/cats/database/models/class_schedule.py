from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from cats.database.database import Base

if TYPE_CHECKING:
    from cats.database.models.user.user import User


class ClassSchedule(Base):
    __tablename__ = "user_class_schedule"

    # DB relation
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        primary_key=True,  # restrict deletion of users
    )
    # Python-side relationship
    user: Mapped[User] = relationship(back_populates="class_schedules")
    section: Mapped[int] = mapped_column(primary_key=True)
    course_code: Mapped[str] = mapped_column(String(10))
    course_title: Mapped[str] = mapped_column(String(100))
    credits: Mapped[str] = mapped_column(String(3))
    days: Mapped[str] = mapped_column(String(5))
    times: Mapped[str] = mapped_column(String(30))
    dates: Mapped[str] = mapped_column(String(30))
    location: Mapped[str] = mapped_column(String(50))
    delivery: Mapped[str] = mapped_column(String(50))
    instructor_name: Mapped[str] = mapped_column(String(50))
