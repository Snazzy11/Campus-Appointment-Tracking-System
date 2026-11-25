import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { InfoNote } from '@/shared/components/InfoNote';
import { Screen } from '@/shared/components/Screen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeading } from '@/shared/components/SectionHeading';
import { Skeleton } from '@/shared/components/Skeleton';
import { StatePanel } from '@/shared/components/StatePanel';
import { ThemedText } from '@/shared/components/ThemedText';
import { Radius, Size, Spacing } from '@/shared/constants/theme';
import { addDays, formatLongDate, formatMonthAndYear } from '@/shared/dates';

import { ScheduleEventCard } from './ScheduleEventCard';
import { getScheduleWeek } from './scheduleService';
import { ScheduleEvent, ScheduleWeek } from './types';
import { WeekStrip } from './WeekStrip';

// Figma: "CATS · My schedule" (node 67:47)
export function ScheduleScreen() {
  // The selected day is kept in the URL ("/schedule?date=2026-11-18"). That way other screens
  // can open a specific day, and the day stays selected when you switch tabs and come back.
  const params = useLocalSearchParams<{ date?: string }>();

  const [week, setWeek] = useState<ScheduleWeek | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  async function loadWeek() {
    try {
      const data = await getScheduleWeek();
      setWeek(data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  // Reload every time the tab is shown, so a newly booked appointment appears right away.
  // The old events stay on screen while the new ones load.
  useFocusEffect(
    useCallback(() => {
      loadWeek();
    }, []),
  );

  function retry() {
    setStatus('loading');
    loadWeek();
  }

  // First load still running (or failed) and nothing to show yet.
  if (!week) {
    return (
      <Screen hasTabBar>
        <Header />
        {status === 'error' ? (
          <StatePanel
            variant="error"
            title="Your schedule didn’t load"
            message="Check your connection and try again."
            actionLabel="Try again"
            onAction={retry}
          />
        ) : (
          <View style={styles.list}>
            <Skeleton height={Size.dateCellMinHeight} borderRadius={Radius.dateCell} />
            <Skeleton height={Size.eventCardMinHeight} />
            <Skeleton height={Size.eventCardMinHeight} />
          </View>
        )}
      </Screen>
    );
  }

  // The 7 days of the week strip.
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDays(week.weekStartDate, i));
  }

  // Use the day from the URL if it is in this week; otherwise the default day.
  const selectedDate =
    params.date && days.includes(params.date) ? params.date : week.defaultSelectedDate;
  const eventsForDay = week.events.filter((event) => event.date === selectedDate);

  function selectDate(date: string) {
    router.setParams({ date });
  }

  function openEvent(event: ScheduleEvent) {
    if (event.type === 'suggestion') {
      router.push('/book-appointment');
    } else if (event.type === 'advising') {
      router.push('/appointment-confirmed');
    }
    // Classes and study blocks have no detail screen in the design.
  }

  return (
    <Screen hasTabBar>
      <Header />

      <View style={styles.list}>
        <ThemedText type="eyebrow" themeColor="primary">
          {formatMonthAndYear(selectedDate).toUpperCase()}
        </ThemedText>
        <WeekStrip days={days} selectedDate={selectedDate} onSelectDate={selectDate} />
      </View>

      <View style={styles.list}>
        <SectionHeading title={formatLongDate(selectedDate)} />

        {/* A reload failed, but we still have the last events we loaded, so keep showing them. */}
        {status === 'error' && (
          <InfoNote
            variant="error"
            message="We couldn’t refresh your schedule. These events may be out of date."
            actionLabel="Try again"
            onAction={retry}
          />
        )}

        {eventsForDay.length === 0 ? (
          <StatePanel
            variant="empty"
            title="Nothing scheduled for this day"
            message="Enjoy the free time, or book an advising appointment."
            actionLabel="Book appointment"
            onAction={() => router.push('/book-appointment')}
          />
        ) : (
          eventsForDay.map((event) => (
            <ScheduleEventCard
              key={event.id}
              event={event}
              onPress={
                event.type === 'suggestion' || event.type === 'advising'
                  ? () => openEvent(event)
                  : undefined
              }
            />
          ))
        )}
      </View>

      <ThemedText type="caption" themeColor="textSecondary">
        Example schedule · Booking adds your appointment.
      </ThemedText>
    </Screen>
  );
}

// The title block. Kept separate because it shows in every state of the screen.
function Header() {
  return (
    <ScreenHeader
      eyebrow="CATS / CAMPUS COMPANION"
      title="My schedule"
      subtitle="One place for your campus day."
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.md,
  },
});
