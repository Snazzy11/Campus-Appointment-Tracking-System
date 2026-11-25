// Helpers for turning the dates and times we get from services into text for the screen.
//
// Services always send dates as "YYYY-MM-DD" (e.g. "2026-11-18") and times as 24-hour
// "HH:MM" (e.g. "13:00"). Screens should never type out a weekday or month by hand:
// derive it from the date with these helpers, so labels can't contradict the data.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Turns "2026-11-18" into a Date at midnight local time.
// (new Date("2026-11-18") would use UTC midnight, which is the previous day in Michigan.)
export function parseDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Turns a Date back into "2026-11-18".
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// "2026-11-16" plus 2 days -> "2026-11-18".
export function addDays(isoDate: string, days: number): string {
  const date = parseDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

// "2026-11-18" -> "Wednesday, November 18"
export function formatLongDate(isoDate: string): string {
  const date = parseDate(isoDate);
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// "2026-11-18" -> "Wed, Nov 18"
export function formatShortDate(isoDate: string): string {
  const date = parseDate(isoDate);
  return `${WEEKDAYS[date.getDay()].slice(0, 3)}, ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
}

// "2026-11-19" -> "Thursday, Nov 19"
export function formatWeekdayAndShortDate(isoDate: string): string {
  const date = parseDate(isoDate);
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
}

// "2026-11-18" -> "November 2026"
export function formatMonthAndYear(isoDate: string): string {
  const date = parseDate(isoDate);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// "2026-11-18" -> "W" (one-letter weekday, used in the week strip)
export function formatWeekdayLetter(isoDate: string): string {
  return WEEKDAYS[parseDate(isoDate).getDay()].charAt(0);
}

// "2026-11-18" -> "Wednesday" (full weekday, for screen readers)
export function formatWeekday(isoDate: string): string {
  return WEEKDAYS[parseDate(isoDate).getDay()];
}

// "2026-11-18" -> 18
export function getDayOfMonth(isoDate: string): number {
  return parseDate(isoDate).getDate();
}

// Splits "13:05" into the 12-hour parts: { time: "1:05", period: "PM" }.
function toTwelveHour(time: string): { time: string; period: 'AM' | 'PM' } {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours < 12 ? 'AM' : 'PM';
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return { time: `${twelveHour}:${String(minutes).padStart(2, '0')}`, period };
}

// "18:00" -> "6:00 PM"
export function formatTime(time: string): string {
  const parts = toTwelveHour(time);
  return `${parts.time} ${parts.period}`;
}

// "08:30", "09:45" -> "8:30 – 9:45 AM"
// "11:30", "12:15" -> "11:30 AM – 12:15 PM"   (AM/PM is only repeated when it changes)
export function formatTimeRange(startTime: string, endTime: string): string {
  const start = toTwelveHour(startTime);
  const end = toTwelveHour(endTime);
  if (start.period === end.period) {
    return `${start.time} – ${end.time} ${end.period}`;
  }
  return `${start.time} ${start.period} – ${end.time} ${end.period}`;
}
