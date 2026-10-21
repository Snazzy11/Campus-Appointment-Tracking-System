import type { Feature, LineString, Point } from 'geojson';
export type RouteEndpoint = { kind: 'building' | 'entrance'; id: number } | { kind: 'coordinate'; longitude: number; latitude: number };
export type RouteProfile = 'walking' | 'shortest' | 'step_free';
export type RouteResult = Feature<LineString | Point, {
  kind: 'route'; distance_m: number; duration_s: number; profile: RouteProfile;
  bounds: [number, number, number, number]; warnings: string[];
  instructions: { path_id: number; text: string; distance_m: number }[];
  origin: { snapped: [number, number]; gap_m: number };
  destination: { snapped: [number, number]; gap_m: number };
}>;
export type RouteState = { origin: RouteEndpoint | null; originLabel: string; destination: RouteEndpoint | null;
  directionsOpen: boolean; profile: RouteProfile; result: RouteResult | null; status: 'idle' | 'loading' | 'locating' | 'done' | 'error'; error: string };
export const emptyRoute: RouteState = { origin: null, originLabel: '', destination: null, directionsOpen: false, profile: 'walking', result: null, status: 'idle', error: '' };
export function createRoutePlanner(request: (body: { origin: RouteEndpoint; destination: RouteEndpoint; profile: RouteProfile }, signal: AbortSignal) => Promise<RouteResult>, publish: (state: RouteState) => void) {
  let state = emptyRoute; let generation = 0; let stopped = false; let pending: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = (patch: Partial<RouteState>) => { state = { ...state, ...patch }; if (!stopped) publish(state); };
  const cancel = () => { generation++; pending?.abort(); clearTimeout(timer); };
  const reset = (patch: Partial<RouteState> = {}) => { if (stopped) return; cancel(); update({ result: null, status: 'idle', error: '', ...patch }); };
  const planner = {
    snapshot: () => state,
    origin: (origin: RouteEndpoint | null, originLabel = '') => reset({ origin, originLabel }),
    destination: (destination: RouteEndpoint | null) => { if (JSON.stringify(destination) !== JSON.stringify(state.destination)) reset({ destination }); },
    profile: (profile: RouteProfile) => reset({ profile }),
    clear: () => reset(),
    invalidate: () => { if (state.result || state.status === 'loading') reset({status:'error',error:'Live map conditions changed or updates were interrupted. Get directions again to check the latest path availability.'}); },
    async directions(getLocation: () => Promise<{ longitude: number; latitude: number; accuracy: number | null }>) {
      update({ directionsOpen: true });
      if (!state.origin && !(await planner.locate(getLocation))) return;
      await planner.calculate();
    },
    async locate(getLocation: () => Promise<{ longitude: number; latitude: number; accuracy: number | null }>) {
      reset(); const current = generation; update({ status: 'locating' });
      timer = setTimeout(() => { if (!stopped && current === generation) { cancel(); update({ status: 'error', error: 'Location timed out. Check location permission for your browser, or choose a starting building in From.' }); } }, 30000);
      try {
        const point = await getLocation();
        if (stopped || current !== generation) return;
        clearTimeout(timer);
        if (!Number.isFinite(point.longitude) || !Number.isFinite(point.latitude) || point.longitude < -84.80 || point.longitude > -84.74 || point.latitude < 43.56 || point.latitude > 43.62) throw new Error('Your location is outside the mapped campus area. Choose a starting building.');
        if (point.accuracy === null || !Number.isFinite(point.accuracy) || point.accuracy < 0 || point.accuracy > 50) throw new Error('Location accuracy is too low. Choose a starting building or try again outdoors.');
        reset({ origin: { kind: 'coordinate', longitude: point.longitude, latitude: point.latitude }, originLabel: 'My location', status: 'idle' });
        return true;
      } catch (error) { if (!stopped && current === generation) { clearTimeout(timer); update({ status: 'error', error: error instanceof Error ? error.message : 'Location unavailable. Choose a starting building.' }); } }
    },
    async calculate() {
      if (stopped || !state.origin || !state.destination) return;
      reset(); const current = generation; pending = new AbortController();
      update({ status: 'loading' });
      timer = setTimeout(() => { if (!stopped && current === generation) { cancel(); update({ status: 'error', error: 'Directions timed out. Please try again.' }); } }, 12000);
      try {
        const result = await request({ origin: state.origin!, destination: state.destination!, profile: state.profile }, pending.signal);
        if (!stopped && current === generation) { clearTimeout(timer); update({ result, status: 'done' }); }
      } catch (error) { if (!stopped && current === generation) { clearTimeout(timer); update({ status: 'error', error: error instanceof Error && !(error instanceof TypeError) ? error.message : 'Directions could not load. Check your connection and try again.' }); } }
    },
    stop() { stopped = true; cancel(); },
  };
  return planner;
}
export function distanceLabel(meters: number) { return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`; }
