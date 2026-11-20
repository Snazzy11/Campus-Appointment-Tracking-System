import { Screen } from '@/shared/components/Screen';
import { Calendar, CalendarList, Agenda } from 'react-native-calendars';
import { useEffect, useState } from 'react';
import { Location } from '@/features/locations/types';
import { getLocations } from '@/features/locations/locationService';
import { getEvent, getEvents } from '@/features/calendar/calendarService';
import { CalendarEvent } from '@/features/calendar/types';
import { FlatList, Text } from 'react-native';
import { LocationItem } from '@/features/locations/LocationItem';
import { ThemedText } from '@/shared/components/ThemedText';

const test_events_params = [1, new Date(2026, 1, 1), new Date(2026, 12, 26)] as const;

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
      <ThemedText>Events:</ThemedText>
      {errorMessage ? <ThemedText>{errorMessage}</ThemedText> : null}
      <Calendar />
      <FlatList
        data={events}
        keyExtractor={(event) => String(event.occurrence_id)}
        renderItem={({ item }) => (
          <ThemedText>
            {item.title}: {item.end_at}
          </ThemedText>
        )}
      />
    </Screen>
  );
}
