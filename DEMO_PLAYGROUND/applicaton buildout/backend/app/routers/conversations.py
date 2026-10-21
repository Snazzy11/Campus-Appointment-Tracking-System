
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from ..models import (
    User,
    Message,
    Conversation,
    ConversationMember,
    ConversationOwner,
)
from ..services.auth_dependency import require_user
from ..services.profiles import public_profile
from ..services.db_dependency import get_db
from ..services.database import SessionLocal
from ..services.private_events import private_events


router = APIRouter(prefix="/api/conversations")


# --------------------------------------------------
# Request and response schemas
# --------------------------------------------------

class ConversationCreate(BaseModel):
    recipient_id: int = Field(gt=0)


class PrivateMessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class PrivateMessageResponse(BaseModel):
    id: int
    conversation_id: int
    user_id: int | None
    attachment: dict | None = None
    version: int = 1
    edited: bool = False
    kind: str = "user"
    profile: dict | None = None
    sender: str
    text: str
    created_at: datetime


# --------------------------------------------------
# Helpers
# --------------------------------------------------

def conversation_response(
    conversation: Conversation,
    db: Session,
):
    members = db.scalars(
        select(User)
        .join(
            ConversationMember,
            ConversationMember.user_id == User.id,
        )
        .where(
            ConversationMember.conversation_id
            == conversation.id
        )
        .order_by(User.id)
    ).all()

    latest = db.scalar(select(Message).where(Message.conversation_id == conversation.id).order_by(Message.id.desc()).limit(1))
    return {
        "last_message": ({"id": latest.id, "conversation_id": conversation.id, "user_id": latest.user_id,
                          "sender": latest.sender, "kind": latest.kind, "text": latest.text[:160],
                          "created_at": latest.created_at} if latest else None),
        "id": conversation.id,
        "type": conversation.type,
        "name": conversation.name,
        "owner_ids": list(db.scalars(select(ConversationOwner.user_id).where(ConversationOwner.conversation_id == conversation.id).order_by(ConversationOwner.user_id))),
        "created_at": conversation.created_at,
        "members": [
            {
                **public_profile(member),
                "email": member.email,
            }
            for member in members
        ],
    }


def require_conversation_member(
    conversation_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> Conversation:
    # Lock first, then check membership with a fresh READ COMMITTED statement.
    conversation = db.scalar(select(Conversation).where(Conversation.id == conversation_id).with_for_update())
    if conversation is None or db.get(ConversationMember, (conversation_id, user.id)) is None:
        raise HTTPException(404, "Conversation not found")

    return conversation


# --------------------------------------------------
# POST /api/conversations
# Create or retrieve a direct conversation
# --------------------------------------------------

@router.post("", status_code=201)
def create_conversation(
    payload: ConversationCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    if payload.recipient_id == user.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot message yourself",
        )

    recipient = db.get(User, payload.recipient_id)

    if recipient is None:
        raise HTTPException(
            status_code=404,
            detail="Recipient not found",
        )

    first, second = sorted(
        [user.id, recipient.id]
    )
    direct_key = f"{first}:{second}"

    existing = db.scalar(
        select(Conversation).where(
            Conversation.direct_key == direct_key
        )
    )

    if existing is not None:
        return conversation_response(existing, db)

    try:
        conversation = Conversation(
            type="direct",
            direct_key=direct_key,
        )

        db.add(conversation)
        db.flush()

        db.add_all([
            ConversationMember(
                conversation_id=conversation.id,
                user_id=user.id,
            ),
            ConversationMember(
                conversation_id=conversation.id,
                user_id=recipient.id,
            ),
        ])

        db.commit()
        db.refresh(conversation)

    except IntegrityError:
        db.rollback()

        # Another request may have created the DM.
        conversation = db.scalar(
            select(Conversation).where(
                Conversation.direct_key == direct_key
            )
        )

        if conversation is None:
            raise

    return conversation_response(conversation, db)


# --------------------------------------------------
# GET /api/conversations
# List conversations belonging to current user
# --------------------------------------------------

@router.get("")
def list_conversations(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    conversations = db.scalars(
        select(Conversation)
        .join(
            ConversationMember,
            ConversationMember.conversation_id
            == Conversation.id,
        )
        .where(
            ConversationMember.user_id == user.id
        )
        .order_by(Conversation.created_at.desc())
    ).all()

    return [
        conversation_response(conversation, db)
        for conversation in conversations
    ]


# --------------------------------------------------
# GET /api/conversations/{id}/messages
# Retrieve private message history
# --------------------------------------------------

@router.get(
    "/{conversation_id}/messages",
    response_model=list[PrivateMessageResponse],
)
def get_private_messages(
    before_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=100, ge=1, le=100),
    conversation: Conversation = Depends(
        require_conversation_member
    ),
    db: Session = Depends(get_db),
):
    messages = db.scalars(
        select(Message)
        .where(
            Message.conversation_id == conversation.id,
            Message.id < before_id if before_id is not None else True,
        )
        .order_by(Message.id.desc())
        .limit(limit)
    ).all()

    return [
        PrivateMessageResponse(
            id=message.id,
            conversation_id=message.conversation_id,
            user_id=message.user_id,
            kind=message.kind, attachment=message.attachment, version=message.version, edited=message.edited,
            profile=public_profile(message.user) if message.user else None,
            sender=message.sender,
            text=message.text,
            created_at=message.created_at,
        )
        for message in reversed(messages)
    ]


# --------------------------------------------------
# POST /api/conversations/{id}/messages
# Save message and notify participants via SSE
# --------------------------------------------------

@router.post(
    "/{conversation_id}/messages",
    response_model=PrivateMessageResponse,
    status_code=201,
)
async def send_private_message(
    payload: PrivateMessageCreate,
    conversation_id: int,
    user: User = Depends(require_user),
):
    # Copy scalar values before entering the threadpool.
    user_id = user.id
    sender_email = user.email
    message_text = payload.text

    def save_message():
        # Create and use the database session
        # entirely within the worker thread.
        with SessionLocal() as db:

            # Serialize against membership changes before checking permission.
            db.scalar(select(Conversation).where(Conversation.id == conversation_id).with_for_update())
            # Verify conversation membership.
            membership = db.scalar(
                select(ConversationMember).where(
                    ConversationMember.conversation_id
                    == conversation_id,
                    ConversationMember.user_id == user_id,
                )
            )

            if membership is None:
                raise HTTPException(
                    status_code=404,
                    detail="Conversation not found",
                )

            message = Message(
                conversation_id=conversation_id,
                user_id=user_id,
                sender=sender_email,
                text=message_text,
            )

            db.add(message)
            db.commit()
            db.refresh(message)

            # Find every authorized recipient.
            member_ids = db.scalars(
                select(ConversationMember.user_id).where(
                    ConversationMember.conversation_id
                    == conversation_id
                )
            ).all()

            response = PrivateMessageResponse(
                id=message.id,
                conversation_id=message.conversation_id,
                user_id=message.user_id,
                kind=message.kind, attachment=message.attachment, version=message.version, edited=message.edited,
                profile=public_profile(message.user) if message.user else None,
                sender=message.sender,
                text=message.text,
                created_at=message.created_at,
            )

            return response, list(member_ids)

    # Run synchronous SQLAlchemy operations
    # outside the asyncio event loop.
    response, member_ids = await run_in_threadpool(
        save_message
    )

    # Publish only after the message is committed.
    # This runs on the event-loop thread.
    private_events.publish(
        member_ids,
        response.model_dump(mode="json"),
    )

    return response
