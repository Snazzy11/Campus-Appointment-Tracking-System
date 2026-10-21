import { useEffect, useRef, useState } from 'react';
import { addPlace, emptyPlaces, readPlaces, type Place } from './places';
import { loadPlaces, storePlaces } from './placeStorage';
export function usePlaces() {
  const [places, setPlaces] = useState(emptyPlaces);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    void loadPlaces().then(raw => { if (active) setPlaces(readPlaces(raw)); }).catch(() => { if (active) setError('Device storage is unavailable. Places last only while this map is open.'); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    writes.current = writes.current.then(() => storePlaces(JSON.stringify(places))).catch(() => setError('Could not save places on this device.'));
  }, [places, ready]);
  return { ...places, ready, error,
    remember: (place: Place) => { if (ready) setPlaces(p => ({ ...p, recent: addPlace(p.recent, place) })); },
    toggle: (place: Place) => { if (ready) setPlaces(p => ({ ...p, saved: p.saved.some(x => x.id === place.id) ? p.saved.filter(x => x.id !== place.id) : addPlace(p.saved, place) })); },
    clear: () => { if (ready) setPlaces(emptyPlaces); },
  };
}
