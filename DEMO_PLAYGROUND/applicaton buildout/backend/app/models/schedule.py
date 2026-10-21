from datetime import date
from sqlalchemy import Date, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class ScheduleTerm(Base):
    __tablename__ = 'schedule_terms'
    __table_args__ = (UniqueConstraint('user_id', 'season', 'year'),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    season: Mapped[str] = mapped_column(String(10))
    year: Mapped[int] = mapped_column(Integer)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)


class ScheduleCourse(Base):
    __tablename__ = 'schedule_courses'
    __table_args__ = (UniqueConstraint('term_id', 'section'),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    term_id: Mapped[int] = mapped_column(ForeignKey('schedule_terms.id', ondelete='CASCADE'), index=True)
    section: Mapped[str] = mapped_column(String(40))
    data: Mapped[dict] = mapped_column(JSON)


class ScheduleEvent(Base):
    __tablename__ = 'schedule_events'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    term_id: Mapped[int] = mapped_column(ForeignKey('schedule_terms.id', ondelete='CASCADE'), index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    data: Mapped[dict] = mapped_column(JSON)
