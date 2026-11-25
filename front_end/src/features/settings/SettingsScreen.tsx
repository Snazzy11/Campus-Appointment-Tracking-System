import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getCurrentProfile, signOut } from '@/features/auth/authService';
import { StudentProfile } from '@/features/auth/types';
import { clearDemoAppointment } from '@/features/booking/bookingService';
import { ActionRow } from '@/shared/components/ActionRow';
import { Button } from '@/shared/components/Button';
import { InfoNote } from '@/shared/components/InfoNote';
import { Screen } from '@/shared/components/Screen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeading } from '@/shared/components/SectionHeading';
import { Skeleton } from '@/shared/components/Skeleton';
import { ThemedText } from '@/shared/components/ThemedText';
import { Radius, Size, Spacing } from '@/shared/constants/theme';

import { ProfileCard } from './ProfileCard';

// Figma: "CATS · Settings" (node 67:57)
export function SettingsScreen() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  // Adding 1 to this number makes the effect below run again, which reloads the data.
  // That is how "Try again" works.
  const [loadCount, setLoadCount] = useState(0);

  // Load when the screen first appears.
  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getCurrentProfile();
        setProfile(data);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }

    loadProfile();
  }, [loadCount]);

  function retry() {
    setStatus('loading');
    setLoadCount(loadCount + 1);
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError('');
    try {
      await signOut();
      // Spec: signing out of the demo also forgets the booked sample appointment.
      await clearDemoAppointment();
      // Replace the tabs with the Welcome screen, so Back can't return into the app.
      router.replace('/');
    } catch {
      setSignOutError('We couldn’t sign you out. Please try again.');
      setIsSigningOut(false);
    }
  }

  return (
    <Screen hasTabBar>
      <ScreenHeader
        eyebrow="CATS / CAMPUS COMPANION"
        title="Your space"
        subtitle="Make CATS work for you."
      />

      {/* The rows below keep working while the profile loads or if it fails (spec). */}
      {status === 'loading' && (
        <Skeleton height={Size.skeletonCardHeight} borderRadius={Radius.hero} />
      )}
      {status === 'error' && (
        <InfoNote
          variant="error"
          title="Your profile didn’t load"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={retry}
        />
      )}
      {status === 'ready' && <ProfileCard profile={profile} />}

      <View style={styles.list}>
        <SectionHeading title="Your campus essentials" />
        <ActionRow
          title="My schedule"
          subtitle="Your day, in one place"
          onPress={() => router.navigate('/schedule')}
        />
        <ActionRow
          title="Saved places"
          subtitle="Keep your go-to spots nearby"
          onPress={() => router.push('/saved-places')}
        />
        <ActionRow
          title="Student organizations"
          subtitle="Find a community that fits"
          onPress={() => router.navigate('/clubs')}
        />
      </View>

      {signOutError !== '' && <InfoNote variant="error" message={signOutError} />}

      {/* Spec: a secondary button, not red. Red is only for errors and destructive actions. */}
      <Button
        label="Sign out of demo"
        variant="secondary"
        onPress={handleSignOut}
        loading={isSigningOut}
      />

      <ThemedText type="caption" themeColor="textSecondary" style={styles.footer}>
        CATS · A campus companion prototype
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.md,
  },
  footer: {
    textAlign: 'center',
  },
});
