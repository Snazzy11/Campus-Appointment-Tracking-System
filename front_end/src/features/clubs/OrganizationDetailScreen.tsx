import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { DetailCard } from '@/shared/components/DetailCard';
import { HeroCard } from '@/shared/components/HeroCard';
import { Screen } from '@/shared/components/Screen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Skeleton } from '@/shared/components/Skeleton';
import { StatePanel } from '@/shared/components/StatePanel';
import { ThemedText } from '@/shared/components/ThemedText';
import { Radius, Size, Spacing } from '@/shared/constants/theme';
import { formatTime, formatWeekdayAndShortDate } from '@/shared/dates';
import { goBackOr } from '@/shared/navigation';

import { getOrganization } from './clubService';
import { Organization } from './types';

// Figma: "CATS · Organization details" (node 67:42), "Outdoor Collective" (67:444)
// and "Creative Circle" (67:471). All three use this one screen with different data.
export function OrganizationDetailScreen() {
  // The id comes from the URL: /organizations/computing-society
  const { organizationId } = useLocalSearchParams<{ organizationId: string }>();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Adding 1 to this number makes the effect below run again, which reloads the data.
  // That is how "Try again" works.
  const [loadCount, setLoadCount] = useState(0);

  // Load when the screen first appears.
  useEffect(() => {
    async function loadOrganization() {
      try {
        const data = await getOrganization(organizationId);
        setOrganization(data);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }

    loadOrganization();
  }, [organizationId, loadCount]);

  function retry() {
    setStatus('loading');
    setLoadCount(loadCount + 1);
  }

  function backToOrganizations() {
    goBackOr('/clubs');
  }

  return (
    <Screen>
      <ScreenHeader
        title="Your next community"
        subtitle="Explore something outside class."
        onBack={backToOrganizations}
      />

      {status === 'loading' && (
        <>
          <Skeleton height={Size.skeletonHeroHeight} borderRadius={Radius.hero} />
          <Skeleton height={Size.skeletonCardHeight} />
        </>
      )}

      {status === 'error' && (
        <StatePanel
          variant="error"
          title="This organization didn’t load"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={retry}
          secondaryActionLabel="Back to organizations"
          onSecondaryAction={backToOrganizations}
        />
      )}

      {/* The link pointed at an organization that doesn't exist (or was removed). */}
      {status === 'ready' && !organization && (
        <StatePanel
          variant="empty"
          title="Organization not found"
          message="It may have been removed. Take a look at the other organizations."
          actionLabel="Back to organizations"
          onAction={backToOrganizations}
        />
      )}

      {status === 'ready' && organization && (
        <>
          <HeroCard
            variant={organization.category}
            eyebrow={`${organization.categoryLabel.toUpperCase()} / STUDENT-LED`}
            title={organization.name}
          />

          <View style={styles.about}>
            <ThemedText type="subtitle">{organization.tagline}</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              {organization.description}
            </ThemedText>
          </View>

          {organization.nextMeetup ? (
            <DetailCard eyebrow="NEXT MEETUP" title={organization.nextMeetup.title}>
              <ThemedText type="caption" themeColor="textSecondary">
                {formatWeekdayAndShortDate(organization.nextMeetup.date)} ·{' '}
                {formatTime(organization.nextMeetup.startTime)}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {organization.nextMeetup.location}
              </ThemedText>
            </DetailCard>
          ) : (
            <DetailCard eyebrow="NEXT MEETUP" title="No upcoming meetup">
              <ThemedText type="caption" themeColor="textSecondary">
                Check back soon for the next get-together.
              </ThemedText>
            </DetailCard>
          )}

          <View style={styles.buttons}>
            {/* Spec: hide the route button when there is no meetup to go to. */}
            {organization.nextMeetup && (
              <Button
                label="Find the student union"
                onPress={() =>
                  router.navigate({
                    pathname: '/map',
                    params: { destination: organization.nextMeetup?.destinationId },
                  })
                }
              />
            )}
            <Button
              label="Back to organizations"
              variant="secondary"
              onPress={backToOrganizations}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  about: {
    gap: Spacing.sm,
  },
  buttons: {
    gap: Spacing.md,
  },
});
