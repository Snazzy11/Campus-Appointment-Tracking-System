import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Keep Leaflet out of server rendering; it accesses browser globals on import.
const MapCanvas = lazy(() => import('../shared/components/MapCanvas'));
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function OsmMapScreen() {
  const isClient = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const [geoJson, setGeoJson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const api = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';
    let generation = 0;
    async function load() {
      const current = ++generation;
      const features: any[] = [];
      let after = '';
      do {
        const response = await fetch(
          `${api}/map/features?limit=2000&after=${encodeURIComponent(after)}`,
          { credentials: 'include', signal: controller.signal },
        );
        if (!response.ok)
          throw new Error('Could not load campus map. Check your connection and login.');
        const page = await response.json();
        features.push(...page.features);
        after = page.next || '';
      } while (after);
      if (!controller.signal.aborted && current === generation) {
        setGeoJson({ type: 'FeatureCollection', features });
        setLoading(false);
      }
    }
    void load().catch((error) => {
      if (!controller.signal.aborted) {
        setError(String(error));
        setLoading(false);
      }
    });
    const refresh = () => {
      setLoading(true);
      void load().catch((error) => {
        if (!controller.signal.aborted) {
          setError(String(error));
          setLoading(false);
        }
      });
    };
    window.addEventListener('cats-map-updated', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('cats-map-updated', refresh);
    };
  }, []);

  if (!isClient) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Campus Map</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Campus Map</Text>
        {loading && <Text style={styles.statusText}>Loading campus map…</Text>}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <Suspense fallback={<Text style={styles.statusText}>Loading map...</Text>}>
        <MapCanvas geoJson={geoJson} />
      </Suspense>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    padding: 14,
    backgroundColor: '#2c3e50',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  statusText: { color: '#f1c40f', fontSize: 14 },
  errorText: { color: '#e74c3c', fontSize: 14, fontWeight: 'bold' },
});
