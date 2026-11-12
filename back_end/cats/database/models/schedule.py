from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from cats.database.database import Base


class Schedule(Base):
    __tablename__ = "user_schedule"

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
