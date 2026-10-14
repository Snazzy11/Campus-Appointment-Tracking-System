
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, func, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    cognito_sub: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    email: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
    )

    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    messages = relationship(
        "Message",
        back_populates="user",
    )
    conversation_memberships = relationship(
        "ConversationMember",
        back_populates="user",
        cascade="all, delete-orphan",
    )


Index(
    "ix_users_email_prefix",
    func.lower(User.email).label("email_lower"),
    postgresql_ops={"email_lower": "text_pattern_ops"},
    postgresql_where=User.email_verified.is_(True),
)
