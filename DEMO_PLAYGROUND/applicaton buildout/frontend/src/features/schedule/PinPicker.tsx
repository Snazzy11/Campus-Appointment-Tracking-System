import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Constants from 'expo-constants';
import { mapConfig } from '../maps/config';
import { validReportPoint } from '../maps/reportPoint';
import { s } from './ui';
const config = mapConfig(process.env.EXPO_PUBLIC_MAPS_ENABLED, process.env.EXPO_PUBLIC_MAPTILER_NATIVE_KEY, { street: process.env.EXPO_PUBLIC_MAP_NATIVE_STREET_STYLE });
export function PinPicker({ point, onMove }: { point: [number, number]; onMove: (p: [number, number]) => void }) {
  const [libre, setLibre] = useState<typeof import('@maplibre/maplibre-react-native') | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (Constants.appOwnership === 'expo' || !config.enabled) return; let active = true; void import('@maplibre/maplibre-react-native').then(module => { if (active) setLibre(module); }).catch(() => { if (active) setError('Map unavailable.'); }); return () => { active = false; }; }, []);
  function move(p: [number, number]) { if (validReportPoint(p)) { setError(''); onMove(p); } else setError('Keep the pin within campus.'); }
  return <View style={{ gap: 6 }}>{libre ? <View style={{ height: 280 }}><libre.Map mapStyle={config.styles.street!} touchPitch={false} attribution onPress={e => move(e.nativeEvent.lngLat)} onDidFailLoadingMap={() => setError('Map unavailable. Choose a building or remove the location.')}><libre.Camera initialViewState={{ center: point, zoom: 16, pitch: 0 }} /><libre.ViewAnnotation id="event-pin" key={point.join(',')} lngLat={point} draggable onDragEnd={e => move(e.nativeEvent.lngLat)}><View accessibilityLabel="Event location pin. Drag to move." style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#4338ca', borderWidth: 3, borderColor: 'white' }} /></libre.ViewAnnotation></libre.Map></View> : <Text style={s.text}>Pin placement requires a development build with maps enabled. You can choose a building or save without a location.</Text>}{!!error && <Text style={s.error}>{error}</Text>}</View>;
}
