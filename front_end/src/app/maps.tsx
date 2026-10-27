import osmtogeojson from 'osmtogeojson';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function OsmMapScreen() {
  const [isClient, setIsClient] = useState(false);
  const [geoJson, setGeoJson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);

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

  const { MapContainer, TileLayer, GeoJSON, useMap } = require('react-leaflet');

  function RecenterMap({ geoJsonData }: { geoJsonData: any }) {
    const map = useMap();
    useEffect(() => {
      if (geoJsonData && geoJsonData.features && geoJsonData.features.length > 0) {
        const L = require('leaflet');
        const layer = L.geoJSON(geoJsonData);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [30, 30] });
        }
      }
    }, [geoJsonData, map]);
    return null;
  }

  const onEachFeature = (feature: any, layer: any) => {
    if (feature.properties && feature.properties.tags) {
      const tags = feature.properties.tags;
      const popupContent = Object.entries(tags)
        .map(([key, value]) => `<b>${key}:</b> ${value}`)
        .join('<br/>');
      layer.bindPopup(popupContent || 'No tags available');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CMU Area OSM Viewer</Text>
        {loading && <Text style={styles.statusText}>Loading .osm file...</Text>}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <div style={{ flex: 1, width: '100%', height: '100%' }}>
        <MapContainer
          center={[43.5853, -84.7732]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {geoJson && (
            <>
              <GeoJSON
                key={JSON.stringify(geoJson)}
                data={geoJson}
                onEachFeature={onEachFeature}
                style={{ color: '#2980b9', weight: 3, opacity: 0.8 }}
              />
              <RecenterMap geoJsonData={geoJson} />
            </>
          )}
        </MapContainer>
      </div>
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
