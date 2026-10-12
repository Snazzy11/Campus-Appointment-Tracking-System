
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="direct",
        server_default="direct",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    members = relationship(
        "ConversationMember",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )

    messages = relationship(
        "Message",
        back_populates="conversation",
    )

    direct_key: Mapped[str | None] = mapped_column(
        String(100),
        unique=True,
        nullable=True,
    )
