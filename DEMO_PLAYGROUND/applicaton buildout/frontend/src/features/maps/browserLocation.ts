export type Position = { longitude: number; latitude: number; accuracy: number | null };
export function browserLocation(geolocation: Pick<Geolocation, 'getCurrentPosition'> | undefined, secure: boolean): Promise<Position> {
  if (!secure) return Promise.reject(new Error('Location needs HTTPS or localhost. Choose a starting building in From.'));
  if (!geolocation) return Promise.reject(new Error('This browser cannot provide location. Choose a starting building in From.'));
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(position => resolve(position.coords), error => reject(new Error(
      error.code === 1 ? 'Location permission is blocked. Allow location for this site and browser in macOS Location Services, or choose a building in From.'
        : error.code === 2 ? 'Your browser could not determine your location. Check macOS Location Services and Wi-Fi, or choose a building in From.'
          : 'Your browser did not return a location in time. Try again, or choose a starting building in From.'
    )), { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 });
  });
}
