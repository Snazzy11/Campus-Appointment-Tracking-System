import type { Feature, Geometry, FeatureCollection } from 'geojson';
export type BuildingMatch = { id: number; name: string; matched_term: string; match_kind: string; street: string | null; house_number: string | null; longitude: number; latitude: number };
export type CampusFeature = Feature<Geometry, { name: string | null; tags: Record<string, string>; bounds: [number, number, number, number]; accessibility_verified: boolean; association_verified: boolean; verified: boolean; aliases?: { label: string; kind: string }[] }> & { id: number };
export type CampusCollection = { features: CampusFeature[]; next_after: number | null };
export type DestinationState = {
  query: string; results: BuildingMatch[]; hasMore: boolean; active: number;
  searchStatus: 'idle' | 'pending' | 'loading' | 'done' | 'error'; error: string;
  detailStatus: 'idle' | 'loading' | 'done' | 'error'; selected: CampusFeature | null;
  entrances: CampusFeature[]; entranceId: number | null; moreEntrances: boolean; focusVersion: number;
};
export const emptyDestination: DestinationState = { query: '', results: [], hasMore: false, active: -1, searchStatus: 'idle', error: '', detailStatus: 'idle', selected: null, entrances: [], entranceId: null, moreEntrances: false, focusVersion: 0 };
export type DestinationRequest = <T>(path: string, signal: AbortSignal) => Promise<T>;
export function createDestinationSearch(request: DestinationRequest, publish: (value: DestinationState) => void) {
  let state = emptyDestination; let generation = 0; let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined; let deadline: ReturnType<typeof setTimeout> | undefined; let pending: AbortController | undefined;
  const update = (value: Partial<DestinationState>) => { state = { ...state, ...value }; publish(state); };
  const cancel = () => { generation++; clearTimeout(timer); clearTimeout(deadline); pending?.abort(); };
  const friendlyError = () => 'Building information could not load. Check your connection and try again.';
  const controller = {
    snapshot: () => state,
    change(query: string) {
      if (disposed) return;
      cancel(); const current = generation; const normalized = query.trim();
      update({ ...emptyDestination, query, searchStatus: normalized.length >= 2 ? 'pending' : 'idle' });
      if (normalized.length < 2) return;
      timer = setTimeout(() => {
        pending = new AbortController(); deadline = setTimeout(() => pending?.abort(), 10000); update({ searchStatus: 'loading' });
        request<{ results: BuildingMatch[]; has_more: boolean }>(`/api/geo/buildings/search?q=${encodeURIComponent(normalized)}&limit=20`, pending.signal).then(data => {
          if (!disposed && current === generation) { clearTimeout(deadline); update({ results: data.results, hasMore: data.has_more, searchStatus: 'done' }); }
        }).catch(() => { if (!disposed && current === generation) { clearTimeout(deadline); update({ searchStatus: 'error', error: friendlyError() }); } });
      }, 250);
    },
    select(match: BuildingMatch) {
      if (disposed) return;
      cancel(); const current = generation; pending = new AbortController(); deadline = setTimeout(() => pending?.abort(), 10000);
      update({ ...emptyDestination, query: match.name, detailStatus: 'loading' });
      Promise.all([
        request<CampusFeature>(`/api/geo/buildings/${match.id}`, pending.signal),
        request<CampusCollection>(`/api/geo/buildings/${match.id}/entrances`, pending.signal),
      ]).then(([selected, entrances]) => {
        if (!disposed && current === generation) { clearTimeout(deadline); update({ query:selected.properties.name || 'Unnamed building', selected, entrances: entrances.features, moreEntrances: entrances.next_after !== null, detailStatus: 'done', focusVersion: state.focusVersion + 1 }); }
      }).catch(() => { if (!disposed && current === generation) { clearTimeout(deadline); update({ detailStatus: 'error', error: friendlyError() }); } });
    },
    key(key: string) {
      if (disposed) return false;
      if (key === 'Escape') { cancel(); update({ results: [], active: -1, searchStatus: 'idle', error: '' }); return true; }
      if (!state.results.length) return false;
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        const delta = key === 'ArrowDown' ? 1 : -1;
        update({ active: state.active < 0 ? (delta > 0 ? 0 : state.results.length - 1) : (state.active + delta + state.results.length) % state.results.length });
        return true;
      }
      if (key === 'Enter') { controller.select(state.results[Math.max(0, state.active)]); return true; }
      return false;
    },
    entrance(id: number | null) { if (!disposed && (id === null || state.entrances.some(item => item.id === id))) update({ entranceId: id, focusVersion: state.focusVersion + 1 }); },
    stop() { disposed = true; cancel(); },
  };
  return controller;
}
export function destinationOverlay(state: DestinationState): FeatureCollection {
  return { type: 'FeatureCollection', features: state.selected ? [
    { ...state.selected, properties: { kind: 'building' } },
    ...state.entrances.map(item => ({ ...item, properties: { kind: 'entrance', selected: item.id === state.entranceId, verified: item.properties.association_verified } })),
  ] : [] };
}
export function entranceLabel(feature: CampusFeature, index: number) {
  return feature.properties.name || (feature.properties.tags.entrance === 'main' ? 'Main entrance' : `Entrance ${index + 1}`);
}
export function accessibilityLabel(feature: CampusFeature) {
  const value = feature.properties.tags.wheelchair;
  if (!feature.properties.accessibility_verified) return 'Accessibility not verified';
  return value === 'yes' ? 'Wheelchair access verified' : value === 'no' ? 'No wheelchair access · verified' : value === 'limited' ? 'Limited wheelchair access · verified' : 'Accessibility reviewed; access details unavailable';
}
