import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_CONFIG } from '../maps/config';
import { validReportPoint } from '../maps/reportPoint';
import { s } from './ui';
export function PinPicker({ point, onMove }: { point: [number, number]; onMove: (p: [number, number]) => void }) {
  const host = useRef<HTMLDivElement>(null); const latest = useRef({ point, onMove }); const marker = useRef<Marker | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { latest.current = { point, onMove }; marker.current?.setLngLat(point); }, [point, onMove]);
  useEffect(() => {
    if (!MAP_CONFIG.enabled) return;
    let stopped = false; let cleanup = () => {};
    void import('maplibre-gl').then(libre => {
      if (stopped || !host.current) return;
      libre.setWorkerUrl(`${window.location.origin}/maplibre/${libre.getVersion()}/maplibre-gl-worker.mjs`);
      const map = new libre.Map({ container: host.current, style: MAP_CONFIG.styles.street!, center: latest.current.point, zoom: 16, maxPitch: 0, attributionControl: { compact: true } });
      const pin = new libre.Marker({ draggable: true, color: '#4338ca' }).setLngLat(latest.current.point).addTo(map); marker.current = pin;
      pin.getElement().setAttribute('aria-label', 'Event location pin. Drag to move.');
      const move = (p: [number, number]) => { if (validReportPoint(p)) { setError(''); latest.current.onMove(p); pin.setLngLat(p); } else { setError('Keep the pin within campus.'); pin.setLngLat(latest.current.point); } };
      map.on('click', e => move([e.lngLat.lng, e.lngLat.lat]));
      pin.on('dragend', () => { const p = pin.getLngLat(); move([p.lng, p.lat]); });
      map.on('error', () => setError('Map tiles could not load. Try again or choose a building instead.'));
      const observer = new ResizeObserver(() => map.resize()); observer.observe(host.current);
      cleanup = () => { observer.disconnect(); pin.remove(); map.remove(); marker.current = null; };
    }).catch(() => { if (!stopped) setError('Map unavailable. Choose a building or save without a location.'); });
    return () => { stopped = true; cleanup(); };
  }, []);
  return <View style={{ gap: 6 }}>{MAP_CONFIG.enabled ? <div ref={host} role="region" aria-label="Event location map" style={{ height: 280, borderRadius: 12, overflow: 'hidden' }} /> : <Text style={s.text}>Maps are unavailable. Choose a building or remove the location.</Text>}{!!error && <Text style={s.error}>{error}</Text>}</View>;
}
