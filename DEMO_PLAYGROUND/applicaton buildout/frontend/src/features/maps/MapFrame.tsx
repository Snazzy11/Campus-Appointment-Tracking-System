import { Component, useState, useSyncExternalStore, type ReactNode, type PropsWithChildren } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MAP_MODES, type MapMode } from './config';
import type { MapStatus } from './controller';
const subscribeLayout = () => () => {};
const clientLayout = () => true;
const serverLayout = () => false;
export function MapFrame({ children, tools, defaultToolsOpen = false, status, mode, modes, onMode, onRetry }: PropsWithChildren<{ tools?: ReactNode; defaultToolsOpen?: boolean; status: MapStatus | 'unavailable'; mode: MapMode; modes: MapMode[]; onMode: (mode: MapMode) => void; onRetry?: () => void }>) {
  const [toolsOpen, setToolsOpen] = useState(defaultToolsOpen);
  const { width, height } = useWindowDimensions();
  const layoutReady = useSyncExternalStore(subscribeLayout, clientLayout, serverLayout);
  const compact = layoutReady && height < 450;
  const wide = layoutReady && (width >= 900 || (width >= 600 && compact));
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
    <View style={[styles.header, !wide && { paddingVertical: 6 }, compact && { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }]}><Text accessibilityRole="header" style={styles.title}>CMU campus map</Text>{wide && !compact ? <Text style={styles.caption}>Mount Pleasant, Michigan</Text> : null}
      <View style={styles.controls}>{(modes.length === 1 ? [] : MAP_MODES).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value} map`} accessibilityState={{ selected: value === mode, disabled: !modes.includes(value) }} disabled={!modes.includes(value)} onPress={() => onMode(value)} style={[styles.button, value === mode && styles.selected, !modes.includes(value) && { opacity: 0.5 }]}><Text style={styles.buttonText}>{value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}</View>
    </View>
    <View style={{ flex: 1, minHeight: 0, flexDirection: wide ? 'row' : 'column-reverse' }}>
    {tools ? <View style={wide ? { width: compact ? 290 : 340, minHeight: 0, borderRightWidth: 1, borderColor: '#e2e8f0' } : { maxHeight: '48%', minHeight: 0, flexShrink: 1, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#cbd5e1' }}>
      {!wide ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: toolsOpen }} onPress={() => setToolsOpen(!toolsOpen)} style={{ minHeight: 52, paddingHorizontal: 18, justifyContent: 'center' }}><Text style={{ fontSize: 16, fontWeight: '700', color: '#3730a3' }}>{toolsOpen ? '⌄  Hide search & directions' : '⌃  Search campus & get directions'}</Text></Pressable> : null}
      <View style={{ flexShrink: 1, minHeight: 0, display: wide || toolsOpen ? 'flex' : 'none' }}>{tools}</View>
    </View> : null}
    <View style={styles.map}>{children}
      {status !== 'ready' ? <View pointerEvents="box-none" style={styles.overlay}><View style={styles.notice}>
        {status === 'loading' ? <ActivityIndicator accessibilityLabel="Loading campus map" /> : null}
        <Text accessibilityRole={status === 'error' ? 'alert' : undefined} style={styles.noticeTitle}>{status === 'loading' ? 'Loading campus map…' : status === 'unavailable' ? 'Campus maps are not available yet' : 'The map could not load'}</Text>
        <Text style={styles.caption}>{status === 'unavailable' ? 'You can continue using messaging while campus maps are being prepared.' : status === 'error' ? 'Check your connection or try loading the map again.' : 'Preparing the map and its labels.'}</Text>
        {status === 'error' && onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}><Text style={styles.buttonText}>Try again</Text></Pressable> : null}
      </View></View> : null}
    </View>
    </View>
    <Text style={[styles.footer, !wide && { display: 'none' }]}>{compact ? 'Campus routes and accessibility information are not verified yet.' : 'Choose a building or entrance. Walking routes and accessibility are not verified yet.'}</Text>
  </KeyboardAvoidingView>;
}
export class MapBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <View style={styles.notice}><Text accessibilityRole="alert">Campus map rendering is unavailable on this device. Other app sections remain available.</Text></View> : this.props.children; }
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#f8fafc' }, header: { padding: 10, gap: 3, backgroundColor: 'white' }, title: { fontSize: 18, fontWeight: '700', color: '#172033' }, caption: { fontSize: 14, lineHeight: 20, color: '#475569' }, controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#e2e8f0' }, selected: { backgroundColor: '#e0e7ff' }, buttonText: { color: '#3730a3', fontWeight: '600' }, map: { flex: 1, minHeight: 100, position: 'relative', backgroundColor: '#e2e8f0' }, overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', padding: 16 }, notice: { padding: 20, maxWidth: 480, borderRadius: 16, backgroundColor: 'white', gap: 10 }, noticeTitle: { color: '#172033', fontSize: 17, fontWeight: '600' }, footer: { padding: 8, fontSize: 12, lineHeight: 17, color: '#475569' } });
