from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ChatParticipation(Base):
    __tablename__ = 'chat_participation'
    message_id: Mapped[int] = mapped_column(ForeignKey('messages.id', ondelete='CASCADE'), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    consent_version: Mapped[int] = mapped_column(Integer, default=1)
