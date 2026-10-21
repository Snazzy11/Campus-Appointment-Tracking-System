import type { Feature, LineString } from 'geojson';
export type ReviewPath = { id: number; length_m: number; distance_m: number; geometry: LineString };
export function nearbyPathIds(paths: ReviewPath[]): number[] {
  return paths.filter(path => Number.isFinite(path.distance_m) && path.distance_m >= 0 && path.distance_m <= 10).map(path => path.id);
}
export function closurePreview(paths: ReviewPath[], selected: number[]): Feature<LineString>[] {
  return paths.filter(path => selected.includes(path.id)).map(path => ({ type: 'Feature', id: path.id, geometry: path.geometry, properties: { kind: 'closure-preview' } }));
}
