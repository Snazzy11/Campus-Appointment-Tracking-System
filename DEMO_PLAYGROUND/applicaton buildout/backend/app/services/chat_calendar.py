"""Date-only schedule expansion in campus time; availability never returns class details."""
from datetime import timedelta
from sqlalchemy import select
from ..models.schedule import ScheduleTerm, ScheduleCourse, ScheduleEvent


def entries(db, user_id, start, end):
    result = []
    terms = db.scalars(select(ScheduleTerm).where(ScheduleTerm.user_id == user_id, ScheduleTerm.start_date <= end, ScheduleTerm.end_date >= start)).all()
    for term in terms:
        courses = db.scalars(select(ScheduleCourse).where(ScheduleCourse.term_id == term.id)).all()
        day = max(start, term.start_date)
        while day <= min(end, term.end_date):
            for course in courses:
                for m in course.data['meetings']:
                    if m['start'] is not None and day.weekday() in m['days'] and m['start_date'] <= day.isoformat() <= m['end_date']:
                        result.append(dict(date=day.isoformat(), start=m['start'], end=m['end'], title=course.data['course'], location=m['location']))
            day += timedelta(days=1)
        for event in db.scalars(select(ScheduleEvent).where(ScheduleEvent.term_id == term.id)):
            e = event.data
            if start.isoformat() <= e['date'] <= end.isoformat():
                result.append({k: e[k] for k in ('date', 'start', 'end', 'title', 'location')})
    return sorted(result, key=lambda e: (e['date'], e['start']))


def common_free(calendars, start, end, first=480, last=1320, duration=30):
    result = []
    day = start
    while day <= end:
        busy = sorted((e['start'], e['end']) for calendar in calendars for e in calendar if e['date'] == day.isoformat())
        cursor = first
        for a, b in busy + [(last, last)]:
            a, b = max(first, min(last, a)), max(first, min(last, b))
            if a - cursor >= duration:
                result.append(dict(date=day.isoformat(), start=cursor, end=a))
            cursor = max(cursor, b)
        day += timedelta(days=1)
    return result
