import osmtogeojson from 'osmtogeojson';
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
    fetch('/data/greater_cmu_area.osm')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}`);
        }
        return response.text();
      })
      .then((xmlString) => {
        if (
          !xmlString ||
          xmlString.trim().startsWith('<!DOCTYPE') ||
          xmlString.trim().startsWith('<html')
        ) {
          throw new Error('Received HTML page instead of OSM XML. Check file path/symlink.');
        }

        // Use browser's native DOMParser to parse OSM XML into a Document
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

        // Check for parsing errors
        const parserError = xmlDoc.getElementsByTagName('parsererror');
        if (parserError.length > 0) {
          throw new Error('Failed to parse XML structure from OSM file.');
        }

        // Convert the XML Document to GeoJSON
        const convertedGeoJson = osmtogeojson(xmlDoc);
        setGeoJson(convertedGeoJson);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading OSM file:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (!isClient) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CMU Area OSM Viewer</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CMU Area OSM Viewer</Text>
        {loading && <Text style={styles.statusText}>Loading .osm file...</Text>}
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
