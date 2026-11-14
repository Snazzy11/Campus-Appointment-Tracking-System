import { getFromApi } from '@/shared/api';

import { CalendarEvent } from './types';

// Backend calls for the calendar feature go here

// Query a user's events that start in [start, end), without cancelled ones
// The range can be at most 366 days.
// Example, for one month: getEvents(userId, new Date(2027, 0, 1), new Date(2027, 1, 1))
export async function getEvents(ownerId: number, start: Date, end: Date): Promise<CalendarEvent[]> {
  // toISOString() is in UTC ("...Z"), which tells the backend exactly which moment is meant.
  const query =
    'owner_id=' +
    ownerId +
    '&start=' +
    encodeURIComponent(start.toISOString()) +
    '&end=' +
    encodeURIComponent(end.toISOString());
  return await getFromApi('/events?' + query);
}

// One meeting by its occurrence id, including cancelled ones.
export async function getEvent(occurrenceId: number): Promise<CalendarEvent> {
  return await getFromApi('/events/' + occurrenceId);
}
