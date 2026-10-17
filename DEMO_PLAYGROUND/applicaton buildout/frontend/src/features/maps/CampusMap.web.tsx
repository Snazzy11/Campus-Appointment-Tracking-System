import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map-controls.css';
import { CAMPUS_CENTER, CAMPUS_ZOOM, MAP_CONFIG, MAP_MODES, type MapMode } from './config';
import { mapController, type MapStatus } from './controller';
import { MapBoundary, MapFrame } from './MapFrame';
import { ReportPin } from './ReportPin.web';
import { DestinationPanel } from './DestinationPanel';
import { useDestinations } from './useDestinations';
import { destinationLayers } from './layers';
export function CampusMap({ initialSearch = '' }: { initialSearch?: string }) { return <MapBoundary><WebMap initialSearch={initialSearch} /></MapBoundary>; }
function WebMap({ initialSearch }: { initialSearch: string }) {
  const destinations = useDestinations(initialSearch);
  const [pinMap, setPinMap] = useState<LibreMap | null>(null);
  const focusRef = useRef<{ bounds: [number, number, number, number]; entrance: boolean } | null>(null);
  const overlayRef = useRef(destinations.overlay);
  useEffect(() => { overlayRef.current = destinations.overlay; controller.current?.setOverlay(destinations.overlay); }, [destinations.overlay]);
  const container = useRef<HTMLDivElement>(null); const instance = useRef<LibreMap | null>(null);
  const controller = useRef<ReturnType<typeof mapController> | null>(null);
  const [mode, setMode] = useState<MapMode>('street'); const [status, setStatus] = useState<MapStatus>('loading');
  const modeRef = useRef(mode);
  useEffect(() => {
    if (!MAP_CONFIG.enabled || !container.current) return;
    let stopped = false; let observer: ResizeObserver | undefined; let timeout: ReturnType<typeof setTimeout> | undefined;
    void import('maplibre-gl').then(libre => {
      if (stopped || !container.current) return;
      libre.setWorkerUrl(`${window.location.origin}/maplibre/${libre.getVersion()}/maplibre-gl-worker.mjs`);
      const map = new libre.Map({ container: container.current, style: MAP_CONFIG.styles.street!, center: CAMPUS_CENTER, zoom: CAMPUS_ZOOM, pitch: 0, maxPitch: 0, touchPitch: false, pitchWithRotate: false, attributionControl: { compact: true }, keyboard: true });
      instance.current = map; setPinMap(map);
      let userMoved = false;
      const fitCampus = () => { if (!userMoved && !focusRef.current) map.fitBounds([[-84.787, 43.578], [-84.764, 43.598]], { padding: 28, duration: 0 }); };
      map.on('movestart', event => { if (event.originalEvent) userMoved = true; });
      if (container.current.clientWidth < 600) fitCampus();
      map.addControl(new libre.NavigationControl({ showCompass: true }), 'top-right'); map.addControl(new libre.ScaleControl(), 'bottom-left');
      const report = (next: MapStatus) => { if (!stopped) { setStatus(next); if (timeout) clearTimeout(timeout); if (next === 'loading') timeout = setTimeout(() => { if (!stopped) setStatus('error'); }, 15000); } };
      controller.current = mapController({ on: (event, fn) => { map.on(event, fn); }, off: (event, fn) => { map.off(event, fn); }, setStyle: url => { map.setStyle(url); }, resize: () => map.resize(), remove: () => map.remove(), restoreOverlay: data => {
        const source = map.getSource('campus-overlay') as GeoJSONSource | undefined;
        if (source) source.setData(data); else map.addSource('campus-overlay', { type: 'geojson', data });
        for (const layer of destinationLayers) if (!map.getLayer(layer.id)) map.addLayer(layer);
      } }, MAP_CONFIG.styles.street!, report);
      map.on('webglcontextlost',()=>{setStatus('error');});
      map.on('webglcontextrestored',()=>{controller.current?.switchStyle(MAP_CONFIG.styles[modeRef.current]!,true);});
      controller.current.setOverlay(overlayRef.current);
      if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(() => { controller.current?.resize(); const focus = focusRef.current; if (focus) map.fitBounds([[focus.bounds[0], focus.bounds[1]], [focus.bounds[2], focus.bounds[3]]], { padding: 32, maxZoom: focus.entrance ? 19 : 17.5, duration: 0 }); else if (container.current && container.current.clientWidth < 600) fitCampus(); }); observer.observe(container.current); }
      report('loading');
    }).catch(() => { if (!stopped) setStatus('error'); });
    return () => { stopped = true; if (timeout) clearTimeout(timeout); observer?.disconnect(); controller.current?.dispose(); controller.current = null; instance.current = null; };
  }, []);
  useEffect(() => {
    const bounds = destinations.focusBounds;
    focusRef.current = bounds ? { bounds, entrance: destinations.state.entranceId !== null } : null;
    if (bounds && status === 'ready') instance.current?.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 32, maxZoom: destinations.state.entranceId ? 19 : 17.5, duration: 0 });
  }, [destinations.focusBounds, destinations.state.entranceId, destinations.state.focusVersion, status]);
  function select(value: MapMode) { const url = MAP_CONFIG.styles[value]; if (!url) return; modeRef.current = value; setMode(value); controller.current?.switchStyle(url); }
  return <MapFrame defaultToolsOpen={!!initialSearch} tools={MAP_CONFIG.enabled ? <DestinationPanel destinations={destinations} /> : undefined} status={MAP_CONFIG.enabled ? status : 'unavailable'} mode={mode} modes={MAP_CONFIG.enabled ? MAP_MODES.filter(value => !!MAP_CONFIG.styles[value]) : []} onMode={select} onRetry={() => controller.current?.switchStyle(MAP_CONFIG.styles[modeRef.current]!, true)}>
    {MAP_CONFIG.enabled ? <View style={{ flex: 1 }}><ReportPin map={pinMap} point={destinations.reportPoint} onMove={destinations.moveReportPin} /><div ref={container} role="region" aria-label="Interactive CMU campus map. Arrow keys pan; plus and minus zoom." style={{ position: 'absolute', inset: 0 }} /></View> : null}
  </MapFrame>;
}
