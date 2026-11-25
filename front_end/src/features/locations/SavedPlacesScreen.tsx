import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionRow } from '@/shared/components/ActionRow';
import { Button } from '@/shared/components/Button';
import { CardGrid } from '@/shared/components/CardGrid';
import { HeroCard } from '@/shared/components/HeroCard';
import { Screen } from '@/shared/components/Screen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Skeleton } from '@/shared/components/Skeleton';
import { StatePanel } from '@/shared/components/StatePanel';
import { ThemedText } from '@/shared/components/ThemedText';
import { Size, Spacing } from '@/shared/constants/theme';
import { goBackOr } from '@/shared/navigation';

import { getSavedPlaces } from './locationService';
import { SavedPlace } from './types';

// Figma: "CATS · Saved places" (node 67:52)
export function SavedPlacesScreen() {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Adding 1 to this number makes the effect below run again, which reloads the data.
  // That is how "Try again" works.
  const [loadCount, setLoadCount] = useState(0);

  // Load when the screen first appears.
  useEffect(() => {
    async function loadPlaces() {
      try {
        const data = await getSavedPlaces();
        setPlaces(data);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }

    loadPlaces();
  }, [loadCount]);

  function retry() {
    setStatus('loading');
    setLoadCount(loadCount + 1);
  }

  // Opens the Map tab with this place's route.
  function openOnMap(destinationId: string) {
    router.navigate({ pathname: '/map', params: { destination: destinationId } });
  }

  return (
    <Screen hasTabBar>
      <ScreenHeader
        title="Saved places"
        subtitle="Your favorite corners of campus."
        onBack={() => goBackOr('/home')}
      />

      <HeroCard
        variant="gold"
        eyebrow="YOUR LITTLE CAMPUS SHORTLIST"
        title="Keep the good places close."
      />

      <View style={styles.list}>
        {status === 'loading' && (
          <CardGrid>
            <Skeleton height={Size.actionRowMinHeight} />
            <Skeleton height={Size.actionRowMinHeight} />
          </CardGrid>
        )}

        {status === 'error' && (
          <StatePanel
            variant="error"
            title="Saved places didn’t load"
            message="We couldn’t reach the campus locations service. Check your connection and try again."
            actionLabel="Try again"
            onAction={retry}
          />
        )}

        {status === 'ready' && places.length === 0 && (
          <StatePanel
            variant="empty"
            title="No saved places yet"
            message="Explore the campus map to find your go-to spots."
          />
        )}

        {/* One column on phones, two on wide screens. */}
        {status === 'ready' && (
          <CardGrid>
            {places.map((place) => (
              <ActionRow
                key={place.destinationId}
                title={place.name}
                // The building's official name comes from the backend (GET /locations).
                subtitle={`${place.location.name} · ${place.description}`}
                onPress={() => openOnMap(place.destinationId)}
              />
            ))}
          </CardGrid>
        )}

        {status === 'ready' && places.length > 0 && (
          <ThemedText type="caption" themeColor="textSecondary">
            {places.length === 2 ? 'Two sample places' : 'Sample places'}, saved for your
            walkthrough.
          </ThemedText>
        )}
      </View>

      {/* Spec: this button always opens the Map's default route, the Library. */}
      <Button label="Explore the campus map" onPress={() => openOnMap('library')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.md,
  },
});
