
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    PrimaryKeyConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ConversationMember(Base):
    __tablename__ = "conversation_members"

    conversation_id: Mapped[int] = mapped_column(
        ForeignKey(
            "conversations.id",
            ondelete="CASCADE",
        ),
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        index=True,
    )

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        PrimaryKeyConstraint(
            "conversation_id",
            "user_id",
        ),
    )

    conversation = relationship(
        "Conversation",
        back_populates="members",
    )

    user = relationship(
        "User",
        back_populates="conversation_memberships",
    )
