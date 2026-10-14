import type { ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from './Avatar';
import { AppIcon } from './AppIcon';
import { InboxFilter, InboxRow, inboxTime } from '../services/inbox';

export function ConversationInbox({ rows, activeId, showSelection, query, onQuery, filter, onFilter, onSelect, actions, loading }: {
  rows: InboxRow[]; activeId: number | null; showSelection: boolean; query: string; onQuery: (value: string) => void;
  filter: InboxFilter; onFilter: (value: InboxFilter) => void; onSelect: (id: number | null) => void; actions: ReactNode; loading: boolean;
}) {
  return <View style={styles.root}>
    <View style={styles.top}>
      <Text accessibilityRole="header" style={styles.title}>Your conversations</Text>
      <Text style={styles.subtitle}>Keep up with your campus community.</Text>
      {actions}
      <TextInput accessibilityLabel="Search conversations" value={query} onChangeText={onQuery} placeholder="Search conversations" autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" style={styles.search} />
      <View accessibilityRole="tablist" style={styles.filters}>
        {(['all', 'direct', 'group'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: filter === value }} onPress={() => onFilter(value)} style={[styles.filter, filter === value && styles.chosenFilter]}>
          <Text style={[styles.filterText, filter === value && styles.chosenText]}>{value === 'all' ? 'All' : value === 'direct' ? 'Direct' : 'Groups'}</Text>
        </Pressable>)}
      </View>
    </View>
    {loading ? <ActivityIndicator accessibilityLabel="Loading conversations" style={{ padding: 12 }} /> : null}
    <FlatList data={rows} keyExtractor={row => row.id === null ? 'public' : String(row.id)} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 10, gap: 4 }}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No conversations found</Text><Text style={styles.subtitle}>Try a different search or start a new conversation.</Text></View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} accessibilityState={{ selected: showSelection && item.id === activeId }} onPress={() => onSelect(item.id)} style={({ pressed }) => [styles.row, showSelection && item.id === activeId && styles.selected, pressed && { opacity: 0.7 }]}>
        {item.kind === 'direct' ? <Avatar profile={item.profile} fallback={item.title} size={46} /> : <View style={[styles.icon, item.kind === 'public' && { backgroundColor: '#dcfce7' }]}><AppIcon name={item.kind === 'group' ? 'rso' : 'messaging'} color={item.kind === 'public' ? '#166534' : '#4f46e5'} /></View>}
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <View style={styles.nameRow}><Text numberOfLines={1} style={styles.name}>{item.title}</Text><Text style={styles.time}>{inboxTime(item.timestamp)}</Text></View>
          <Text numberOfLines={2} style={styles.preview}>{item.draft ? <Text style={styles.draft}>Draft: </Text> : null}{item.preview}</Text>
          {item.kind !== 'direct' ? <Text style={styles.kind}>{item.kind === 'group' ? 'GROUP' : 'CAMPUS'}</Text> : null}
        </View>
      </Pressable>}
    />
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'white' }, top: { padding: 20, paddingBottom: 12, gap: 14, borderBottomWidth: 1, borderColor: '#edf0f5' },
  title: { color: '#172033', fontSize: 22, fontWeight: '700' }, subtitle: { color: '#64748b', fontSize: 14, lineHeight: 21 },
  search: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 13, fontSize: 16, color: '#172033' }, filters: { flexDirection: 'row', gap: 8 },
  filter: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22, minHeight: 44 }, chosenFilter: { backgroundColor: '#e0e7ff' }, filterText: { color: '#64748b', fontWeight: '600' }, chosenText: { color: '#3730a3' },
  row: { padding: 14, gap: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 16, minHeight: 92 }, selected: { backgroundColor: '#eef2ff' },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 }, name: { flex: 1, color: '#172033', fontWeight: '600', fontSize: 16 }, time: { color: '#64748b', fontSize: 12 },
  preview: { color: '#64748b', fontSize: 14, lineHeight: 20 }, draft: { color: '#9a3412', fontWeight: '600' }, kind: { color: '#64748b', fontSize: 10, letterSpacing: 1, fontWeight: '600' },
  icon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' }, empty: { padding: 24, gap: 8 }, emptyTitle: { fontSize: 17, color: '#172033', fontWeight: '600' },
});
