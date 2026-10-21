import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Routing } from './useRoutePlanner';
import { distanceLabel, type RouteEndpoint } from './routing';
export function RoutePanel({ routing, selected }: { routing: Routing; selected: RouteEndpoint | null; selectedLabel: string }) {
  const { state } = routing;
  const busy = state.status === 'loading' || state.status === 'locating';
  return <View style={s.panel}>
    <Text accessibilityRole="header" style={s.title}>Walking directions</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !selected }} disabled={busy || !selected} style={[s.primary, (busy || !selected) && s.disabled]} onPress={() => { void routing.directions(); }}><Text style={s.primaryText}>{state.result ? 'Recalculate route' : 'Get directions'}</Text></Pressable>
    {busy ? <View style={s.row}><ActivityIndicator /><Text accessibilityLiveRegion="polite" style={s.text}>{state.status === 'locating' ? 'Finding your location…' : 'Finding a walking route…'}</Text><Pressable accessibilityRole="button" style={s.button} onPress={routing.clear}><Text style={s.buttonText}>Cancel</Text></Pressable></View> : null}
    {state.error ? <Text accessibilityRole="alert" style={s.error}>{state.error}</Text> : null}
    {state.result ? <View style={s.summary}>
      <Text accessibilityLiveRegion="polite" style={s.title}>{distanceLabel(state.result.properties.distance_m)} · {state.result.properties.duration_s ? `about ${Math.max(1, Math.round(state.result.properties.duration_s / 60))} min` : 'same path location'}</Text>
      <Text style={s.text}>Start at the green marker; finish at the purple marker.</Text>
      {state.result.properties.warnings.map(warning => <Text key={warning} style={s.text}>{warning}</Text>)}
      <Text style={s.title}>Path summary</Text>
      {state.result.properties.instructions.map((item, index) => <Text key={`${index}-${item.path_id}`} style={s.text}>{index + 1}. {item.text} · {distanceLabel(item.distance_m)}</Text>)}
      <Pressable accessibilityRole="button" style={s.button} onPress={routing.clear}><Text style={s.buttonText}>Clear route</Text></Pressable>
    </View> : null}
    <Text style={s.privacy}>Location is used only when requested, kept in memory, and sent to our route service when you get directions.</Text>
  </View>;
}
const s = StyleSheet.create({ panel: { gap: 9, padding: 12, borderRadius: 12, backgroundColor: '#f1f5f9' }, title: { fontSize: 15, fontWeight: '700', color: '#172033' }, text: { fontSize: 13, lineHeight: 19, color: '#475569' }, row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }, button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1' }, buttonText: { fontSize: 13, color: '#4338ca', fontWeight: '600' }, primary: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#4338ca' }, primaryText: { color: 'white', fontWeight: '600' }, disabled: { opacity: 0.5 }, error: { color: '#991b1b', fontSize: 13, lineHeight: 19 }, summary: { gap: 9 }, privacy: { fontSize: 11, lineHeight: 16, color: '#64748b' } });
