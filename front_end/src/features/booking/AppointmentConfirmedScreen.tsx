import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { DetailCard } from '@/shared/components/DetailCard';
import { Screen } from '@/shared/components/Screen';
import { StatePanel } from '@/shared/components/StatePanel';
import { ThemedText } from '@/shared/components/ThemedText';
import { Spacing } from '@/shared/constants/theme';
import { formatShortDate, formatTimeRange } from '@/shared/dates';

import { getConfirmedAppointment } from './bookingService';
import { SuccessEmblem } from './SuccessEmblem';
import { ConfirmedAppointment } from './types';

// Figma: "CATS · Appointment confirmed" (node 67:27)
export function AppointmentConfirmedScreen() {
  const [appointment, setAppointment] = useState<ConfirmedAppointment | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Adding 1 to this number makes the effect below run again, which reloads the data.
  // That is how "Try again" works.
  const [loadCount, setLoadCount] = useState(0);

  // Load when the screen first appears.
  useEffect(() => {
    async function loadAppointment() {
      try {
        const data = await getConfirmedAppointment();
        setAppointment(data);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }

    loadAppointment();
  }, [loadCount]);

  function retry() {
    setStatus('loading');
    setLoadCount(loadCount + 1);
  }

  function viewSchedule() {
    // Opens the Schedule tab on the appointment's day, so the student sees it right away.
    router.navigate({
      pathname: '/schedule',
      params: appointment ? { date: appointment.date } : {},
    });
  }

  // Spec: never show "See you soon!" until we know the booking exists.
  if (status === 'loading') {
    return (
      <Screen width="form" contentStyle={styles.centered}>
        <StatePanel variant="loading" title="Checking your appointment…" />
      </Screen>
    );
  }

  // The booking itself may have worked; only the details failed to load. Say so clearly,
  // so the student doesn't go back and book a second time.
  if (status === 'error') {
    return (
      <Screen width="form" contentStyle={styles.centered}>
        <StatePanel
          variant="error"
          title="Appointment details unavailable"
          message="We couldn’t load the details right now. If you pressed Confirm, your booking may still have gone through, so check your schedule before booking again."
          actionLabel="Try again"
          onAction={retry}
          secondaryActionLabel="View my schedule"
          onSecondaryAction={viewSchedule}
        />
      </Screen>
    );
  }

  if (!appointment) {
    return (
      <Screen width="form" contentStyle={styles.centered}>
        <StatePanel
          variant="empty"
          title="No confirmed appointment"
          message="We couldn’t find a booking. Pick a time to book one."
          actionLabel="Book an appointment"
          onAction={() => router.replace('/book-appointment')}
          secondaryActionLabel="Back to home"
          onSecondaryAction={() => router.navigate('/home')}
        />
      </Screen>
    );
  }

  return (
    <Screen width="form" contentStyle={styles.centered}>
      <View style={styles.top}>
        <SuccessEmblem />
        <ThemedText type="title" accessibilityRole="header" style={styles.centerText}>
          See you soon!
        </ThemedText>
        <ThemedText type="supporting" themeColor="textSecondary" style={styles.centerText}>
          A little time, just for your next step.
        </ThemedText>
      </View>

      <DetailCard eyebrow={appointment.reason.toUpperCase()} title={appointment.advisorName}>
        <ThemedText type="body">
          {formatShortDate(appointment.date)} ·{' '}
          {formatTimeRange(appointment.startTime, appointment.endTime)}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {appointment.location}
        </ThemedText>
        {appointment.isDemo && (
          <ThemedText type="caption" themeColor="textSecondary">
            Sample confirmation · Not a real booking
          </ThemedText>
        )}
      </DetailCard>

      <View style={styles.buttons}>
        <Button label="View my schedule" onPress={viewSchedule} />
        <Button label="Back to home" variant="secondary" onPress={() => router.navigate('/home')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
  top: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  centerText: {
    textAlign: 'center',
  },
  buttons: {
    gap: Spacing.md,
  },
});
