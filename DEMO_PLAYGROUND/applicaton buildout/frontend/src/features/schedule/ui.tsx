import { Pressable, StyleSheet, Text } from 'react-native';
export function Action({ label, onPress, primary = false, disabled = false, selected = false }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; selected?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} style={[s.button, (primary || selected) && s.primary, disabled && { opacity: 0.45 }]}><Text style={[s.buttonText, (primary || selected) && { color: '#fff' }]}>{label}</Text></Pressable>;
}
export const s = StyleSheet.create({
  page: { padding: 24, gap: 20, backgroundColor: '#f6f7fb', flexGrow: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  title: { color: '#172033', fontSize: 30, fontWeight: '700' },
  heading: { color: '#172033', fontSize: 19, fontWeight: '700' },
  text: { color: '#475569', fontSize: 14, lineHeight: 21 },
  label: { color: '#475569', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 20, gap: 12 },
  button: { minHeight: 44, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#dbe1eb', backgroundColor: '#fff', justifyContent: 'center' },
  primary: { backgroundColor: '#4338ca', borderColor: '#4338ca' },
  buttonText: { color: '#334155', fontSize: 14, fontWeight: '600' },
  input: { fontSize: 16, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, minHeight: 44, padding: 10, color: '#172033', backgroundColor: '#fff' },
  overlay: { flex: 1, backgroundColor: '#0f172a77', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modal: { width: '100%', maxWidth: 720, maxHeight: '94%', backgroundColor: '#f8fafc', borderRadius: 20, padding: 20, gap: 16 },
  warning: { backgroundColor: '#fffbeb', borderColor: '#fcd34d', borderWidth: 1, borderRadius: 10, padding: 12, gap: 6 },
  error: { color: '#b91c1c', fontSize: 14, lineHeight: 21 },
});
