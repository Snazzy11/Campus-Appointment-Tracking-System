import { useEffect, useId, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, Text, View, StyleSheet } from 'react-native';
import { api } from '../../services/api';
import { createDestinationSearch, emptyDestination } from './destinations';
import { SearchInput } from './SearchInput';
import { SuggestionList } from './SuggestionList';
import type { Routing } from './useRoutePlanner';
export function FromSelector({ routing }: { routing: Routing }) {
  const [state, setState] = useState(emptyDestination);
  const currentRouting = useRef(routing);
  useEffect(() => { currentRouting.current = routing; }, [routing]);
  const search = useRef<ReturnType<typeof createDestinationSearch> | null>(null);
  const listId = `from-${useId().replace(/:/g, '')}`;
  useEffect(() => {
    const controller = createDestinationSearch((path, signal) => api(path, null, { signal }), next => {
      setState(next);
      if (next.selected) currentRouting.current.origin({ kind: 'building', id: next.selected.id }, next.selected.properties.name || next.query);
    });
    search.current = controller;
    return () => { controller.stop(); search.current = null; };
  }, []);
  function change(value: string) { routing.origin(null); search.current?.change(value); }
  return <View style={s.root}>
    <Text style={s.label}>From</Text>
    <View style={s.row}>
      <SearchInput label="From — starting building" placeholder="Choose a starting building" value={state.query || routing.state.originLabel} onChange={change} onKey={key => { const handled = search.current?.key(key) ?? false; if (handled && key === 'Enter') Keyboard.dismiss(); return handled; }} expanded={state.results.length > 0} listId={listId} activeId={state.active >= 0 ? `${listId}-${state.active}` : undefined} />
      {state.query || routing.state.origin ? <Pressable accessibilityRole="button" accessibilityLabel="Clear starting point" style={s.clear} onPress={() => change('')}><Text style={s.cross}>×</Text></Pressable> : null}
    </View>
    {state.searchStatus === 'pending' || state.searchStatus === 'loading' || state.detailStatus === 'loading' ? <Text accessibilityLiveRegion="polite" style={s.hint}>Finding starting buildings…</Text> : null}
    {state.error ? <Text accessibilityRole="alert" style={s.hint}>{state.error} Edit the From field to retry.</Text> : null}
    {state.searchStatus === 'done' && !state.results.length ? <Text style={s.hint}>No starting buildings found. Try another name.</Text> : null}
    {state.hasMore ? <Text style={s.hint}>Keep typing to narrow the results.</Text> : null}
    {state.results.length ? <SuggestionList id={listId}>{state.results.map((item, index) => <Pressable key={item.id} nativeID={`${listId}-${index}`} role={Platform.OS === 'web' ? 'option' : 'button'} accessibilityLabel={`From: ${item.name}`} accessibilityState={{ selected: state.active === index }} style={[s.option, index === state.active && s.active]} onPress={() => { search.current?.select(item); Keyboard.dismiss(); }}><Text style={s.name}>{item.name}</Text>{item.street ? <Text style={s.hint}>{item.street}</Text> : null}</Pressable>)}</SuggestionList> : null}
    <Pressable accessibilityRole="button" disabled={routing.state.status === 'locating'} style={s.location} onPress={() => { search.current?.change(''); void routing.locate(); }}><Text style={s.locationText}>{routing.state.status === 'locating' ? 'Locating…' : 'Use my location'}</Text></Pressable>
  </View>;
}
const s = StyleSheet.create({ root: { gap: 6 }, row: { flexDirection: 'row', gap: 4 }, label: { fontSize: 13, fontWeight: '700', color: '#334155' }, clear: { width: 44, minHeight: 46, alignItems: 'center', justifyContent: 'center' }, cross: { fontSize: 26, color: '#475569' }, hint: { fontSize: 13, lineHeight: 18, color: '#526078' }, option: { minHeight: 48, padding: 10, justifyContent: 'center', borderRadius: 8, marginTop: 4, borderWidth: 1, borderColor: '#cbd5e1' }, active: { backgroundColor: '#eef2ff', borderColor: '#6366f1' }, name: { fontSize: 15, color: '#172033', fontWeight: '600' }, location: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 }, locationText: { fontSize: 13, fontWeight: '600', color: '#4338ca' } });
