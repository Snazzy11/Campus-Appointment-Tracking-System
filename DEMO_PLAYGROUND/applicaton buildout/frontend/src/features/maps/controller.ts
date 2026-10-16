import type { FeatureCollection } from 'geojson';
export type MapStatus = 'loading' | 'ready' | 'error';
export type MapAdapter = {
  on: (event: 'style.load' | 'error', handler: () => void) => void; off: (event: 'style.load' | 'error', handler: () => void) => void;
  setStyle: (url: string) => void; resize: () => void; remove: () => void;
  restoreOverlay: (data: FeatureCollection) => void;
};
export function mapController(map: MapAdapter, initialStyle: string, report: (status: MapStatus) => void) {
  let ready = false; let disposed = false; let failedStyle = false; let style = initialStyle;
  let overlay: FeatureCollection = { type: 'FeatureCollection', features: [] };
  const loaded = () => { if (!disposed) { ready = true; map.restoreOverlay(overlay); if (!failedStyle) report('ready'); } };
  const failed = () => { if (!disposed) { failedStyle = true; report('error'); } };
  map.on('style.load', loaded); map.on('error', failed);
  return {
    switchStyle(url: string, retry = false) { if (disposed || (!retry && style === url)) return; style = url; ready = false; failedStyle = false; report('loading'); map.setStyle(url); },
    setOverlay(data: FeatureCollection) { if (disposed) return; overlay = data; if (ready) map.restoreOverlay(overlay); },
    resize() { if (!disposed) map.resize(); },
    dispose() { if (disposed) return; disposed = true; map.off('style.load', loaded); map.off('error', failed); map.remove(); },
  };
}
