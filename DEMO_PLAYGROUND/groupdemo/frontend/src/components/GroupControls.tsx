import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError, jsonBody } from '../services/api';
import type { Conversation, Recipient } from '../types';
import { RecipientPicker } from './RecipientPicker';

function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

export function GroupCreator({ token, onCreated, onExpired }: { token: string; onCreated: (group: Conversation) => void; onExpired: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [members, setMembers] = useState<Recipient[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function create() {
    if (lock.current || !name.trim()) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const saved = await api<Conversation>('/api/groups', token, jsonBody({ name: name.trim(), member_ids: members.map(member => member.id) }));
      onCreated(saved); setName(''); setMembers([]); setExpanded(false);
    } catch (failure) { if (failure instanceof ApiError && failure.status === 401) onExpired(); setError(failure instanceof Error ? failure.message : 'Could not create group.'); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!expanded) return <Button label="New group" onPress={() => setExpanded(true)} />;
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy) setExpanded(false); }}><SafeAreaView style={styles.overlay}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView style={styles.dialog} contentContainerStyle={styles.dialogContent} keyboardShouldPersistTaps="handled"><View style={styles.panel}>
    <Text style={styles.heading}>Create a group</Text>
    <TextInput accessibilityLabel="Group name" placeholder="Group name" value={name} onChangeText={setName} maxLength={80} editable={!busy} style={styles.input} />
    <Text style={styles.hint}>Every member can read all earlier messages. You will be the first owner.</Text>
    {members.map(member => <View key={member.id} style={styles.row}><Text style={styles.flex}>{member.email}</Text><Button label={`Remove ${member.email}`} disabled={busy} onPress={() => setMembers(previous => previous.filter(item => item.id !== member.id))} /></View>)}
    {members.length < 49 ? <RecipientPicker token={token} label="Add initial members" actionLabel="Add" excludeIds={members.map(member => member.id)} opening={busy}
      onExpired={onExpired} onChoose={async recipient => { setMembers(previous => previous.some(item => item.id === recipient.id) ? previous : [...previous, recipient]); return true; }} /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <View style={styles.row}><Button label={busy ? 'Creating…' : 'Create group'} disabled={busy || !name.trim()} onPress={() => { void create(); }} /><Button label="Cancel" disabled={busy} onPress={() => { setExpanded(false); setError(''); }} /></View>
  </View></ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}

export function GroupDetails({ conversation, userId, token, visible, onClose, onChanged, onLeft, onExpired }: {
  conversation: Conversation; userId: number; token: string; visible: boolean; onClose: () => void; onChanged: (group: Conversation) => void; onLeft: (id: number) => void; onExpired: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const owner = conversation.owner_ids.includes(userId);
  const lastOwner = owner && conversation.owner_ids.length === 1;
  async function action(path: string, payload: unknown = {}) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await api<Conversation | { left: true }>(`/api/groups/${conversation.id}/${path}`, token, jsonBody(payload));
      if ('left' in result) { onLeft(conversation.id); onClose(); }
      else onChanged(result);
      return true;
    } catch (failure) { if (failure instanceof ApiError && failure.status === 401) onExpired(); setError(failure instanceof Error ? failure.message : 'Could not update group.'); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.overlay}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.dialog} contentContainerStyle={styles.dialogContent} keyboardShouldPersistTaps="handled">
        <View style={styles.row}><Text style={[styles.heading, styles.flex]}>{conversation.name}</Text><Button label="Close group details" onPress={onClose} /></View>
        <Text style={styles.hint}>{conversation.members.length} members · {conversation.owner_ids.length} owners</Text>
        <Text style={styles.hint}>New members can read the entire group history.</Text>
        {owner ? <View style={styles.panel}>
          <TextInput accessibilityLabel="New group name" placeholder="New group name" value={name} maxLength={80} onChangeText={setName} editable={!busy} style={styles.input} />
          <Button label="Rename group" disabled={busy || !name.trim()} onPress={() => { void action('rename', { name: name.trim() }).then(ok => { if (ok) setName(''); }); }} />
          <RecipientPicker token={token} label="Add a member" actionLabel="Add" excludeIds={conversation.members.map(member => member.id)} opening={busy} onExpired={onExpired}
            onChoose={recipient => action('members', { user_id: recipient.id })} />
        </View> : null}
        {conversation.members.map(member => {
          const isOwner = conversation.owner_ids.includes(member.id);
          return <View key={member.id} style={styles.member}>
            <Text>{member.email}{member.id === userId ? ' (you)' : ''}{isOwner ? ' · Owner' : ''}</Text>
            {owner && member.id !== userId ? <View style={styles.row}>
              {!isOwner ? <Button label={`Promote ${member.email} to owner`} disabled={busy} onPress={() => { void action('promote', { user_id: member.id }); }} /> : null}
              <Button label={`Remove ${member.email}`} disabled={busy || (isOwner && conversation.owner_ids.length === 1)} onPress={() => { void action('remove-member', { user_id: member.id }); }} />
            </View> : null}
          </View>;
        })}
        {lastOwner ? <Text style={styles.hint}>Promote another member before leaving. A group must keep at least one owner.</Text> : null}
        <Button label="Leave group" disabled={busy || lastOwner} onPress={() => { void action('leave'); }} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  panel: { gap: 10, padding: 12, backgroundColor: '#f8fafc', borderRadius: 10 },
  heading: { fontSize: 18, fontWeight: '700', color: '#172033' }, hint: { fontSize: 13, color: '#64748b' },
  button: { backgroundColor: '#4f46e5', padding: 10, borderRadius: 8 }, buttonText: { color: 'white', fontWeight: '600', fontSize: 13 }, disabled: { opacity: 0.5 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, backgroundColor: 'white' }, error: { color: '#991b1b' },
  overlay: { flex: 1, backgroundColor: '#00000066', padding: 16 }, dialog: { flex: 1, backgroundColor: 'white', borderRadius: 16 }, dialogContent: { padding: 16, gap: 16 },
  member: { paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderColor: '#e2e8f0' },
});
