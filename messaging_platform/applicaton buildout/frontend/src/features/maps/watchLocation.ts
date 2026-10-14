import type { LocationWatch } from './following';
export const watchLocation: LocationWatch = async (signal, update, fail) => {
  const Location = await import('expo-location');
  if (signal.aborted) return () => {};
  const permission = await Location.requestForegroundPermissionsAsync();
  if (signal.aborted) return () => {};
  if (!permission.granted) { fail('Location permission was denied. Allow location in device settings or choose a starting building.'); return () => {}; }
  const subscription = await Location.watchPositionAsync({accuracy:Location.Accuracy.High,distanceInterval:0,timeInterval:5000}, location => { if(!signal.aborted)update({...location.coords,timestamp:location.timestamp}); }, () => fail('Location is unavailable. Choose a starting building or try again.'));
  if (signal.aborted) { subscription.remove(); return () => {}; }
  let stopped = false;
  const stop = () => { if (!stopped) { stopped = true; subscription.remove(); } };
  signal.addEventListener('abort',stop,{once:true});
  return () => {signal.removeEventListener('abort',stop);stop();};
};
