import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError } from '../services/api';
import { createRecipientSearch, emptySearch } from '../services/recipient-search';
import type { Recipient } from '../types';

export function RecipientPicker({ token, opening, onChoose, onExpired, label = 'New direct message', actionLabel = 'Message', excludeIds = [] }: {
  label?: string; actionLabel?: string; excludeIds?: number[]; token: string; opening: boolean; onChoose: (recipient: Recipient) => Promise<boolean>; onExpired: () => void;
}) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState(emptySearch);
  const searchRef = useRef<ReturnType<typeof createRecipientSearch> | null>(null);
  useEffect(() => {
    const search = createRecipientSearch(
      (prefix, signal) => api<Recipient[]>(`/api/users/search?q=${encodeURIComponent(prefix)}`, token, { signal }),
      setState,
      failure => { if (failure instanceof ApiError && failure.status === 401) onExpired(); },
    );
    searchRef.current = search;
    return () => { search.stop(); searchRef.current = null; };
  }, [token, onExpired]);
  function change(value: string) { setQuery(value); searchRef.current?.change(value); }
  async function choose(recipient: Recipient) {
    if (opening || !searchRef.current?.snapshot().matches.some(item => item.id === recipient.id)) return;
    if (await onChoose(recipient)) change('');
  }
  const matches = state.matches.filter(item => !excludeIds.includes(item.id));
  return <View style={styles.container}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel="Recipient email" placeholder="Find a recipient by email" keyboardType="email-address"
      autoCapitalize="none" autoCorrect={false} maxLength={320} value={query} onChangeText={change} editable={!opening} style={styles.input} />
    {state.status === 'idle' ? <Text style={styles.hint}>Type at least 3 characters to find a recipient.</Text> : null}
    {state.status === 'pending' || state.status === 'loading' ? <View style={styles.row}><ActivityIndicator size="small" /><Text style={styles.hint}>Searching…</Text></View> : null}
    {state.status === 'error' ? <Text accessibilityRole="alert" style={styles.error}>{state.error}</Text> : null}
    {state.status === 'done' && matches.length === 0 ? <Text style={styles.hint}>No matching accounts. The recipient may need to sign in first.</Text> : null}
    {opening ? <Text style={styles.hint}>Opening conversation…</Text> : null}
    {matches.length > 0 ? <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
      {matches.map(recipient => <Pressable key={recipient.id} accessibilityRole="button" accessibilityLabel={`${actionLabel} ${recipient.email}`}
        disabled={opening} onPress={() => { void choose(recipient); }} style={[styles.result, opening && styles.disabled]}>
        <Text numberOfLines={1} style={styles.email}>{recipient.email}</Text><Text style={styles.action}>{actionLabel}</Text>
      </Pressable>)}
    </ScrollView> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 8 }, label: { fontWeight: '600', color: '#172033' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: 'white', padding: 12, borderRadius: 10, fontSize: 15 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' }, hint: { color: '#64748b', fontSize: 13 }, error: { color: '#991b1b', fontSize: 13 },
  results: { maxHeight: 200, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 48, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  email: { flex: 1, color: '#172033' }, action: { color: '#4f46e5', fontWeight: '600' }, disabled: { opacity: 0.5 },
});
