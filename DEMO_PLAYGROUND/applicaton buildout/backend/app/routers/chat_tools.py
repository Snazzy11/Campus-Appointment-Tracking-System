"""Explicit schedule sharing and revocable, conversation-scoped availability consent."""
from datetime import date, timedelta
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from ..models import Message, User, Conversation, ConversationMember
from ..models.chat_participation import ChatParticipation
from ..models.schedule import ScheduleTerm
from ..services.auth_dependency import require_user
from ..services.db_dependency import get_db
from ..services.private_events import private_events
from ..services.chat_calendar import entries, common_free
from .messages import serialize_message, subscribers
from .schedules import campus_today

router = APIRouter(prefix='/api/chat', tags=['chat-tools'])


class Window(BaseModel):
    scope: Literal['day', 'week', 'term'] = 'week'
    date: date
    term_id: int | None = None


def window(payload, db, user):
    start = payload.date
    end = start
    if payload.scope == 'week':
        start -= timedelta(days=start.weekday())
        end = start + timedelta(days=6)
    elif payload.scope == 'term':
        term = db.get(ScheduleTerm, payload.term_id) if payload.term_id else None
        if not term or term.user_id != user.id:
            raise HTTPException(422, 'Choose one of your terms.')
        start, end = term.start_date, term.end_date
    if end < campus_today():
        raise HTTPException(422, 'Choose a current or upcoming date or term.')
    return start, end


def member(db, conversation_id, user):
    db.scalar(select(Conversation).where(Conversation.id == conversation_id).with_for_update())
    if not db.get(ConversationMember, (conversation_id, user.id)):
        raise HTTPException(404, 'Conversation not found')


def visible_message(db, message_id, user):
    # Conversation lock serializes membership changes and invitation consent.
    msg = db.get(Message, message_id)
    if not msg:
        raise HTTPException(404, 'Message not found')
    if msg.conversation_id is not None:
        member(db, msg.conversation_id, user)
    db.refresh(msg, with_for_update=True)
    return msg


def result(msg):
    return {**serialize_message(msg), 'conversation_id': msg.conversation_id, 'attachment': msg.attachment}


def publish(db, msg):
    value = result(msg)
    if msg.conversation_id is not None:
        recipients = list(db.scalars(select(ConversationMember.user_id).where(ConversationMember.conversation_id == msg.conversation_id)))
        private_events.publish(recipients, value)
    else:
        import asyncio
        for queue in tuple(subscribers):
            try:
                queue.put_nowait(value)
            except asyncio.QueueFull:
                subscribers.discard(queue)
                queue.get_nowait()
                queue.put_nowait(None)
    return value


class Create(Window):
    kind: Literal['schedule', 'availability']


@router.post('/{conversation_id}/cards', status_code=201)
async def create(conversation_id: int, payload: Create, user: User = Depends(require_user), db: Session = Depends(get_db)):
    member(db, conversation_id, user)
    start, end = window(payload, db, user)
    attachment = dict(type=payload.kind, scope=payload.scope, start_date=str(start), end_date=str(end), timezone='America/Detroit')
    if payload.kind == 'schedule':
        attachment['entries'] = entries(db, user.id, start, end)
    msg = Message(conversation_id=conversation_id, user_id=user.id, sender=user.email,
                  text='Shared schedule' if payload.kind == 'schedule' else 'Find a time together', attachment=attachment)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return publish(db, msg)


def invitation(db, message_id, user):
    msg = visible_message(db, message_id, user)
    if not msg.attachment or msg.attachment.get('type') != 'availability':
        raise HTTPException(404, 'Invitation no longer available')
    if msg.attachment['end_date'] < str(campus_today()):
        raise HTTPException(410, 'This invitation has ended')
    return msg


def opted_ids(db, msg):
    return list(db.scalars(select(ChatParticipation.user_id).join(ConversationMember, ConversationMember.user_id == ChatParticipation.user_id).where(ChatParticipation.message_id == msg.id, ConversationMember.conversation_id == msg.conversation_id)))


