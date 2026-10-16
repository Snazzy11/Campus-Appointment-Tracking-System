import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { LoginButton } from '../components/LoginButton';
import { RecipientPicker } from '../components/RecipientPicker';
import { api, ApiError, jsonBody } from '../services/api';
import { subscribe } from '../services/stream';
import { AuthConfig, Conversation, Message, Recipient } from '../types';

function merge(previous: Message[], incoming: Message[]) {
  const byId = new Map(previous.map(message => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.id - b.id).slice(-500);
}

export function MessagingScreen() {
  const { token, user, loading, error: authError, expire, signOut, clearError } = useAuth();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [error, setError] = useState('');
  const [publicMessages, setPublicMessages] = useState<Message[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<number, Message[]>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [publicLive, setPublicLive] = useState(false);
  const [privateLive, setPrivateLive] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [refreshKey, setRefreshKey] = useState(0);
  const activeIdRef = useRef(activeId);
  const listRef = useRef<FlatList<Message>>(null);
  const sendLock = useRef(false);
  const createLock = useRef(false);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);

  const report = useCallback((failure: unknown) => {
    if (failure instanceof ApiError && failure.status === 401) {
      expire();
      return;
    }
    setError(failure instanceof Error ? failure.message : String(failure));
  }, [expire]);

  useEffect(() => {
    let active = true;
    api<AuthConfig>('/api/auth/config').then(value => { if (active) setConfig(value); })
      .catch(failure => { if (active) report(failure); });
    return () => { active = false; };
  }, [report, refreshKey]);

  useEffect(() => {
    if (!foreground) return;
    let active = true;
    const refresh = () => {
      api<Message[]>('/api/data').then(history => {
        if (active) setPublicMessages(previous => merge(previous, history));
      }).catch(failure => { if (active) report(failure); });
    };
    refresh();
    const stop = subscribe('/api/stream', null, {
      onOpen: () => { if (active) { setPublicLive(true); refresh(); } },
      onError: () => { if (active) setPublicLive(false); },
      onEvent: event => {
        if (!active || event.event !== 'message') return;
        try {
          const message: Message = JSON.parse(event.data);
          if (typeof message.id === 'number') setPublicMessages(previous => merge(previous, [message]));
        } catch { /* Ignore malformed frames; persisted history remains recoverable. */ }
      },
    });
    return () => { active = false; stop(); };
  }, [foreground, report, refreshKey]);

  useEffect(() => {
    if (!token || !foreground) return;
    let active = true;
    const refreshConversations = () => {
      api<Conversation[]>('/api/conversations', token).then(value => {
        if (active) setConversations(value);
      }).catch(failure => { if (active) report(failure); });
    };
    const refreshHistory = (id: number) => {
      api<Message[]>(`/api/conversations/${id}/messages`, token).then(value => {
        if (active) setPrivateMessages(previous => ({ ...previous, [id]: merge(previous[id] || [], value) }));
      }).catch(failure => { if (active) report(failure); });
    };
    refreshConversations();
    const stop = subscribe('/api/private/stream', token, {
      onOpen: () => {
        if (!active) return;
        setPrivateLive(true); refreshConversations();
        if (activeIdRef.current !== null) refreshHistory(activeIdRef.current);
      },
      onError: failure => {
        if (!active) return;
        setPrivateLive(false);
        if (failure instanceof ApiError && failure.status === 401) report(failure);
      },
      onEvent: event => {
        if (!active || event.event !== 'private_message') return;
        try {
          const message: Message = JSON.parse(event.data);
          const id = message.conversation_id;
          if (typeof id !== 'number' || typeof message.id !== 'number') return;
          setPrivateMessages(previous => ({ ...previous, [id]: merge(previous[id] || [], [message]) }));
          refreshConversations();
        } catch { /* Ignore malformed frames. */ }
      },
    });
    return () => { active = false; stop(); };
  }, [token, foreground, report, refreshKey]);

  useEffect(() => {
    if (activeId === null || !token || !foreground) return;
    let active = true;
    const id = activeId;
    api<Message[]>(`/api/conversations/${id}/messages`, token).then(history => {
      if (active) setPrivateMessages(previous => ({ ...previous, [id]: merge(previous[id] || [], history) }));
    }).catch(failure => { if (active) report(failure); })
      .finally(() => { if (active) setLoadingHistory(false); });
    return () => { active = false; };
  }, [activeId, token, foreground, report, refreshKey]);

  function select(id: number | null) {
    setActiveId(id); setText(''); setError(''); setLoadingHistory(id !== null);
  }
  async function createConversation(recipient: Recipient): Promise<boolean> {
    if (createLock.current || !token) return false;
    createLock.current = true; setCreating(true); setError('');
    try {
      const saved = await api<Conversation>('/api/conversations', token, jsonBody({ recipient_id: recipient.id }));
      setConversations(previous => [saved, ...previous.filter(item => item.id !== saved.id)]);
      select(saved.id);
      return true;
    } catch (failure) { report(failure); return false; }
    finally { createLock.current = false; setCreating(false); }
  }
  async function send() {
    const draft = text;
    const value = draft.trim();
    if (!value || sendLock.current) return;
    const id = activeId;
    if (id !== null && !token) return;
    sendLock.current = true; setSending(true); setError('');
    try {
      const path = id === null ? '/api/data' : `/api/conversations/${id}/messages`;
      const saved = await api<Message>(path, token, jsonBody({ text: value }));
      if (id === null) setPublicMessages(previous => merge(previous, [saved]));
      else setPrivateMessages(previous => ({ ...previous, [id]: merge(previous[id] || [], [saved]) }));
      if (activeIdRef.current === id) setText(previous => previous === draft ? '' : previous);
    } catch (failure) { report(failure); }
    finally { sendLock.current = false; setSending(false); }
  }

  const selected = conversations.find(item => item.id === activeId);
  const peer = selected?.members.find(member => member.id !== user?.id);
  const displayed = activeId === null ? publicMessages : privateMessages[activeId] || [];
  const connected = foreground && (activeId === null ? publicLive : privateLive);

  return <SafeAreaView style={styles.safe}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>Campus Messaging</Text>
        {loading ? <ActivityIndicator /> : user ? <View style={styles.row}>
          <Text numberOfLines={1} style={styles.account}>{user.email}</Text>
          <Pressable accessibilityRole="button" onPress={() => { void signOut().catch(report); }}><Text style={styles.link}>Logout</Text></Pressable>
        </View> : config ? <LoginButton config={config} onError={setError} /> : <Pressable accessibilityRole="button" onPress={() => setRefreshKey(value => value + 1)}><Text style={styles.link}>Retry connection</Text></Pressable>}
      </View>
      <View style={styles.choices}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceContent}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: activeId === null }} style={[styles.chip, activeId === null && styles.selected]} onPress={() => select(null)}><Text>Public chat</Text></Pressable>
          {user && conversations.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: activeId === item.id }} style={[styles.chip, activeId === item.id && styles.selected]} onPress={() => select(item.id)}>
            <Text numberOfLines={1}>{item.members.find(member => member.id !== user.id)?.email || `Chat ${item.id}`}</Text>
          </Pressable>)}
        </ScrollView>
        {user && token ? <RecipientPicker key={token} token={token} opening={creating} onChoose={createConversation} onExpired={expire} /> : null}
      </View>
      <View style={styles.chatHeader}>
        <Text style={styles.heading} numberOfLines={1}>{activeId === null ? 'Public chat' : peer?.email || 'Direct message'}</Text>
        <Text style={{ color: connected ? '#15803d' : '#64748b' }}>{connected ? '● Live' : foreground ? 'Connecting…' : 'Paused'}</Text>
        <Pressable accessibilityRole="button" onPress={() => { setPublicLive(false); setPrivateLive(false); setRefreshKey(value => value + 1); }}><Text style={styles.link}>Refresh</Text></Pressable>
      </View>
      {loadingHistory && <ActivityIndicator style={{ padding: 8 }} />}
      <FlatList ref={listRef} style={styles.flex} contentContainerStyle={styles.messages} data={displayed} keyExtractor={item => String(item.id)}
        keyboardShouldPersistTaps="handled" onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.empty}>{loadingHistory ? 'Loading history…' : 'No messages yet. Say hello!'}</Text>}
        renderItem={({ item }) => {
          const mine = user && (item.user_id === user.id || item.sender === user.email);
          return <View style={[styles.bubble, mine && styles.mine]}>
            <View style={styles.row}><Text style={[styles.sender, mine && styles.light]}>{mine ? 'You' : item.sender}</Text>
              <Text style={[styles.time, mine && styles.light]}>{new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text></View>
            <Text selectable style={[styles.messageText, mine && styles.light]}>{item.text}</Text>
          </View>;
        }} />
      {(error || authError) ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss error" style={styles.error}
          onPress={() => { setError(''); clearError(); }}>
          <Text style={{ color: '#991b1b' }}>{error || authError}</Text>
        </Pressable>
      ) : null}
      <View style={styles.composer}>
        <TextInput accessibilityLabel="Message" style={[styles.input, styles.flex]} value={text} onChangeText={setText} maxLength={5000} placeholder="Write a message…" editable={!sending} multiline />
        <Pressable accessibilityRole="button" disabled={sending || !text.trim()} onPress={() => { void send(); }} style={[styles.button, (sending || !text.trim()) && { opacity: 0.5 }]}><Text style={styles.buttonText}>{sending ? 'Sending…' : 'Send'}</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' }, flex: { flex: 1 },
  header: { padding: 16, gap: 12, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  title: { fontSize: 24, fontWeight: '700', color: '#172033' }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  account: { flex: 1, color: '#475569', fontSize: 13 }, link: { color: '#4f46e5', fontWeight: '600' },
  choices: { padding: 12, gap: 12, backgroundColor: 'white' }, choiceContent: { gap: 8 },
  chip: { borderRadius: 10, padding: 12, backgroundColor: '#f1f5f9', maxWidth: 240 }, selected: { backgroundColor: '#e0e7ff' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  heading: { flex: 1, fontSize: 16, fontWeight: '600' }, messages: { padding: 16, gap: 12 },
  empty: { textAlign: 'center', color: '#64748b', padding: 24 },
  bubble: { alignSelf: 'flex-start', maxWidth: '90%', borderRadius: 12, padding: 12, backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0', gap: 5 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#4f46e5', borderColor: '#4f46e5' }, sender: { flexShrink: 1, fontSize: 12, fontWeight: '600' },
  time: { fontSize: 11, color: '#64748b' }, messageText: { fontSize: 15, color: '#172033' }, light: { color: 'white' },
  composer: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, backgroundColor: 'white' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: 'white', padding: 12, borderRadius: 10, fontSize: 15, maxHeight: 120 },
  button: { backgroundColor: '#4f46e5', borderRadius: 10, padding: 12 }, buttonText: { color: 'white', fontWeight: '600' },
  error: { padding: 12, marginHorizontal: 12, borderRadius: 10, backgroundColor: '#fee2e2' },
});
