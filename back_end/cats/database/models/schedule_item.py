# from sqlalchemy import String, DateTime, Boolean
# from sqlalchemy.orm import Mapped, mapped_column
# import datetime
from cats.database.database import Base


class ScheduleItem(Base):
    __tablename__ = "schedule_item"

    # item_id: Mapped[int] = mapped_column(primary_key=True)

    # start_time: Mapped[DateTime] = mapped_column(DateTime, default=datetime.datetime.now)
    # end_time: Mapped[DateTime] = mapped_column(DateTime)

    # title: Mapped[String] = mapped_column(String(100), nullable=False)
    # description: Mapped[String] = mapped_column(String(300), nullable=True)

    # is_repeating: Mapped[Boolean] = mapped_column(default=False)
    # with_who: Mapped[String] = mapped_column(String(50))

    # tag: Mapped[String] = mapped_column(String(30), nullable=True)
