import type { Feature, Point, Polygon } from 'geojson';
export type LocationFix = { longitude: number; latitude: number; accuracy: number | null; timestamp: number };
export type FollowState = { status: 'idle' | 'locating' | 'following' | 'error'; fix: LocationFix | null; message: string };
export type LocationWatch = (signal: AbortSignal, update: (fix: LocationFix) => void, fail: (message: string) => void) => Promise<() => void>;
export const emptyFollow: FollowState = { status: 'idle', fix: null, message: '' };
export function createLocationFollower(watch: LocationWatch, publish: (state: FollowState) => void, inCampus: (point: [number, number]) => boolean, now = Date.now) {
  let generation = 0, disposed = false;
  let abort: AbortController | undefined, remove: (() => void) | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { generation++; clearTimeout(deadline); abort?.abort(); abort = undefined; remove?.(); remove = undefined; };
  const stop = (message = '') => { cancel(); if (!disposed) publish({ ...emptyFollow, message }); };
  return {
    stop,
    start() {
      if (disposed) return;
      cancel(); const current = generation; abort = new AbortController();
      const signal = abort.signal;
      const active = () => !disposed && current === generation;
      const fail = (message: string) => { if (active()) { cancel(); publish({ status: 'error', fix: null, message }); } };
      const timeout = (ms: number) => { clearTimeout(deadline); deadline = setTimeout(() => fail('Location updates stopped. Try following again or choose a starting building.'), ms); };
      publish({ status: 'locating', fix: null, message: 'Finding your location…' }); timeout(25000);
      void watch(signal, fix => {
        if (!active()) return;
        if (![fix.longitude, fix.latitude, fix.accuracy, fix.timestamp].every(value => typeof value === 'number' && Number.isFinite(value)) || fix.accuracy! < 0 || fix.accuracy! > 1000 || now() - fix.timestamp > 30000 || fix.timestamp - now() > 10000) {
          fail('Location is too old or too imprecise. Try again outdoors or choose a starting building.'); return;
        }
        if (!inCampus([fix.longitude, fix.latitude])) { fail('You appear to be outside the mapped campus. Choose a campus building as your starting point.'); return; }
        timeout(60000);
        publish({ status: 'following', fix, message: fix.accuracy! > 50 ? 'Approximate location. Accuracy is too low to use as a route starting point.' : 'Following your location' });
      }, fail).then(cleanup => { if (active()) remove = cleanup; else cleanup(); }).catch(() => fail('Location could not start. Check location permission and try again.'));
    },
    dispose() { disposed = true; cancel(); },
  };
}
export function locationOverlay(fix: LocationFix | null): Feature<Point | Polygon>[] {
  if (!fix || fix.accuracy === null) return [];
  const ring: number[][] = [];
  for (let i = 0; i <= 48; i++) {
    const angle = (i % 48) * Math.PI / 24;
    ring.push([fix.longitude + Math.cos(angle) * fix.accuracy / (111320 * Math.cos(fix.latitude * Math.PI / 180)), fix.latitude + Math.sin(angle) * fix.accuracy / 111320]);
  }
  return [
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { kind: 'location-accuracy' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [fix.longitude, fix.latitude] }, properties: { kind: 'user-location' } },
  ];
}
export function locationBounds(fix: LocationFix | null): [number, number, number, number] | null {
  if (!fix) return null;
  const dy = Math.max(60, fix.accuracy || 0) / 111320;
  const dx = dy / Math.cos(fix.latitude * Math.PI / 180);
  return [fix.longitude-dx,fix.latitude-dy,fix.longitude+dx,fix.latitude+dy];
}
