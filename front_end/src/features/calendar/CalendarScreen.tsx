import { Screen } from '@/shared/components/Screen';
import { Calendar, CalendarList, Agenda } from 'react-native-calendars';
import { useEffect, useState } from 'react';
import { Location } from '@/features/locations/types';
import { getLocations } from '@/features/locations/locationService';
import { getEvent, getEvents } from '@/features/calendar/calendarService';
import { CalendarEvent } from '@/features/calendar/types';
import { FlatList, Text } from 'react-native';
import { LocationItem } from '@/features/locations/LocationItem';

const test_events_params = [1, new Date(2025, 0, 1), new Date(2027, 1, 1)] as const;

export function CalendarScreen() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  // useEffect with [] runs once, right after the screen first appears.
  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await getEvents(...test_events_params);
        setEvents(data);
      } catch {
        setErrorMessage(
          'Could not load locations. Is the backend running? Does the database have the data?',
        );
      }
    }

    loadEvents();
  }, []);

  return (
    <Screen>
      <Calendar />
      <FlatList
        data={events}
        keyExtractor={(event) => String(event.occurrence_id)}
        renderItem={({ item }) => (
          <Text>
            {item.title}: {item.end_at}
          </Text>
        )}
      />
    </Screen>
  );
}
