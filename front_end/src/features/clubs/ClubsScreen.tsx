import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CardGrid } from '@/shared/components/CardGrid';
import { HeroCard } from '@/shared/components/HeroCard';
import { Screen } from '@/shared/components/Screen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeading } from '@/shared/components/SectionHeading';
import { Skeleton } from '@/shared/components/Skeleton';
import { StatePanel } from '@/shared/components/StatePanel';
import { Size, Spacing } from '@/shared/constants/theme';

import { getOrganizations } from './clubService';
import { OrganizationRow } from './OrganizationRow';
import { Organization } from './types';

// Figma: "CATS · Organizations" (node 67:37)
export function ClubsScreen() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Adding 1 to this number makes the effect below run again, which reloads the data.
  // That is how "Try again" works.
  const [loadCount, setLoadCount] = useState(0);

  // Load when the screen first appears.
  useEffect(() => {
    async function loadOrganizations() {
      try {
        const data = await getOrganizations();
        setOrganizations(data);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }

    loadOrganizations();
  }, [loadCount]);

  function retry() {
    setStatus('loading');
    setLoadCount(loadCount + 1);
  }

  return (
    <Screen width="wide" hasTabBar>
      <ScreenHeader
        eyebrow="CATS / CAMPUS COMPANION"
        title="Find your people"
        subtitle="Make campus feel more like you."
      />

      <HeroCard
        variant="gold"
        eyebrow="YOUR PEOPLE ARE OUT THERE."
        title="Start with a shared curiosity."
      />

      <View style={styles.list}>
        <SectionHeading
          title="Student organizations"
          description="Sample organizations to explore."
        />

        {status === 'loading' && (
          <CardGrid>
            <Skeleton height={Size.organizationRowMinHeight} />
            <Skeleton height={Size.organizationRowMinHeight} />
            <Skeleton height={Size.organizationRowMinHeight} />
          </CardGrid>
        )}

        {status === 'error' && (
          <StatePanel
            variant="error"
            title="Organizations didn’t load"
            message="Check your connection and try again."
            actionLabel="Try again"
            onAction={retry}
          />
        )}

        {status === 'ready' && organizations.length === 0 && (
          <StatePanel variant="empty" title="No organizations available right now." />
        )}

        {/* There are only a few organizations, so a plain map() is fine. Switch to a FlatList
            (with numColumns for wide screens) if the real backend returns a long list. */}
        {/* One column on phones, two on wide screens. */}
        {status === 'ready' && (
          <CardGrid>
            {organizations.map((organization) => (
              <OrganizationRow
                key={organization.id}
                organization={organization}
                onPress={() => router.push(`/organizations/${organization.id}`)}
              />
            ))}
          </CardGrid>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.md,
  },
});
