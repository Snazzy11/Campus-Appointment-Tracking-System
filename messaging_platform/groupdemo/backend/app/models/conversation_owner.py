from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, ForeignKeyConstraint, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ConversationOwner(Base):
    __tablename__ = "conversation_owners"
    conversation_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    promoted_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        ForeignKeyConstraint(["conversation_id", "user_id"], ["conversation_members.conversation_id", "conversation_members.user_id"], ondelete="CASCADE"),
    )
