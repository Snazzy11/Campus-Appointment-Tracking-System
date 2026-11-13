from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from cats.database.database import Base

if TYPE_CHECKING:
    from cats.database.models.class_schedule import ClassSchedule


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(50))
    last_name: Mapped[str] = mapped_column(String(50))

    # passive delete tells it DB ignore deletes and let the restrict on the other side work
    class_schedules: Mapped[list[ClassSchedule]] = relationship(
        back_populates="user", passive_deletes="all"
    )
