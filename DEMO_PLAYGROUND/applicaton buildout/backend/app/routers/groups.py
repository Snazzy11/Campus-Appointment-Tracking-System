"""Group changes share a conversation row lock and commit status messages atomically."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from starlette.concurrency import run_in_threadpool

from ..models import Conversation, ConversationMember, ConversationOwner, Message, User
from ..services.auth_dependency import require_user
from ..services.database import SessionLocal
from ..services.private_events import private_events
from .conversations import conversation_response, PrivateMessageResponse

router = APIRouter(prefix="/api/groups", tags=["groups"])
MAX_MEMBERS = 50


class GroupName(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Enter a group name")
        return value


class GroupCreate(GroupName):
    member_ids: list[int] = Field(default_factory=list, max_length=49)

    @field_validator("member_ids")
    @classmethod
    def positive_ids(cls, value):
        if any(member < 1 for member in value):
            raise ValueError("Invalid member ID")
        return value


class GroupMember(BaseModel):
    user_id: int = Field(gt=0)


def status(db, group, text):
    message = Message(conversation_id=group.id, user_id=None, sender="Group", text=text, kind="system")
    db.add(message)
    return message


def finish(db, group, notices, previous_members=()):
    db.flush()
    members = list(db.scalars(select(ConversationMember.user_id).where(ConversationMember.conversation_id == group.id)))
    response = conversation_response(group, db)
    events = [PrivateMessageResponse(id=m.id, conversation_id=group.id, user_id=None, sender=m.sender, text=m.text, kind="system", created_at=m.created_at).model_dump(mode="json") for m in notices]
    db.commit()
    return response, members, list(set(members) | set(previous_members)), events


def publish(saved):
    response, members, affected, events = saved
    for event in events:
        private_events.publish(members, event)
    private_events.publish(affected, {"_event": "conversation_updated", "conversation_id": response["id"], "removed_user_ids": [uid for uid in affected if uid not in members]})
    return response


@router.post("", status_code=201)
async def create_group(payload: GroupCreate, user: User = Depends(require_user)):
    actor_id = user.id

    def save():
        with SessionLocal() as db:
            actor = db.get(User, actor_id)
            ids = sorted(set(payload.member_ids) | {actor_id})
            members = list(db.scalars(select(User).where(User.id.in_(ids)).order_by(User.id)))
            if len(members) != len(ids):
                raise HTTPException(404, "Recipient not found")
            group = Conversation(type="group", name=payload.name)
            db.add(group)
            db.flush()
            db.add_all([ConversationMember(conversation_id=group.id, user_id=member.id) for member in members])
            db.flush()
            db.add(ConversationOwner(conversation_id=group.id, user_id=actor_id, promoted_by_user_id=actor_id))
            notices = [status(db, group, f'{actor.email} created “{group.name}”.')]
            notices.extend(status(db, group, f'{member.email} joined the group (added by {actor.email}).') for member in members if member.id != actor_id)
            return finish(db, group, notices)

    return publish(await run_in_threadpool(save))


async def change(group_id, actor_id, operation, target_id=None, name=None):
    def save():
        with SessionLocal() as db:
            group = db.scalar(select(Conversation).where(Conversation.id == group_id).with_for_update())
            if group is None or group.type != "group" or db.get(ConversationMember, (group_id, actor_id)) is None:
                raise HTTPException(404, "Group not found")
            if operation != "leave" and db.get(ConversationOwner, (group_id, actor_id)) is None:
                raise HTTPException(403, "Only group owners can make this change")
            actor = db.get(User, actor_id)
            previous = list(db.scalars(select(ConversationMember.user_id).where(ConversationMember.conversation_id == group_id)))
            notices = []
            if operation == "rename":
                if group.name != name:
                    old = group.name
                    group.name = name
                    notices.append(status(db, group, f'{actor.email} renamed “{old}” to “{name}”.'))
            else:
                target_id_value = actor_id if operation == "leave" else target_id
                target = db.get(User, target_id_value)
                if target is None:
                    raise HTTPException(404, "Recipient not found")
                membership = db.get(ConversationMember, (group_id, target_id_value))
                owner = db.get(ConversationOwner, (group_id, target_id_value))
                if operation == "add":
                    if membership is None:
                        if len(previous) >= MAX_MEMBERS:
                            raise HTTPException(409, "A group can have at most 50 members")
                        db.add(ConversationMember(conversation_id=group_id, user_id=target_id_value))
                        notices.append(status(db, group, f'{target.email} joined the group (added by {actor.email}).'))
                elif operation == "promote":
                    if membership is None:
                        raise HTTPException(404, "Member not found")
                    if owner is None:
                        db.add(ConversationOwner(conversation_id=group_id, user_id=target_id_value, promoted_by_user_id=actor_id))
                        notices.append(status(db, group, f'{actor.email} promoted {target.email} to owner.'))
                elif operation in ("remove", "leave"):
                    if membership is None:
                        raise HTTPException(404, "Member not found")
                    if owner is not None:
                        count = db.scalar(select(func.count()).select_from(ConversationOwner).where(ConversationOwner.conversation_id == group_id))
                        if count <= 1:
                            raise HTTPException(409, "Promote another member before the last owner leaves or is removed")
                        db.delete(owner)
                        db.flush()
                    from sqlalchemy import delete
                    from ..models.chat_participation import ChatParticipation
                    db.execute(delete(ChatParticipation).where(ChatParticipation.user_id == target_id_value, ChatParticipation.message_id.in_(select(Message.id).where(Message.conversation_id == group_id))))
                    db.delete(membership)
                    text = f'{target.email} left the group.' if target_id_value == actor_id else f'{actor.email} removed {target.email} from the group.'
                    notices.append(status(db, group, text))
            return finish(db, group, notices, previous)
    return publish(await run_in_threadpool(save))


@router.post("/{group_id}/rename")
async def rename(group_id: int, payload: GroupName, user: User = Depends(require_user)):
    return await change(group_id, user.id, "rename", name=payload.name)


@router.post("/{group_id}/members")
async def add_member(group_id: int, payload: GroupMember, user: User = Depends(require_user)):
    return await change(group_id, user.id, "add", payload.user_id)


@router.post("/{group_id}/remove-member")
async def remove_member(group_id: int, payload: GroupMember, user: User = Depends(require_user)):
    return await change(group_id, user.id, "remove", payload.user_id)


@router.post("/{group_id}/promote")
async def promote(group_id: int, payload: GroupMember, user: User = Depends(require_user)):
    return await change(group_id, user.id, "promote", payload.user_id)


@router.post("/{group_id}/leave")
async def leave(group_id: int, user: User = Depends(require_user)):
    await change(group_id, user.id, "leave")
    return {"left": True}
