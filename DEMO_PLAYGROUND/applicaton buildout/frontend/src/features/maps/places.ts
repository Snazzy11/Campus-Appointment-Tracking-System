export type Place = { id: number; name: string };
export type Places = { recent: Place[]; saved: Place[] };
export const emptyPlaces: Places = { recent: [], saved: [] };
export function addPlace(items: Place[], place: Place): Place[] {
  return [{ id: place.id, name: place.name.slice(0, 40) }, ...items.filter(item => item.id !== place.id)].slice(0, 5);
}
export function readPlaces(raw: string | null): Places {
  try {
    const data = JSON.parse(raw || '{}');
    const list = (items: unknown): Place[] => Array.isArray(items) ? items.filter(item => item && Number.isSafeInteger(item.id) && item.id > 0 && typeof item.name === 'string').slice(0, 5).map(item => ({ id: item.id, name: item.name.slice(0, 40) })) : [];
    return { recent: list(data.recent), saved: list(data.saved) };
  } catch { return emptyPlaces; }
}
