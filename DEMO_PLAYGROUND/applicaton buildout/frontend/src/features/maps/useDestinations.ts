import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Feature, LineString } from 'geojson';
import { useFollowing } from './useFollowing';
import { locationBounds, locationOverlay } from './following';
import { api } from '../../services/api';
import { createDestinationSearch, destinationOverlay, emptyDestination, type BuildingMatch } from './destinations';
import { validReportPoint, type ReportPoint } from './reportPoint';
import { CAMPUS_CENTER, MAP_CONFIG } from './config';
import { useBlips } from './useBlips';
import { useRoutePlanner } from './useRoutePlanner';
import type { RouteEndpoint } from './routing';
export function useDestinations(initialSearch = '') {
  const following = useFollowing();
  const followBounds = useMemo(()=>locationBounds(following.state.fix),[following.state.fix]);
  const [pathPreview, previewPaths] = useState<Feature<LineString>[]>([]);
  const [reportPoint, setReportPoint] = useState<ReportPoint | null>(null);
  const [pinRevision, setPinRevision] = useState(0);
  const [pinError, setPinError] = useState('');
  const moveReportPin = useCallback((point: ReportPoint) => {
    setPinRevision(value => value + 1);
    if (!validReportPoint(point)) { setPinError('Keep the report pin within the mapped campus area.'); return false; }
    setPinError(''); setReportPoint(point); return true;
  }, []);
  const cancelReportPin = useCallback(() => { setReportPoint(null); setPinError(''); }, []);
  const blips = useBlips(MAP_CONFIG.enabled);
  const [reportBounds, setReportBounds] = useState<[number,number,number,number] | null>(null);
  const [state, setState] = useState(emptyDestination);
  const controller = useRef<ReturnType<typeof createDestinationSearch> | null>(null);
  useEffect(() => {
    const current = createDestinationSearch((path, signal) => api(path, null, { signal }), setState);
    controller.current = current;
    if (initialSearch) current.change(initialSearch);
    return () => { current.stop(); controller.current = null; };
  }, [initialSearch]);
  const stopFollowing = following.stop;
  const selectBuildingId = useCallback((id:number) => {
    stopFollowing();
    controller.current?.select({id,name:'Selected building',matched_term:'',match_kind:'name',street:null,house_number:null,longitude:0,latitude:0});
    setReportBounds(null);
  }, [stopFollowing]);
  const endpoint = useMemo<RouteEndpoint | null>(() => state.entranceId ? { kind: 'entrance', id: state.entranceId } : state.selected ? { kind: 'building', id: state.selected.id } : null, [state.selected, state.entranceId]);
  const planner = useRoutePlanner(endpoint, blips.routeRevision);
  const routing = { ...planner, directions: () => { following.stop(); setReportBounds(null); return planner.directions(); } };
  const result = routing.state.result;
  const overlay = useMemo(() => {
    const data = destinationOverlay(state);
    data.features.push(...blips.data.features, ...pathPreview, ...locationOverlay(following.state.fix));
    if (result) data.features.push(result,
      { type: 'Feature', geometry: { type: 'Point', coordinates: result.properties.origin.snapped }, properties: { kind: 'route-start' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: result.properties.destination.snapped }, properties: { kind: 'route-end' } });
    return data;
  }, [state, result, blips.data, pathPreview, following.state.fix]);
  const target = state.entrances.find(item => item.id === state.entranceId) || state.selected;
  return { state, blips, selectBuildingId, following: { ...following, start: () => { cancelReportPin(); setReportBounds(null); following.start(); } }, previewPaths, reportPoint, pinError, pinRevision, moveReportPin, cancelReportPin,
    startReportPin: () => {
      following.stop();
      const b = target?.properties.bounds;
      const point: ReportPoint = b ? [(b[0]+b[2])/2,(b[1]+b[3])/2] : [...CAMPUS_CENTER];
      moveReportPin(point); setReportBounds([point[0]-0.0008,point[1]-0.0008,point[0]+0.0008,point[1]+0.0008]);
    }, showReport: (x: number, y: number) => { following.stop(); setReportBounds([x-0.0002,y-0.0002,x+0.0002,y+0.0002]); }, overlay, target, routing, endpoint, focusBounds: followBounds || reportBounds || result?.properties.bounds || target?.properties.bounds,
    change: (query: string) => { following.stop(); setReportBounds(null); controller.current?.change(query); },
    select: (match: BuildingMatch) => { following.stop(); setReportBounds(null); controller.current?.select(match); },
    key: (key: string) => controller.current?.key(key) ?? false,
    entrance: (id: number | null) => { following.stop(); routing.clear(); controller.current?.entrance(id); },
  };
}
export type Destinations = ReturnType<typeof useDestinations>;
