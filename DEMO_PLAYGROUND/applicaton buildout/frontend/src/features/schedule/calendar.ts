export type EventPlace = { kind: 'building'; id: number; label: string } | { kind: 'pin'; longitude: number; latitude: number };
export type CalendarEvent = { place?: EventPlace | null; id: number; version: number; title: string; date: string; start: number; end: number; location: string; notes: string };
export type Meeting = { days: number[]; start: number | null; end: number | null; start_date: string; end_date: string; location: string };
export type Course = { event?: CalendarEvent; id?: number; section: string; course: string; title: string; credits: number; delivery: string; instructor: string; meetings: Meeting[] };
export type Term = { id?: number; season: 'Fall' | 'Spring' | 'Summer'; year: number; start_date: string; end_date: string; courses: Course[]; events?: CalendarEvent[] };
export type Schedule = { today: string; timezone: string; terms: Term[] };
export type ReviewCourse = Course & { status: 'new' | 'duplicate' | 'changed'; previous: Course | null };
export type Review = { courses: ReviewCourse[]; issues: { row: number | null; message: string }[]; version: string };
export const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const colors = [ ['#e0e7ff', '#3730a3'], ['#ccfbf1', '#115e59'], ['#ffedd5', '#9a3412'], ['#fce7f3', '#9d174d'], ['#e0f2fe', '#075985'], ['#f3e8ff', '#6b21a8'] ];
// Calendar dates are date-only values. UTC arithmetic avoids DST and device-zone shifts.
export function addDays(date: string, days: number) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function weekday(date: string) { return (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7; }
export function weekStart(date: string) { return addDays(date, -weekday(date)); }
export function campusToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) { return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { ...options, timeZone: 'UTC' }); }
export function clock(minutes: number) { const h = Math.floor(minutes / 60) % 24; return `${h % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; }
export function meetingLabel(m: Meeting) { return m.start === null ? `Asynchronous · ${m.location}` : `${m.days.map(d => weekdays[d]).join(', ')} · ${clock(m.start)}–${clock(m.end!)} · ${m.location}`; }
export function eventsOn(term: Term, day: string) {
  if (day < term.start_date || day > term.end_date) return [];
  const eventCourses: Course[] = (term.events ?? []).map(event => ({ event, section: `event-${event.id}`, course: event.title, title: event.title, credits: 0, delivery: '', instructor: '', meetings: [{ days: [weekday(event.date)], start: event.start, end: event.end, start_date: event.date, end_date: event.date, location: event.location || (event.place?.kind === 'building' ? event.place.label : event.place ? 'Pinned location' : '') }] }));
  return [...term.courses, ...eventCourses].flatMap((course, color) => course.meetings.filter(m => m.start !== null && m.days.includes(weekday(day)) && day >= m.start_date && day <= m.end_date).map((meeting, index) => ({ course, meeting, color, key: `${course.section}-${index}`, lane: 0, lanes: 1 }))).sort((a, b) => a.meeting.start! - b.meeting.start!);
}
// Assign simultaneous classes separate columns, including transitive overlaps.
export function layoutEvents(term: Term, day: string) {
  const events = eventsOn(term, day);
  let group: typeof events = [], ends: number[] = [], groupEnd = -1;
  const finish = () => { group.forEach(e => { e.lanes = ends.length; }); group = []; ends = []; };
  for (const event of events) {
    if (event.meeting.start! >= groupEnd) finish();
    let lane = ends.findIndex(end => end <= event.meeting.start!);
    if (lane < 0) lane = ends.length;
    ends[lane] = event.meeting.end!;
    event.lane = lane; group.push(event);
    groupEnd = Math.max(...ends);
  }
  finish(); return events;
}

export function buildingSearch(location: string): string | null {
  const value = location.trim();
  if (!value || /^(online|remote|tba|tbd|arranged|virtual)(\b|$)/i.test(value) || /https?:\/\//i.test(value)) return null;
  return value.replace(/(?:,?\s+(?:room|rm\.?|suite)\s+[^,]+|[,\s]+[A-Za-z]?\d[\w.-]*)$/i, '').trim() || null;
}
