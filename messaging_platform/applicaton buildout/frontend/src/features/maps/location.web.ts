import { browserLocation } from './browserLocation';
export function getRouteLocation() {
  return browserLocation(typeof navigator !== 'undefined' ? navigator.geolocation : undefined, typeof window !== 'undefined' && window.isSecureContext);
}
