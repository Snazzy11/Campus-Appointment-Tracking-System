"""Private schedules. Expiration uses the campus timezone, including on the server."""
from datetime import date, datetime
from hashlib import sha256
import json
from typing import Literal
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..models import User
from ..models.schedule import ScheduleTerm, ScheduleCourse, ScheduleEvent
from ..services.db_dependency import get_db
from ..services.schedule_import import parse_csv
from .profiles import editable_user

router = APIRouter(prefix='/api/schedule', tags=['schedule'])


def campus_today():
    return datetime.now(ZoneInfo('America/Detroit')).date()


class TermInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    season: Literal['Fall', 'Spring', 'Summer']
    year: int = Field(ge=2020, le=2100)
    start_date: date
    end_date: date

    @model_validator(mode='after')
    def dates(self):
        if self.start_date > self.end_date or (self.end_date - self.start_date).days > 240:
            raise ValueError('Term dates must be ordered and no more than 240 days apart.')
        if self.start_date.year != self.year or self.end_date.year != self.year:
            raise ValueError('Both term dates must be in the selected year.')
        return self


class ImportInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    term: TermInput
    csv: str = Field(min_length=1, max_length=500_000)


class SaveInput(ImportInput):
    sections: list[str] = Field(min_length=1, max_length=500)
    version: str


def get_term(db, user, term):
    found = db.scalar(select(ScheduleTerm).where(ScheduleTerm.user_id == user.id, ScheduleTerm.season == term.season, ScheduleTerm.year == term.year))
    if term.end_date < campus_today() or (found and found.end_date < campus_today()):
        raise HTTPException(422, 'This term has ended. Choose a current or upcoming term.')
    if found and (found.start_date != term.start_date or found.end_date != term.end_date):
        raise HTTPException(409, 'Use the saved dates for this term.')
    return found


def review(payload, user, db):
    term = get_term(db, user, payload.term)
    existing = {c.section: c for c in db.scalars(select(ScheduleCourse).where(ScheduleCourse.term_id == term.id))} if term else {}
    version = sha256(json.dumps({k: v.data for k, v in existing.items()}, sort_keys=True).encode()).hexdigest()
    try:
        parsed, issues = parse_csv(payload.csv)
    except ValueError as error:
        raise HTTPException(422, str(error))
    courses = []
    for course in parsed:
        if any(m['start_date'] < payload.term.start_date.isoformat() or m['end_date'] > payload.term.end_date.isoformat() for m in course['meetings']):
            issues.append({'row': None, 'message': f"{course['course']} ({course['section']}): meeting dates fall outside this term. Correct the CSV or term dates."})
            continue
        prior = existing.get(course['section'])
        courses.append({**course, 'status': 'new' if not prior else 'duplicate' if prior.data == course else 'changed', 'previous': prior.data if prior and prior.data != course else None})
    return term, existing, {'courses': courses, 'issues': issues, 'version': version}


