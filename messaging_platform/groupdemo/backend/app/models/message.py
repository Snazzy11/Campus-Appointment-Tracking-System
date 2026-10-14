
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    sender: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
    )

    text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="user", server_default="user")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="messages",
    )
    conversation_id: Mapped[int | None] = mapped_column(
        ForeignKey("conversations.id"),
        nullable=True,
        index=True,
    )
    conversation = relationship(
        "Conversation",
        back_populates="messages",
    )

Index("ix_messages_conversation_history", Message.conversation_id, Message.id)
