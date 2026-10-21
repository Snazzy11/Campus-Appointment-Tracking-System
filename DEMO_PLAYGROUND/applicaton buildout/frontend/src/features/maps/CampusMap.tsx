// Native/default renderer. Metro selects CampusMap.web.tsx in the browser.
import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { View, useWindowDimensions } from 'react-native';
import type { CameraRef, CameraCenterOptions, CameraOptions } from '@maplibre/maplibre-react-native';
import { CAMPUS_CENTER, CAMPUS_ZOOM, mapConfig, MAP_MODES, type MapMode } from './config';
import { MapBoundary, MapFrame } from './MapFrame';
import type { MapStatus } from './controller';
import { useDestinations } from './useDestinations';
import { DestinationPanel } from './DestinationPanel';
import { destinationLayers } from './layers';
const MAP_CONFIG = mapConfig(process.env.EXPO_PUBLIC_MAPS_ENABLED, process.env.EXPO_PUBLIC_MAPTILER_NATIVE_KEY, {
  street: process.env.EXPO_PUBLIC_MAP_NATIVE_STREET_STYLE,
  satellite: process.env.EXPO_PUBLIC_MAP_NATIVE_SATELLITE_STYLE,
  hybrid: process.env.EXPO_PUBLIC_MAP_NATIVE_HYBRID_STYLE,
});
export function CampusMap({ initialSearch = '' }: { initialSearch?: string }) { return <MapBoundary><NativeMap initialSearch={initialSearch} /></MapBoundary>; }
function NativeMap({ initialSearch }: { initialSearch: string }) {
  const destinations = useDestinations(initialSearch);
  const { width, height } = useWindowDimensions();
  const [libre, setLibre] = useState<typeof import('@maplibre/maplibre-react-native') | null>(null);
  const [mode, setMode] = useState<MapMode>('street'); const [status, setStatus] = useState<MapStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  const failed=useCallback(()=>{setStatus('error');},[]);
  const camera = useRef<CameraRef>(null); const view = useRef<CameraCenterOptions & CameraOptions>({ center: CAMPUS_CENTER, zoom: CAMPUS_ZOOM, bearing: 0, pitch: 0 });
  useEffect(() => {
    if (!MAP_CONFIG.enabled || Constants.appOwnership === 'expo') return;
    let stopped = false;
    void import('@maplibre/maplibre-react-native').then(module => { if (!stopped) setLibre(module); }).catch(() => { if (!stopped) setStatus('error'); });
    return () => { stopped = true; };
  }, [attempt]);
  function select(value: MapMode) { setStatus('loading'); setMode(value); }
  const available = MAP_CONFIG.enabled && Constants.appOwnership !== 'expo';
  useEffect(() => { if (!available || status !== 'loading') return; const timer = setTimeout(() => setStatus('error'), 15000); return () => clearTimeout(timer); }, [available, status, attempt]);
  useEffect(() => {
    const bounds = destinations.focusBounds;
    if (bounds && status === 'ready') {
      if (bounds[0] === bounds[2] && bounds[1] === bounds[3]) camera.current?.jumpTo({ center: [bounds[0], bounds[1]], zoom: 19 });
      else camera.current?.fitBounds(bounds, { padding: { top: 32, right: 32, bottom: 32, left: 32 }, duration: 0 });
    }
  }, [destinations.focusBounds, destinations.state.focusVersion, status, width, height]);
  return <MapFrame defaultToolsOpen={!!initialSearch} tools={MAP_CONFIG.enabled ? <DestinationPanel destinations={destinations} /> : undefined} status={available ? status : 'unavailable'} mode={mode} modes={available && libre ? MAP_MODES.filter(value => !!MAP_CONFIG.styles[value]) : []} onMode={select} onRetry={() => { setStatus('loading'); setAttempt(value => value + 1); }}>
    {libre ? <libre.Map key={attempt} mapStyle={MAP_CONFIG.styles[mode]!} attribution compass scaleBar touchPitch={false}
      onPress={event => { if (destinations.reportPoint) destinations.moveReportPin(event.nativeEvent.lngLat); }}
      onRegionDidChange={event => { view.current = { ...event.nativeEvent, pitch: 0 }; }}
      onDidFinishLoadingMap={() => { camera.current?.jumpTo(view.current); setStatus('ready'); }} onDidFailLoadingMap={failed}>
      {destinations.reportPoint ? <libre.ViewAnnotation key={destinations.pinRevision} id="report-draft" lngLat={destinations.reportPoint} draggable onDragEnd={event => destinations.moveReportPin(event.nativeEvent.lngLat)}>
        <View accessibilityLabel="Report location pin. Drag to the issue." style={{width:32,height:32,borderRadius:16,backgroundColor:'#ea580c',borderColor:'white',borderWidth:3}} />
      </libre.ViewAnnotation> : null}
      <libre.Camera ref={camera} initialViewState={{ center: CAMPUS_CENTER, zoom: CAMPUS_ZOOM, bearing: 0, pitch: 0 }} />
      <libre.GeoJSONSource id="campus-overlay" data={destinations.overlay}>
        {destinationLayers.map(layer => <libre.Layer key={layer.id} {...layer} />)}
      </libre.GeoJSONSource>
    </libre.Map> : null}
  </MapFrame>;
}
