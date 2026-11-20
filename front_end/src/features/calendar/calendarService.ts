import { getFromApi } from '@/shared/api';

import { CalendarEvent } from './types';

// Query user's events as: [start, end) - anything canceled
// The range is at most *366 days
// Ex. for one month: getEvents(userId, new Date(2027, 0, 1), new Date(2027, 1, 1))
export async function getEvents(ownerId: number, start: Date, end: Date): Promise<CalendarEvent[]> {
  const query =
    'owner_id=' +
    ownerId +
    '&start=' +
    encodeURIComponent(start.toISOString()) +
    '&end=' +
    encodeURIComponent(end.toISOString());
  return await getFromApi('/api/events?' + query);
}

export async function getEvent(occurrenceId: number): Promise<CalendarEvent> {
  return await getFromApi('/api/events/' + occurrenceId);
}
