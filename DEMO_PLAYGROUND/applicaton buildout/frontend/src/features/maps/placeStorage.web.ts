const KEY = 'campus-map-places-v1';
export async function loadPlaces() { return window.localStorage.getItem(KEY); }
export async function storePlaces(value: string) { window.localStorage.setItem(KEY, value); }
