// Data for the Schedule tab. There is no backend endpoint for schedules yet; see scheduleService.ts.

// class:      a course, green line
// advising:   a booked advising appointment, maroon line
// study:      a study block, gold line
// suggestion: an open slot suggesting the student book advising (not a real event), maroon line
export type ScheduleEventType = 'class' | 'advising' | 'study' | 'suggestion';

export type ScheduleEvent = {
  id: string;
  type: ScheduleEventType;
  title: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM", 24-hour
  endTime: string; // "HH:MM", 24-hour
  location: string;
  // Short text before the location, e.g. "Sample class" or the advisor's name.
  detail: string;
};

export type ScheduleWeek = {
  // The Monday the week strip starts on, "YYYY-MM-DD".
  weekStartDate: string;
  // The day selected when the screen first opens, "YYYY-MM-DD".
  defaultSelectedDate: string;
  // Every event in the week, sorted by date and start time.
  events: ScheduleEvent[];
};
