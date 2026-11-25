import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { DetailCard } from '@/shared/components/DetailCard';
import { Screen } from '@/shared/components/Screen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Skeleton } from '@/shared/components/Skeleton';
import { StatePanel } from '@/shared/components/StatePanel';
import { ThemedText } from '@/shared/components/ThemedText';
import { Radius, Ratio, Spacing } from '@/shared/constants/theme';

import { CampusMap } from './CampusMap';
import { DEFAULT_DESTINATION_ID, getCampusMap, getRoute } from './mapService';
import { CampusMap as CampusMapData, MapRoute } from './types';

// Figma: "CATS · Campus map" (node 67:32) and "CATS · Student union route" (node 67:498).
// Both are this one screen; the destination comes from the URL: "/map?destination=student-union".
export function MapScreen() {
  const params = useLocalSearchParams<{ destination?: string }>();
  const destinationId = params.destination ?? DEFAULT_DESTINATION_ID;

  const [map, setMap] = useState<CampusMapData | null>(null);
  const [route, setRoute] = useState<MapRoute | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Adding 1 to this number makes the effect below run again, which reloads the data.
  // That is how "Try again" works.
  const [loadCount, setLoadCount] = useState(0);

  // Load again whenever the destination changes (e.g. a saved place was picked).
  useEffect(() => {
    // If the destination changes again before this request finishes, the answer is out of
    // date. The cleanup function at the bottom sets this to false so we ignore it.
    let isCurrent = true;

    async function loadMap() {
      try {
        // Ask for the map and the route at the same time, and wait for both.
        const [mapData, routeData] = await Promise.all([getCampusMap(), getRoute(destinationId)]);
        if (!isCurrent) {
          return;
        }
        setMap(mapData);
        setRoute(routeData);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }

    loadMap();

    return () => {
      isCurrent = false;
    };
  }, [destinationId, loadCount]);

  function retry() {
    setStatus('loading');
    setLoadCount(loadCount + 1);
  }

  function openSavedPlaces() {
    router.push('/saved-places');
  }

  return (
    <Screen hasTabBar>
      <ScreenHeader
        eyebrow="CATS / CAMPUS COMPANION"
        title="Find your way"
        subtitle="Your next stop, a little closer."
      />

      <View style={styles.mapSection}>
        {status === 'loading' && (
          <Skeleton aspectRatio={Ratio.mapWidthToHeight} borderRadius={Radius.map} />
        )}

        {status === 'error' && (
          <StatePanel
            variant="error"
            title="Map unavailable"
            message="The campus map didn’t load. Check your connection and try again."
            actionLabel="Try again"
            onAction={retry}
            secondaryActionLabel="View saved places"
            onSecondaryAction={openSavedPlaces}
          />
        )}

        {status === 'ready' && map && <CampusMap map={map} route={route} />}

        {/* Always shown, so nobody mistakes the sample route for their real location. */}
        <ThemedText type="eyebrow" themeColor="textSecondary">
          ILLUSTRATIVE MAP · NOT LIVE GPS
        </ThemedText>
      </View>

      {status === 'ready' && !route && (
        <StatePanel
          variant="empty"
          title="No route selected"
          message="Pick one of your saved places to see a sample walking route."
          actionLabel="View saved places"
          onAction={openSavedPlaces}
        />
      )}

      {status === 'ready' && route && (
        <>
          <DetailCard title={route.summaryTitle}>
            <ThemedText type="caption" themeColor="textSecondary">
              {route.summarySubtitle}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {route.instructions}
            </ThemedText>
          </DetailCard>

          <Button label="View saved places" onPress={openSavedPlaces} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapSection: {
    gap: Spacing.sm,
  },
});
