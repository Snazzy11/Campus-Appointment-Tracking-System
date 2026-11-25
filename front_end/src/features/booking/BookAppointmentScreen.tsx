import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { DetailCard, DetailField } from '@/shared/components/DetailCard';
import { InfoNote } from '@/shared/components/InfoNote';
import { Screen } from '@/shared/components/Screen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeading } from '@/shared/components/SectionHeading';
import { Skeleton } from '@/shared/components/Skeleton';
import { StatePanel } from '@/shared/components/StatePanel';
import { ThemedText } from '@/shared/components/ThemedText';
import { Size, Spacing } from '@/shared/constants/theme';
import { formatLongDate, formatTimeRange } from '@/shared/dates';
import { goBackOr } from '@/shared/navigation';

import { confirmAppointment, getAppointmentOffer } from './bookingService';
import { AppointmentOffer } from './types';

// Figma: "CATS · Book appointment" (node 67:22)
export function BookAppointmentScreen() {
  const [offer, setOffer] = useState<AppointmentOffer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  // Adding 1 to this number makes the effect below run again, which reloads the data.
  // That is how "Try again" works.
  const [loadCount, setLoadCount] = useState(0);

  // Load when the screen first appears.
  useEffect(() => {
    async function loadOffer() {
      try {
        const data = await getAppointmentOffer();
        setOffer(data);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }

    loadOffer();
  }, [loadCount]);

  function retryLoading() {
    setStatus('loading');
    setLoadCount(loadCount + 1);
  }

  async function handleConfirm() {
    if (!offer) {
      return;
    }
    setIsConfirming(true);
    setConfirmError('');
    try {
      await confirmAppointment(offer.id);
      // "replace" swaps this screen for the confirmation, so pressing Back afterwards
      // can't bring the form back and book the same appointment twice.
      router.replace('/appointment-confirmed');
    } catch {
      // Keep the details on screen; the Confirm button works as "Try again".
      setConfirmError(
        'We couldn’t confirm your appointment. Nothing was booked. Please try again.',
      );
      setIsConfirming(false);
    }
  }

  // Back and "Skip for now" return to wherever the student came from (Home, Schedule, ...).
  function leave() {
    goBackOr('/home');
  }

  return (
    <Screen width="form">
      <ScreenHeader
        title="Book an appointment"
        subtitle="A little guidance goes a long way."
        onBack={leave}
      />

      {status === 'loading' && (
        <View style={styles.section}>
          <Skeleton height={Size.skeletonCardHeight} />
          <Skeleton height={Size.skeletonHeroHeight} />
        </View>
      )}

      {status === 'error' && (
        <StatePanel
          variant="error"
          title="This appointment didn’t load"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={retryLoading}
          secondaryActionLabel="Back"
          onSecondaryAction={leave}
        />
      )}

      {status === 'ready' && !offer && (
        <StatePanel
          variant="empty"
          title="No appointments available"
          message="There are no open advising times right now. Check back soon."
          actionLabel="Back to home"
          onAction={() => router.navigate('/home')}
        />
      )}

      {status === 'ready' && offer && (
        <>
          <View style={styles.section}>
            <ThemedText type="eyebrow" themeColor="primary">
              01 / {offer.reason.toUpperCase()}
            </ThemedText>
            <DetailCard title={offer.advisorName}>
              <ThemedText type="caption" themeColor="textSecondary">
                {offer.serviceName} · {offer.durationMinutes} minutes
              </ThemedText>
              <ThemedText type="caption" themeColor="primary">
                {offer.format}
              </ThemedText>
            </DetailCard>
          </View>

          <View style={styles.section}>
            <SectionHeading title="Your appointment" />
            <DetailCard>
              <DetailField label="WHEN" value={formatLongDate(offer.date)} />
              <DetailField label="TIME" value={formatTimeRange(offer.startTime, offer.endTime)} />
              <DetailField label="REASON" value={offer.reason} />
            </DetailCard>
          </View>

          {offer.isDemo && (
            <View style={styles.demoNote}>
              <ThemedText type="caption" themeColor="primary">
                Demo appointment
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                This walkthrough uses a sample advisor and time. No real booking will be made.
              </ThemedText>
            </View>
          )}

          {confirmError !== '' && <InfoNote variant="error" message={confirmError} />}

          <View style={styles.buttons}>
            <Button label="Confirm appointment" onPress={handleConfirm} loading={isConfirming} />
            <Button label="Skip for now" variant="text" onPress={leave} disabled={isConfirming} />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.md,
  },
  demoNote: {
    gap: Spacing.xs,
  },
  buttons: {
    gap: Spacing.sm,
  },
});