@router.get('')
def schedule(response: Response, user: User = Depends(editable_user), db: Session = Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    terms = list(db.scalars(select(ScheduleTerm).where(ScheduleTerm.user_id == user.id, ScheduleTerm.end_date >= campus_today()).order_by(ScheduleTerm.start_date)))
    return {'today': campus_today(), 'timezone': 'America/Detroit', 'terms': [dict(id=t.id, season=t.season, year=t.year, start_date=t.start_date, end_date=t.end_date,
        events=[dict(id=e.id, version=e.version, **e.data) for e in db.scalars(select(ScheduleEvent).where(ScheduleEvent.term_id == t.id).order_by(ScheduleEvent.id))],
        courses=[dict(id=c.id, **c.data) for c in db.scalars(select(ScheduleCourse).where(ScheduleCourse.term_id == t.id).order_by(ScheduleCourse.section))]) for t in terms]}


@router.post('/preview')
def preview(payload: ImportInput, response: Response, user: User = Depends(editable_user), db: Session = Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    return review(payload, user, db)[2]


@router.post('/import')
def save(payload: SaveInput, response: Response, user: User = Depends(editable_user), db: Session = Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    # Serialize imports/removals for this student; a stale preview cannot overwrite newer work.
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    term, existing, result = review(payload, user, db)
    if result['version'] != payload.version:
        raise HTTPException(409, 'Your schedule changed. Review this import again before saving.')
    selected = set(payload.sections)
    valid = {c['section']: c for c in result['courses']}
    if not selected.issubset(valid):
        raise HTTPException(422, 'One or more selected sections could not be imported. Review the CSV again.')
    changes = [valid[s] for s in selected if valid[s]['status'] != 'duplicate']
    if not changes:
        return {'added': 0, 'updated': 0}
    if not term:
        term = ScheduleTerm(user_id=user.id, **payload.term.model_dump())
        db.add(term)
        db.flush()
    added = updated = 0
    for course in changes:
        data = {k: v for k, v in course.items() if k not in ('status', 'previous')}
        if course['section'] in existing:
            existing[course['section']].data = data
            updated += 1
        else:
            db.add(ScheduleCourse(term_id=term.id, section=course['section'], data=data))
            added += 1
    db.commit()
    return {'added': added, 'updated': updated}


@router.post('/courses/{course_id}/remove')
def remove(course_id: int, user: User = Depends(editable_user), db: Session = Depends(get_db)):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    course = db.scalar(select(ScheduleCourse).join(ScheduleTerm).where(ScheduleCourse.id == course_id, ScheduleTerm.user_id == user.id, ScheduleTerm.end_date >= campus_today()))
    if not course:
        raise HTTPException(404, 'Course not found.')
    db.delete(course)
    db.commit()
    return {'removed': True}


@router.post('/terms')
def create_term(payload: TermInput, user: User = Depends(editable_user), db: Session = Depends(get_db)):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    term = get_term(db, user, payload)
    if not term:
        term = ScheduleTerm(user_id=user.id, **payload.model_dump())
        db.add(term)
        db.flush()
    term_id = term.id
    db.commit()
    return {'id': term_id}


class BuildingPlace(BaseModel):
    model_config = ConfigDict(extra='forbid')
    kind: Literal['building']
    id: int = Field(ge=1, le=9223372036854775807)
    label: str | None = Field(default=None, max_length=200)


class PinPlace(BaseModel):
    model_config = ConfigDict(extra='forbid')
    kind: Literal['pin']
    longitude: float = Field(ge=-84.80, le=-84.74, allow_inf_nan=False)
    latitude: float = Field(ge=43.56, le=43.62, allow_inf_nan=False)


class EventInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=120)
    date: date
    start: int = Field(ge=0, le=1439, strict=True)
    end: int = Field(ge=1, le=1440, strict=True)
    location: str = Field(default='', max_length=200)
    notes: str = Field(default='', max_length=2000)
    place: BuildingPlace | PinPlace | None = Field(default=None, discriminator='kind')
    version: int | None = Field(default=None, ge=1)

    @model_validator(mode='after')
    def times(self):
        if self.end <= self.start:
            raise ValueError('End time must be after start time on the same day.')
        return self


def owned_term(db, user, term_id):
    term = db.scalar(select(ScheduleTerm).where(ScheduleTerm.id == term_id, ScheduleTerm.user_id == user.id, ScheduleTerm.end_date >= campus_today()))
    if not term:
        raise HTTPException(404, 'Term not found or it has ended.')
    return term


def validate_event(payload, term):
    if not term.start_date <= payload.date <= term.end_date:
        raise HTTPException(422, 'The event date must be within this term.')
    data = payload.model_dump(mode='json', exclude={'version'})
    if isinstance(payload.place, BuildingPlace):
        from ..geospatial.database import get_geo_db
        from .geographic import building
        for geo_db in get_geo_db():
            feature = building(payload.place.id, geo_db)
            data['place']['label'] = feature['properties'].get('name') or 'Unnamed building'
    return data


@router.post('/terms/{term_id}/events')
def add_event(term_id: int, payload: EventInput, user: User = Depends(editable_user), db: Session = Depends(get_db)):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    term = owned_term(db, user, term_id)
    event = ScheduleEvent(term_id=term.id, data=validate_event(payload, term), version=1)
    db.add(event)
    db.flush()
    result = dict(id=event.id, version=event.version, **event.data)
    db.commit()
    return result


def owned_event(db, user, event_id):
    event = db.scalar(select(ScheduleEvent).join(ScheduleTerm).where(ScheduleEvent.id == event_id, ScheduleTerm.user_id == user.id, ScheduleTerm.end_date >= campus_today()))
    if not event:
        raise HTTPException(404, 'Event not found.')
    return event


@router.post('/events/{event_id}')
def edit_event(event_id: int, payload: EventInput, user: User = Depends(editable_user), db: Session = Depends(get_db)):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    event = owned_event(db, user, event_id)
    if payload.version != event.version:
        raise HTTPException(409, 'This event changed. Close the editor and reopen it before saving.')
    event.data = validate_event(payload, owned_term(db, user, event.term_id))
    event.version += 1
    result = dict(id=event.id, version=event.version, **event.data)
    db.commit()
    return result


class EventVersion(BaseModel):
    version: int = Field(ge=1)


@router.post('/events/{event_id}/remove')
def remove_event(event_id: int, payload: EventVersion, user: User = Depends(editable_user), db: Session = Depends(get_db)):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    event = owned_event(db, user, event_id)
    if event.version != payload.version:
        raise HTTPException(409, 'This event changed. Close the editor and reopen it before removing it.')
    db.delete(event)
    db.commit()
    return {'removed': True}
