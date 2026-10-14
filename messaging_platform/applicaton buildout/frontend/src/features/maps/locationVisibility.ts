import { AppState } from 'react-native';
export function onLocationHidden(stop: () => void) {
  const subscription = AppState.addEventListener('change', state => { if(state === 'background')stop(); });
  return () => subscription.remove();
}
