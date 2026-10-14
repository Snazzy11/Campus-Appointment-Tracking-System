import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { api } from '../../services/api';
import { createDestinationSearch, emptyDestination } from '../maps/destinations';
import { CAMPUS_CENTER } from '../maps/config';
import { EventPlace } from './calendar';
import { PinPicker } from './PinPicker';
import { Action, s } from './ui';
export function LocationPicker({ place, change }: { place: EventPlace | null; change: (place: EventPlace | null) => void }) {
  const [search, setSearch] = useState(emptyDestination);
  const controller = useRef<ReturnType<typeof createDestinationSearch> | null>(null);
  useEffect(() => { const current = createDestinationSearch((path, signal) => api(path, null, { signal }), setSearch); controller.current = current; return () => current.stop(); }, []);
  return <View style={[s.card, { padding: 12 }]}><Text style={s.label}>MAP LOCATION · OPTIONAL</Text>
    <TextInput accessibilityLabel="Search event building" placeholder="Search campus buildings" style={s.input} value={search.query} maxLength={120} onChangeText={value => controller.current?.change(value)} />
    {search.searchStatus === 'loading' && <Text style={s.text}>Searching buildings…</Text>}
    {search.results.map(building => <Action key={building.id} label={building.name || building.matched_term || 'Unnamed building'} onPress={() => { change({ kind: 'building', id: building.id, label: building.name || 'Unnamed building' }); controller.current?.change(''); }} />)}
    {search.searchStatus === 'done' && !search.results.length && <Text style={s.text}>No building found. Try another name or place a pin.</Text>}
    {!!search.error && <Text style={s.error}>{search.error} You can save without a location.</Text>}
    <View style={s.row}><Action label="Place a pin" onPress={() => change({ kind: 'pin', longitude: CAMPUS_CENTER[0], latitude: CAMPUS_CENTER[1] })} />{place && <Action label="Remove location" onPress={() => change(null)} />}</View>
    {place?.kind === 'building' && <Text style={s.text}>Selected building: {place.label}</Text>}
    {place?.kind === 'pin' && <><Text style={s.text}>Tap the map or drag the pin to your event. Keep it within campus. No device location is requested.</Text><PinPicker point={[place.longitude, place.latitude]} onMove={point => change({ kind: 'pin', longitude: point[0], latitude: point[1] })} /></>}
    {!place && <Text style={s.text}>No location selected. You can leave this blank.</Text>}
  </View>;
}