@router.get('/cards/{message_id}/participants')
def participants(message_id: int, response: Response, user: User = Depends(require_user), db: Session = Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    msg = invitation(db, message_id, user)
    return {'user_ids': opted_ids(db, msg)}


class Consent(BaseModel):
    participate: bool


@router.post('/cards/{message_id}/consent')
async def consent(message_id: int, payload: Consent, user: User = Depends(require_user), db: Session = Depends(get_db)):
    msg = invitation(db, message_id, user)
    prior = db.get(ChatParticipation, (message_id, user.id))
    if payload.participate and not prior:
        db.add(ChatParticipation(message_id=message_id, user_id=user.id))
    elif not payload.participate and prior:
        db.delete(prior)
    msg.version += 1
    db.commit()
    db.refresh(msg)
    publish(db, msg)
    return {'user_ids': opted_ids(db, msg)}


class Match(BaseModel):
    user_ids: list[int] = Field(min_length=2, max_length=100)
    start_date: date
    end_date: date
    first: int = Field(default=480, ge=0, le=1410)
    last: int = Field(default=1320, ge=30, le=1440)

    @model_validator(mode='after')
    def ordered(self):
        if self.start_date > self.end_date or (self.end_date-self.start_date).days > 240 or self.last-self.first < 30:
            raise ValueError('Choose ordered dates and a time window of at least 30 minutes.')
        if len(set(self.user_ids)) != len(self.user_ids):
            raise ValueError('Choose distinct participants.')
        return self


@router.post('/cards/{message_id}/availability')
def availability(message_id: int, payload: Match, response: Response, user: User = Depends(require_user), db: Session = Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    msg = invitation(db, message_id, user)
    allowed = opted_ids(db, msg)
    if user.id not in allowed or not set(payload.user_ids).issubset(allowed):
        raise HTTPException(403, 'Only opted-in current members can compare availability.')
    if str(payload.start_date) < msg.attachment['start_date'] or str(payload.end_date) > msg.attachment['end_date']:
        raise HTTPException(422, 'Choose dates within this invitation.')
    # Missing schedules are unknown, never silently interpreted as completely free.
    for uid in payload.user_ids:
        terms = db.scalars(select(ScheduleTerm).where(ScheduleTerm.user_id == uid)).all()
        day = payload.start_date
        while day <= payload.end_date:
            if not any(t.start_date <= day <= t.end_date for t in terms):
                raise HTTPException(422, 'A selected participant has no schedule term covering these dates.')
            day += timedelta(days=1)
    return {'timezone': 'America/Detroit', 'minimum_minutes': 30, 'windows': common_free([entries(db, uid, payload.start_date, payload.end_date) for uid in payload.user_ids], payload.start_date, payload.end_date, payload.first, payload.last)}


class Edit(BaseModel):
    version: int = Field(ge=1)
    text: str = Field(min_length=1, max_length=5000)


class Remove(BaseModel):
    version: int = Field(ge=1)


def owned(db, mid, user, version):
    msg = visible_message(db, mid, user)
    if msg.user_id != user.id or msg.kind != 'user':
        raise HTTPException(403, 'You can only change your own messages.')
    if msg.version != version:
        raise HTTPException(409, 'This message changed. Reopen it and try again.')
    return msg


@router.post('/messages/{message_id}/edit')
async def edit(message_id: int, payload: Edit, user: User = Depends(require_user), db: Session = Depends(get_db)):
    msg = owned(db, message_id, user, payload.version)
    if not payload.text.strip():
        raise HTTPException(422, 'Enter a message.')
    msg.text, msg.edited = payload.text.strip(), True
    msg.version += 1
    db.commit()
    db.refresh(msg)
    return publish(db, msg)


@router.post('/messages/{message_id}/remove')
async def remove(message_id: int, payload: Remove, user: User = Depends(require_user), db: Session = Depends(get_db)):
    msg = owned(db, message_id, user, payload.version)
    db.execute(delete(ChatParticipation).where(ChatParticipation.message_id == msg.id))
    msg.text, msg.attachment, msg.kind = 'Message deleted', None, 'deleted'
    msg.version += 1
    db.commit()
    db.refresh(msg)
    return publish(db, msg)
