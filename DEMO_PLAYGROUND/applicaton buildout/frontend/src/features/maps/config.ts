export type MapMode = 'street' | 'satellite' | 'hybrid';
export const MAP_MODES: MapMode[] = ['street', 'satellite', 'hybrid'];
// Destination coordinates from CMU's official main-campus directions link; not surveyed geometry.
export const CAMPUS_CENTER: [number, number] = [-84.7756162, 43.5906302];
export const CAMPUS_ZOOM = 14.5;
export type MapConfig = { enabled: boolean; styles: Partial<Record<MapMode, string>>; reason: string };
export function mapConfig(enabled: string | undefined, key: string | undefined, custom: Partial<Record<MapMode, string>> = {}): MapConfig {
  const styles: Partial<Record<MapMode, string>> = {};
  for (const mode of MAP_MODES) {
    const value = custom[mode] || (key?.trim() ? `https://api.maptiler.com/maps/${mode === 'street' ? 'streets-v2' : mode}/style.json?key=${encodeURIComponent(key.trim())}` : '');
    if (!value) continue;
    try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) return { enabled: false, styles: {}, reason: 'Style URLs must use HTTPS without embedded credentials.' }; }
    catch { return { enabled: false, styles: {}, reason: 'Invalid map style URL.' }; }
    styles[mode] = value;
  }
  return { enabled: enabled === 'true' && !!styles.street, styles, reason: enabled !== 'true' ? 'Maps are disabled.' : !styles.street ? 'Street style or provider key is missing.' : '' };
}
export const MAP_CONFIG = mapConfig(process.env.EXPO_PUBLIC_MAPS_ENABLED, process.env.EXPO_PUBLIC_MAPTILER_KEY, {
  street: process.env.EXPO_PUBLIC_MAP_STREET_STYLE,
  satellite: process.env.EXPO_PUBLIC_MAP_SATELLITE_STYLE,
  hybrid: process.env.EXPO_PUBLIC_MAP_HYBRID_STYLE,
});
