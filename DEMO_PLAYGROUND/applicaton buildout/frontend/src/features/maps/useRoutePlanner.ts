import { useEffect, useRef, useState } from 'react';
import { getRouteLocation } from './location';
import { api, jsonBody } from '../../services/api';
import { createRoutePlanner, emptyRoute, type RouteEndpoint, type RouteProfile } from './routing';
export function useRoutePlanner(destination: RouteEndpoint | null, liveRevision = 0) {
  const [state, setState] = useState(emptyRoute);
  const planner = useRef<ReturnType<typeof createRoutePlanner> | null>(null);
  useEffect(() => {
    const current = createRoutePlanner((body, signal) => api('/api/geo/routes', null, { ...jsonBody(body), signal }), setState);
    planner.current = current;
    return () => { current.stop(); planner.current = null; };
  }, []);
  useEffect(() => { planner.current?.destination(destination); }, [destination]);
  useEffect(() => { if (liveRevision) planner.current?.invalidate(); }, [liveRevision]);
  return { state,
    origin: (point: RouteEndpoint | null, label = '') => planner.current?.origin(point, label),
    profile: (value: RouteProfile) => planner.current?.profile(value),
    clear: () => planner.current?.clear(),
    calculate: () => planner.current?.calculate(),
    directions: () => planner.current?.directions(getRouteLocation),
    locate: () => planner.current?.locate(getRouteLocation),
  };
}
export type Routing = ReturnType<typeof useRoutePlanner>;
