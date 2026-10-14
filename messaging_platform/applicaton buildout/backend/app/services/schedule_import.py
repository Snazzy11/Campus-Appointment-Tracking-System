"""Strict CSV parsing: one row per meeting, or aligned newline-separated cells.
Never guess shifted columns: the preview reports their row number for correction.
"""
import csv
import io
import re
from datetime import datetime

HEADERS = ['section', 'course', 'title', 'credits', 'days', 'time', 'dates', 'location', 'delivery', 'instructor']
DAY = {'M': 0, 'Tu': 1, 'W': 2, 'Th': 3, 'F': 4, 'Sa': 5, 'Su': 6}


def parse_date(value):
    for fmt in ('%m/%d/%y', '%m/%d/%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            pass
    raise ValueError('Use dates such as 8/31/26 or 2026-08-31.')


def date_range(value):
    parts = re.split(r'\s+[–—-]\s+', value.strip())
    if len(parts) != 2:
        raise ValueError('Dates must contain a start and end separated by " - ".')
    start, end = map(parse_date, parts)
    if start > end:
        raise ValueError('The course end date is before its start date.')
    return start.isoformat(), end.isoformat()


def meeting(days, time, dates, location, delivery):
    start, end = date_range(dates)
    if not days.strip() and not time.strip() and 'asynchronous' in delivery.lower():
        return dict(days=[], start=None, end=None, start_date=start, end_date=end, location=location)
    tokens = re.findall(r'Tu|Th|Sa|Su|M|W|F', days)
    if not tokens or re.sub(r'Tu|Th|Sa|Su|M|W|F|[\s,]', '', days):
        raise ValueError('Days must use M, Tu, W, Th, F, Sa, Su. Only asynchronous courses may omit days/time.')
    parts = re.split(r'\s*[–—-]\s*', time.strip())
    try:
        times = [datetime.strptime(x.strip().upper(), '%I:%M %p') for x in parts]
        minutes = [x.hour * 60 + x.minute for x in times]
        if len(minutes) != 2 or minutes[0] >= minutes[1]:
            raise ValueError()
    except ValueError:
        raise ValueError('Use a time range such as 11:00 AM - 11:50 AM (no overnight meetings).')
    return dict(days=sorted({DAY[t] for t in tokens}), start=minutes[0], end=minutes[1], start_date=start, end_date=end, location=location)


def parse_csv(content):
    reader = csv.reader(io.StringIO(content.lstrip('\ufeff')), strict=True)
    try:
        headers = [x.strip().lower() for x in next(reader)]
    except (StopIteration, csv.Error):
        raise ValueError('Choose a CSV file with a header row.')
    if any(headers.count(h) != 1 for h in HEADERS):
        raise ValueError('CSV headers must include: ' + ', '.join(h.title() for h in HEADERS))
    courses, issues, invalid = {}, [], set()
    parent = None
    try:
        for row_number, row in enumerate(reader, 2):
            if row_number > 501:
                raise ValueError('Import at most 500 rows at a time.')
            if not any(x.strip() for x in row):
                parent = None
                continue
            section = row[headers.index('section')].strip() if len(row) > headers.index('section') else ''
            continuation = not section
            inherited = parent
            if not continuation:
                parent = None
            elif inherited:
                section = inherited['section']
            try:
                if len(row) != len(headers):
                    raise ValueError('Columns are shifted. Put each lecture/lab on a separate row with the same Section, and quote cells containing commas.')
                data = {k: row[headers.index(k)].strip() for k in HEADERS}
                if continuation:
                    if not inherited or any(data[k] for k in ('course', 'title', 'credits')):
                        raise ValueError('A continuation meeting must follow a course and leave Section, Course, Title and Credits blank.')
                    if not data['days'] or not data['time'] or not data['location']:
                        raise ValueError('A continuation meeting needs its own Days, Time and Location.')
                    for key in ('section', 'course', 'title', 'credits', 'dates', 'delivery', 'instructor'):
                        data[key] = data[key] or inherited[key]
                else:
                    parent = data.copy()
                if any(len(v) > 2000 for v in data.values()) or not section or len(section) > 40:
                    raise ValueError('A section is required and each cell must be under 2,000 characters.')
                if not data['course'] or not data['title']:
                    raise ValueError('Course and Title are required.')
                credit = float(data['credits'])
                if not 0 <= credit <= 30:
                    raise ValueError('Credits must be between 0 and 30.')
                splits = {k: data[k].splitlines() or [''] for k in ('days', 'time', 'dates', 'location')}
                count = max(map(len, splits.values()))
                if any(len(v) not in (1, count) for v in splits.values()):
                    raise ValueError('Multiple meetings must have matching Days, Time and Location lines.')
                meetings = [meeting(*(splits[k][i if len(splits[k]) > 1 else 0] for k in ('days', 'time', 'dates', 'location')), data['delivery']) for i in range(count)]
                course = {k: data[k] for k in ('section', 'course', 'title', 'delivery', 'instructor')}
                course['credits'] = credit
                if section in courses and any(courses[section][k] != v for k, v in course.items()):
                    raise ValueError('Rows with the same Section disagree on course details.')
                previous = courses.setdefault(section, {**course, 'meetings': []})
                for item in meetings:
                    if item not in previous['meetings']:
                        previous['meetings'].append(item)
            except ValueError as error:
                invalid.add(section)
                issues.append({'row': row_number, 'message': str(error)})
    except csv.Error:
        raise ValueError('Malformed CSV quoting. Export the file as CSV again.')
    for section in invalid:
        courses.pop(section, None)  # Never save only the lecture if its lab failed.
    for course in courses.values():
        course['meetings'].sort(key=lambda m: (m['start_date'], m['days'], m['start'] or 0, m['location']))
    return list(courses.values()), issues
