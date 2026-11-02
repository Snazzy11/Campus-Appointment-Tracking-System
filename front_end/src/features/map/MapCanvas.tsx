import { type ComponentRef, useEffect, useRef } from 'react';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';

function onEachFeature(feature: any, layer: any) {
  if (feature.properties && feature.properties.tags) {
    const tags = feature.properties.tags;
    const popupContent = Object.entries(tags)
      .map(([key, value]) => `<b>${key}:</b> ${value}`)
      .join('<br/>');
    layer.bindPopup(popupContent || 'No tags available');
  }
}

// A stable component preserves the map layer across parent renders.
function MapFeatures({ geoJson }: { geoJson: any }) {
  const map = useMap();
  const layerRef = useRef<ComponentRef<typeof GeoJSON>>(null);

  useEffect(() => {
    if (geoJson.features?.length && layerRef.current) {
      const bounds = layerRef.current.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }
  }, [geoJson, map]);

  return (
    <GeoJSON
      ref={layerRef}
      data={geoJson}
      onEachFeature={onEachFeature}
      style={{ color: '#2980b9', weight: 3, opacity: 0.8 }}
    />
  );
}

export default function MapCanvas({ geoJson }: { geoJson: any }) {
  return (
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
        {geoJson && <MapFeatures key={JSON.stringify(geoJson)} geoJson={geoJson} />}
      </MapContainer>
    </div>
  );
}
