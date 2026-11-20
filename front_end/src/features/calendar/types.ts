// One meeting of an event
// Keep this in sync with EventOut in back_end/cats/api/routers/schedule/schedule.py

// Events are a 'series', which has metadata on what it is and how it repeats and an occurrence
// This type is the data combined into one
export type CalendarEvent = {
  occurrence_id: number;
  series_id: number;
  event_type: string; // TODO: make an api to get these possibilities
  title: string;
  location: string | null;
  // will be ISO 8601 string with UTC offset: "2027-01-04T15:00:00Z".
  // turn into Date with new Date(event.start_at).
  start_at: string;
  end_at: string;
  status: 'scheduled' | 'cancelled'; // TODO api if more of these appear
  is_recurring: boolean;
  details: Record<string, unknown>; // type-specific fields like a class's course_code; todo make api
};
