// One meeting of an event, as returned by GET /events and GET /events/{id}.
// Keep this in sync with EventOut in back_end/cats/api/routers/schedule/schedule.py
//
// The backend stores an event as a series (what it is and how it repeats) plus one row
// per meeting. This type is a single meeting with the series' details already filled in,
// so the calendar can treat every entry the same way.
export type CalendarEvent = {
  occurrence_id: number; // this meeting
  series_id: number; // the event it belongs to; needed later for "edit all events"
  event_type: string; // 'class' | 'club' | 'meeting' | 'work'
  title: string;
  location: string | null;
  // ISO 8601 strings with a UTC offset, e.g. "2027-01-04T15:00:00Z".
  // Turn them into dates with new Date(event.start_at).
  start_at: string;
  end_at: string;
  status: 'scheduled' | 'cancelled';
  is_recurring: boolean; // if true, editing should ask "this event or all events?"
  details: Record<string, unknown>; // type-specific fields, e.g. a class's course_code
};
