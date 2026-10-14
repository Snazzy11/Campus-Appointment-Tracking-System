import { LocationPanel } from './LocationPanel';
import { BlipPanel } from './BlipPanel';
import { FromSelector } from './FromSelector';
import { RoutePanel } from './RoutePanel';
import { usePlaces } from './usePlaces';
import { useEffect, useId } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { accessibilityLabel, entranceLabel } from './destinations';
import { SuggestionList } from './SuggestionList';
import { SearchInput } from './SearchInput';
import type { Destinations } from './useDestinations';
export function DestinationPanel({ destinations }: { destinations: Destinations }) {
  const { state, change, select, key, entrance } = destinations;
  const listId = `buildings-${useId().replace(/:/g, '')}`;
  const selected = state.selected;
  const places = usePlaces();
  const { remember } = places;
  useEffect(() => {
    if(selected && places.ready) remember({id:selected.id,name:selected.properties.name || 'Unnamed building'});
    // Record successful selections only, not renders or live report updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, places.ready]);
  const openPlace = (place: {id:number;name:string}) => select({...place, matched_term:place.name,match_kind:'name',street:null,house_number:null,longitude:0,latitude:0});
  const address = selected ? [selected.properties.tags['addr:housenumber'], selected.properties.tags['addr:street']].filter(Boolean).join(' ') : '';
  return <View style={styles.root}>
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.content}>
    <LocationPanel following={destinations.following} />
    {destinations.routing.state.directionsOpen ? <FromSelector routing={destinations.routing} /> : null}
    {!state.query && (places.saved.length || places.recent.length) ? <View style={styles.section}>
      {(['saved','recent'] as const).map(kind => places[kind].length ? <View key={kind}><Text style={styles.sectionTitle}>{kind==='saved'?'Saved places':'Recent destinations'}</Text>{places[kind].map(place=><Pressable key={place.id} accessibilityRole="button" style={styles.result} onPress={()=>openPlace(place)}><Text style={styles.name}>{place.name}</Text></Pressable>)}</View> : null)}
      <Text style={styles.muted}>Stored on this device; shared by accounts using this app here. Building details and routes still need a connection.</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={places.clear}><Text style={styles.buttonText}>Clear saved and recent places</Text></Pressable>
    </View> : null}
    {places.error ? <Text accessibilityRole="alert" style={styles.muted}>{places.error}</Text> : null}
    <Text style={styles.sectionTitle}>To</Text>
    <View style={styles.searchRow}><SearchInput label="To — destination building" placeholder="Choose a destination" value={state.query} onChange={change} onKey={value => { const handled = key(value); if (handled && value === 'Enter') Keyboard.dismiss(); return handled; }} expanded={state.results.length > 0} listId={listId} activeId={state.active >= 0 ? `${listId}-${state.active}` : undefined} />
      {state.query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear destination" onPress={() => change('')} style={styles.clear}><Text style={styles.clearText}>×</Text></Pressable> : null}
    </View>
      {state.searchStatus === 'idle' && state.detailStatus === 'idle' ? <Text style={styles.muted}>Type at least two characters, then select a destination.</Text> : null}
      {state.searchStatus === 'pending' || state.searchStatus === 'loading' || state.detailStatus === 'loading' ? <View style={styles.loading}><ActivityIndicator /><Text accessibilityLiveRegion="polite" style={styles.muted}>{state.detailStatus === 'loading' ? 'Loading building…' : 'Searching buildings…'}</Text></View> : null}
      {state.error ? <View style={styles.section}><Text accessibilityRole="alert" style={styles.muted}>{state.error}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={() => change(state.query)}><Text style={styles.buttonText}>Try again</Text></Pressable></View> : null}
      {state.searchStatus === 'done' ? <Text accessibilityLiveRegion="polite" style={styles.muted}>{state.results.length ? `${state.results.length}${state.hasMore ? '+' : ''} ${state.results.length === 1 && !state.hasMore ? 'building' : 'buildings'}${state.hasMore ? ' · keep typing to narrow results' : ''}` : 'No matching buildings. Try another name or abbreviation.'}</Text> : null}
      {state.results.length ? <SuggestionList id={listId}>{state.results.map((item, index) => <Pressable key={item.id} nativeID={`${listId}-${index}`} role={Platform.OS === 'web' ? 'option' : 'button'} accessibilityLabel={`${item.name}, ${[item.house_number, item.street].filter(Boolean).join(' ') || 'select to view location'}`} accessibilityState={{ selected: state.active === index }} onPress={() => { select(item); Keyboard.dismiss(); }} style={[styles.result, state.active === index && styles.active]}>
        <Text style={styles.name}>{item.name}</Text><Text style={styles.muted}>{[item.house_number, item.street].filter(Boolean).join(' ') || 'Select to view location'}{item.match_kind !== 'name' ? ` · ${item.matched_term}` : ''}</Text>
      </Pressable>)}</SuggestionList> : null}
      <RoutePanel routing={destinations.routing} selected={destinations.endpoint} selectedLabel={selected ? `${selected.properties.name || 'Unnamed building'}${state.entranceId ? ' · selected entrance' : ''}` : ''} />
      {selected ? <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.title}>{selected.properties.name || 'Unnamed building'}</Text>
        <Pressable accessibilityRole="button" disabled={!places.ready} style={styles.button} onPress={()=>places.toggle({id:selected.id,name:selected.properties.name || 'Unnamed building'})}><Text style={styles.buttonText}>{places.saved.some(p=>p.id===selected.id)?'Remove saved place':'Save place on this device'}</Text></Pressable>
        {address ? <Text style={styles.muted}>{address}</Text> : null}
        {selected.properties.aliases?.length ? <Text style={styles.muted}>Also known as {selected.properties.aliases.map(item => item.label).join(', ')}</Text> : null}
        <Text style={styles.muted}>{accessibilityLabel(selected)}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => entrance(null)}><Text style={styles.buttonText}>Show building on map</Text></Pressable>
        <Text style={styles.sectionTitle}>Entrances</Text>
        {!state.entrances.length ? <Text style={styles.muted}>No verified entrance is available here. Directions may end at an unverified mapped walkway approach.</Text> : state.entrances.map((item, index) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: state.entranceId === item.id }} onPress={() => { entrance(item.id); Keyboard.dismiss(); }} style={[styles.result, state.entranceId === item.id && styles.active]}><Text style={styles.name}>{entranceLabel(item, index)}</Text><Text style={styles.muted}>{item.properties.association_verified ? 'Building entrance verified' : 'Nearby mapped entrance · association unverified'}</Text><Text style={styles.muted}>{accessibilityLabel(item)}</Text></Pressable>)}
        {state.moreEntrances ? <Text style={styles.muted}>Only the first 500 mapped entrances are shown.</Text> : null}
        
        <Text style={styles.attribution}>Campus data © OpenStreetMap contributors · coverage may be incomplete.</Text>
      </View> : null}
    <BlipPanel destinations={destinations} />
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ root: { flexShrink: 1, minHeight: 0, backgroundColor: 'white' }, searchRow: { flexDirection: 'row', gap: 4 }, clear: { width: 44, minHeight: 46, alignItems: 'center', justifyContent: 'center' }, clearText: { fontSize: 28, color: '#475569' }, scroll: { flexShrink: 1 }, content: { padding: 12, gap: 10 }, muted: { fontSize: 13, lineHeight: 19, color: '#526078' }, loading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, result: { minHeight: 52, justifyContent: 'center', padding: 10, gap: 3, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 6 }, active: { backgroundColor: '#eef2ff', borderColor: '#6366f1' }, name: { color: '#172033', fontSize: 15, fontWeight: '600' }, title: { color: '#172033', fontSize: 20, fontWeight: '700' }, sectionTitle: { color: '#172033', fontSize: 14, fontWeight: '600' }, section: { gap: 9 }, button: { minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#eef2ff', borderRadius: 10, paddingHorizontal: 12 }, buttonText: { color: '#4338ca', fontWeight: '600' }, soon: { padding: 12, gap: 4, backgroundColor: '#f8fafc', borderRadius: 10 }, attribution: { color: '#64748b', fontSize: 11, lineHeight: 16 } });
