import type { LocationWatch } from './following';
export const watchLocation: LocationWatch = async (signal, update, fail) => {
  if (!window.isSecureContext || !navigator.geolocation) { fail('Location requires a secure browser connection and location support.'); return () => {}; }
  if (signal.aborted) return () => {};
  const id = navigator.geolocation.watchPosition(position => update({ ...position.coords, longitude:position.coords.longitude,latitude:position.coords.latitude,accuracy:position.coords.accuracy,timestamp:position.timestamp }), error => fail(error.code === 1 ? 'Location permission was denied. Allow location in browser settings or choose a starting building.' : error.code === 3 ? 'Location timed out. Try again outdoors or choose a starting building.' : 'Location is unavailable. Choose a starting building or try again.'), { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  let stopped = false;
  const stop = () => { if (!stopped) { stopped = true; navigator.geolocation.clearWatch(id); } };
  signal.addEventListener('abort', stop, { once:true });
  return () => { signal.removeEventListener('abort',stop);stop(); };
};
