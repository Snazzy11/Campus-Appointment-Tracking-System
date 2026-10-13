import { StyleSheet, Text, View } from 'react-native';
import { Avatar, profileName } from './Avatar';
import { Message, PublicProfile } from '../types';
import { dayLabel } from '../services/inbox';

export function ChatMessage({ message, previous, mine, author }: { message: Message; previous?: Message; mine: boolean; author?: PublicProfile | null }) {
  const dayChanged = !previous || new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString();
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return <View style={{ gap: 12 }}>
    {dayChanged ? <View style={styles.date}><Text style={styles.dateText}>{dayLabel(message.created_at)}</Text></View> : null}
    {message.kind === 'system' ? <Text selectable style={styles.system}>{message.text}</Text> : <View style={[styles.messageRow, mine && { justifyContent: 'flex-end' }]}>
      {!mine ? <Avatar profile={author} fallback={message.sender} size={30} /> : null}
      <View style={styles.column}>
        {!mine ? <Text style={styles.name}>{profileName(author, message.sender)}</Text> : null}
        <View style={[styles.bubble, mine && styles.mine]}><Text selectable style={[styles.text, mine && { color: 'white' }]}>{message.text}</Text></View>
        <Text style={[styles.time, mine && { textAlign: 'right' }]}>{mine ? 'You · ' : ''}{time}</Text>
      </View>
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  date: { alignItems: 'center', paddingVertical: 12 }, dateText: { backgroundColor: '#e8edf4', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, color: '#475569', fontSize: 12, fontWeight: '600' },
  system: { alignSelf: 'center', maxWidth: '90%', textAlign: 'center', fontSize: 13, lineHeight: 20, color: '#64748b', paddingVertical: 8 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, column: { maxWidth: '82%', gap: 5 }, name: { color: '#475569', fontSize: 12, fontWeight: '600', paddingHorizontal: 4 },
  bubble: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white', borderRadius: 18, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  mine: { backgroundColor: '#4f46e5', borderColor: '#4f46e5', borderBottomLeftRadius: 18, borderBottomRightRadius: 4 }, text: { fontSize: 16, lineHeight: 24, color: '#172033' }, time: { color: '#64748b', fontSize: 11, paddingHorizontal: 4 },
});
