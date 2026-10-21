import { useState } from 'react';
import { Modal, Text, TextInput, View } from 'react-native';
import { Message } from '../../types';
import { api, jsonBody } from '../../services/api';
import { Action, s } from '../schedule/ui';
export function MessageActions({ message, token, onSaved, onClose }: { message: Message; token: string; onSaved: (message: Message) => void; onClose: () => void }) {
  const [text, setText] = useState(message.text), [busy, setBusy] = useState(false), [error, setError] = useState(''), [removing, setRemoving] = useState(false);
  async function save(remove = false) { setBusy(true); setError(''); try { onSaved(await api<Message>(`/api/chat/messages/${message.id}/${remove ? 'remove' : 'edit'}`, token, jsonBody({ version: message.version ?? 1, ...(remove ? {} : { text }) }))); onClose(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <Modal transparent visible onRequestClose={() => { if (!busy) onClose(); }}><View style={s.overlay}><View style={s.modal}>
    <Text style={s.heading}>{removing ? 'Delete this message?' : 'Edit your message'}</Text>
    {removing ? <Text style={s.text}>This removes its text and any shared schedule or invitation for everyone in the chat.</Text> : <TextInput accessibilityLabel="Edit message" style={s.input} value={text} onChangeText={setText} multiline maxLength={5000} />}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    <View style={s.row}><Action label={removing ? 'Delete for everyone' : 'Save changes'} primary disabled={busy || (!removing && !text.trim())} onPress={() => void save(removing)} />{!removing ? <Action label="Delete message" disabled={busy} onPress={() => setRemoving(true)} /> : null}<Action label="Cancel" disabled={busy} onPress={onClose} /></View>
  </View></View></Modal>;
}
