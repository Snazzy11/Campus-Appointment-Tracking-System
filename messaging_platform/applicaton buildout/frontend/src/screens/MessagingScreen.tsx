import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, BackHandler, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight, useIsFocused } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { LoginButton } from '../components/LoginButton';
import { RecipientPicker } from '../components/RecipientPicker';
import { Avatar } from '../components/Avatar';
import { GroupCreator, GroupDetails } from '../components/GroupControls';
import { api, ApiError, jsonBody } from '../services/api';
import { subscribe } from '../services/stream';
import { ConversationInbox } from '../components/ConversationInbox';
import { ChatMessage } from '../components/ChatMessage';
import { clearSentDraft, conversationName, draftKey, inboxRows, InboxFilter } from '../services/inbox';
import { AuthConfig, Conversation, Message, Recipient } from '../types';

function merge(previous: Message[], incoming: Message[], retainAll = false) {
  const byId = new Map(previous.map(message => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  const sorted = [...byId.values()].sort((a, b) => a.id - b.id);
  return retainAll ? sorted : sorted.slice(-500);
}

const subscribeLayout = () => () => {};
const clientLayout = () => true;
const serverLayout = () => false;

export function MessagingScreen() {
  const headerHeight = useHeaderHeight();
  const { token, user, loading, error: authError, expire, clearError } = useAuth();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [error, setError] = useState('');
  const [publicMessages, setPublicMessages] = useState<Message[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<number, Message[]>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [showChat, setShowChat] = useState(false);
  const [newDirect, setNewDirect] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [loadingInbox, setLoadingInbox] = useState(!!user);
  const width = useWindowDimensions().width;
  // Static web HTML and the first client render must choose the same layout.
  const layoutReady = useSyncExternalStore(subscribeLayout, clientLayout, serverLayout);
  const wide = layoutReady && width >= 840;
  const focused = useIsFocused();
  const text = drafts[draftKey(activeId)] || '';
  function setText(value: string) { setDrafts(previous => ({ ...previous, [draftKey(activeId)]: value })); }
  const [sending, setSending] = useState(false);
  const [manageGroup, setManageGroup] = useState(false);
  useEffect(() => {
    if (!focused || wide || !showChat || newDirect || manageGroup) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setShowChat(false); return true; });
    return () => subscription.remove();
  }, [focused, wide, showChat, newDirect, manageGroup]);

  const [historyCursor, setHistoryCursor] = useState<Record<number, number | null>>({});
  const [hasOlder, setHasOlder] = useState<Record<number, boolean>>({});
  const [loadingOlder, setLoadingOlder] = useState(false);
  const olderLock = useRef(false);
  const historyVersion = useRef<Record<number, number>>({});
  const allowedIds = useRef(new Set<number>());
  const conversationRequest = useRef(0);
  const [creating, setCreating] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [publicLive, setPublicLive] = useState(false);
  const [privateLive, setPrivateLive] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [refreshKey, setRefreshKey] = useState(0);
  const activeIdRef = useRef(activeId);
  const autoScroll = useRef(true);
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

  const select = useCallback((id: number | null) => {
    autoScroll.current = true;
    const changed = activeIdRef.current !== id;
    activeIdRef.current = id;
    Keyboard.dismiss();
    setShowChat(true);
    setActiveId(id); setError(''); setManageGroup(false);
    if (changed) setLoadingHistory(id !== null);
  }, []);
  const refreshHistory = useCallback((id: number, session: string) => {
    const version = (historyVersion.current[id] || 0) + 1;
    historyVersion.current[id] = version;
    return api<Message[]>(`/api/conversations/${id}/messages`, session).then(history => {
      if (!allowedIds.current.has(id) || historyVersion.current[id] !== version) return;
      setPrivateMessages(previous => ({ ...previous, [id]: merge(previous[id] || [], history, true) }));
      setHistoryCursor(previous => ({ ...previous, [id]: history[0]?.id ?? null }));
      setHasOlder(previous => ({ ...previous, [id]: history.length === 100 }));
    });
  }, []);
  function applyConversation(saved: Conversation) {
    ++conversationRequest.current;
    allowedIds.current.add(saved.id);
    setConversations(previous => [saved, ...previous.filter(item => item.id !== saved.id)]);
    if (token && activeIdRef.current === saved.id) void refreshHistory(saved.id, token).catch(report);
  }
  const removeConversation = useCallback((id: number) => {
    allowedIds.current.delete(id);
    historyVersion.current[id] = (historyVersion.current[id] || 0) + 1;
    setPrivateMessages(previous => { const next = { ...previous }; delete next[id]; return next; });
    setConversations(previous => previous.filter(item => item.id !== id));
    setDrafts(previous => { const next = { ...previous }; delete next[draftKey(id)]; return next; });
    if (activeIdRef.current === id) { select(null); setShowChat(false); }
  }, [select]);

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
      const version = ++conversationRequest.current;
      api<Conversation[]>('/api/conversations', token).then(value => {
        if (!active || version !== conversationRequest.current) return;
        allowedIds.current = new Set(value.map(item => item.id));
        setConversations(value);
        setDrafts(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => id === 'public' || allowedIds.current.has(Number(id)))));
        setPrivateMessages(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => allowedIds.current.has(Number(id)))));
        if (activeIdRef.current !== null && !allowedIds.current.has(activeIdRef.current)) select(null);
      }).catch(failure => { if (active) report(failure); }).finally(() => { if (active) setLoadingInbox(false); });
    };
    refreshConversations();
    const stop = subscribe('/api/private/stream', token, {
      onOpen: () => {
        if (!active) return;
        setPrivateLive(true); refreshConversations();
        if (activeIdRef.current !== null) void refreshHistory(activeIdRef.current, token).catch(report);
      },
      onError: failure => {
        if (!active) return;
        setPrivateLive(false);
        if (failure instanceof ApiError && failure.status === 401) report(failure);
      },
      onEvent: event => {
        if (!active) return;
        if (event.event === 'conversation_updated') {
          try {
            const update: { conversation_id: number; removed_user_ids?: number[] } = JSON.parse(event.data);
            if (update.removed_user_ids?.includes(user!.id)) removeConversation(update.conversation_id);
            else if (activeIdRef.current === update.conversation_id) void refreshHistory(update.conversation_id, token).catch(report);
            refreshConversations();
          } catch { /* Ignore malformed metadata frames. */ }
          return;
        }
        if (event.event !== 'private_message') return;
        try {
          const message: Message = JSON.parse(event.data);
          const id = message.conversation_id;
          if (typeof id !== 'number' || typeof message.id !== 'number') return;
          if (allowedIds.current.has(id)) setPrivateMessages(previous => ({ ...previous, [id]: merge(previous[id] || [], [message], true) }));
          refreshConversations();
        } catch { /* Ignore malformed frames. */ }
      },
    });
    return () => { active = false; stop(); };
  }, [token, foreground, report, refreshKey, select, refreshHistory, removeConversation, user]);

  useEffect(() => {
    if (activeId === null || !token || !foreground) return;
    let active = true;
    const id = activeId;
    refreshHistory(id, token).catch(failure => { if (active) report(failure); })
      .finally(() => { if (active) setLoadingHistory(false); });
    return () => { active = false; };
  }, [activeId, token, foreground, report, refreshKey, refreshHistory]);

  async function createConversation(recipient: Recipient): Promise<boolean> {
    if (createLock.current || !token) return false;
    createLock.current = true; setCreating(true); setError('');
    try {
      const saved = await api<Conversation>('/api/conversations', token, jsonBody({ recipient_id: recipient.id }));
      applyConversation(saved);
      select(saved.id);
      setNewDirect(false);
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
      else if (allowedIds.current.has(id)) setPrivateMessages(previous => ({ ...previous, [id]: merge(previous[id] || [], [saved], true) }));
      setDrafts(previous => clearSentDraft(previous, draftKey(id), draft));
    } catch (failure) { report(failure); }
    finally { sendLock.current = false; setSending(false); }
  }

  async function loadEarlier() {
    const id = activeId;
    if (id === null || !token || olderLock.current || !hasOlder[id] || historyCursor[id] === null) return;
    const version = historyVersion.current[id];
    olderLock.current = true; setLoadingOlder(true);
    try {
      const page = await api<Message[]>(`/api/conversations/${id}/messages?before_id=${historyCursor[id]}`, token);
      if (!allowedIds.current.has(id) || historyVersion.current[id] !== version) return;
      autoScroll.current = false;
      setPrivateMessages(previous => ({ ...previous, [id]: merge(previous[id] || [], page, true) }));
      setHistoryCursor(previous => ({ ...previous, [id]: page[0]?.id ?? null }));
      setHasOlder(previous => ({ ...previous, [id]: page.length === 100 }));
    } catch (failure) { report(failure); }
    finally { olderLock.current = false; setLoadingOlder(false); }
  }

  const selected = conversations.find(item => item.id === activeId);
  const peer = selected?.members.find(member => member.id !== user?.id);
  const displayed = activeId === null ? publicMessages : privateMessages[activeId] || [];
  const connected = foreground && (activeId === null ? publicLive : privateLive);
  const title = selected ? conversationName(selected, user?.id || 0) : 'Public chat';
  const rows = inboxRows(conversations, privateMessages, publicMessages, drafts, user?.id || 0, filter, query);
  function refresh() { setPublicLive(false); setPrivateLive(false); setRefreshKey(value => value + 1); }

  return <SafeAreaView edges={['left', 'right']} style={styles.safe}>
    <StatusBar style="dark" />
    {(error || authError) ? <View style={styles.error}>
      <Text accessibilityRole="alert" style={{ color: '#991b1b', flex: 1 }}>{error || authError}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss error" onPress={() => { setError(''); clearError(); }} style={styles.smallButton}><Text style={styles.link}>Dismiss</Text></Pressable>
    </View> : null}
    <View style={styles.layout}>
      {wide || !showChat ? <View style={[styles.inbox, wide && styles.wideInbox]}>
        <ConversationInbox rows={rows} activeId={activeId} showSelection={wide || showChat} query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} onSelect={select} loading={loadingInbox}
          actions={user && token ? <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => { setError(''); setNewDirect(true); }} style={styles.newButton}><Text style={styles.buttonText}>New message</Text></Pressable>
            <GroupCreator key={`group-${token}`} token={token} onExpired={expire} onCreated={saved => { applyConversation(saved); select(saved.id); }} />
          </View> : loading ? <ActivityIndicator /> : config ? <LoginButton config={config} onError={setError} /> : <Pressable accessibilityRole="button" onPress={refresh} style={styles.smallButton}><Text style={styles.link}>Retry connection</Text></Pressable>} />
        <View style={styles.inboxFooter}><Text style={styles.caption}>{user ? 'Private conversations stay between their members.' : 'Sign in to start direct messages and groups.'}</Text><Pressable accessibilityRole="button" onPress={refresh} style={styles.smallButton}><Text style={styles.link}>Refresh</Text></Pressable></View>
      </View> : null}
      {wide || showChat ? <KeyboardAvoidingView style={styles.chat} keyboardVerticalOffset={headerHeight} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.chatHeader}>
          {!wide ? <Pressable accessibilityRole="button" accessibilityLabel="Back to conversations" onPress={() => { Keyboard.dismiss(); setShowChat(false); }} style={styles.smallButton}><Text style={styles.link}>‹ Inbox</Text></Pressable> : null}
          {selected?.type === 'direct' ? <Avatar profile={peer} fallback={title} size={38} /> : null}
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text accessibilityRole="header" numberOfLines={1} style={styles.heading}>{title}</Text>
            <Text style={styles.caption}>{selected?.type === 'group' ? `${selected.members.length} members · ` : activeId === null ? 'Everyone on campus · ' : 'Private conversation · '}{connected ? 'Connected' : foreground ? 'Reconnecting…' : 'Paused'}</Text>
          </View>
          {selected?.type === 'group' ? <Pressable accessibilityRole="button" accessibilityLabel="Group members & settings" onPress={() => setManageGroup(true)} style={styles.smallButton}><Text style={styles.link}>Details</Text></Pressable> : null}
        </View>
        {loadingHistory ? <ActivityIndicator accessibilityLabel="Loading message history" style={{ padding: 8 }} /> : null}
        <FlatList key={draftKey(activeId)} ref={listRef} style={styles.flex} contentContainerStyle={styles.messages} data={displayed} keyExtractor={item => String(item.id)}
          keyboardShouldPersistTaps="handled" maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onContentSizeChange={() => { if (autoScroll.current) listRef.current?.scrollToEnd({ animated: false }); }}
          onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; autoScroll.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80; }} scrollEventThrottle={100}
          ListHeaderComponent={activeId !== null && hasOlder[activeId] ? <Pressable accessibilityRole="button" disabled={loadingOlder} onPress={() => { void loadEarlier(); }} style={styles.earlier}><Text style={styles.link}>{loadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}</Text></Pressable> : null}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>{loadingHistory ? 'Loading your conversation…' : 'Start the conversation'}</Text><Text style={styles.caption}>Say hello, share an update, or make a plan.</Text></View>}
          renderItem={({ item, index }) => <ChatMessage message={item} previous={displayed[index - 1]} mine={!!user && item.user_id === user.id}
            author={user && item.user_id === user.id ? user : selected?.members.find(member => member.id === item.user_id) || item.profile} />}
        />
        <View style={styles.composer}>
          <TextInput accessibilityLabel="Message" style={styles.input} value={text} onChangeText={setText} maxLength={5000} placeholder={`Message ${activeId === null ? 'public chat' : title}…`} multiline />
          <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={sending || !text.trim()} onPress={() => { void send(); }} style={[styles.sendButton, (sending || !text.trim()) && { opacity: 0.5 }]}><Text style={styles.buttonText}>{sending ? 'Sending…' : 'Send'}</Text></Pressable>
        </View>
      </KeyboardAvoidingView> : null}
    </View>
    {selected?.type === 'group' && user && token ? <GroupDetails key={selected.id} conversation={selected} userId={user.id} token={token} visible={manageGroup} onClose={() => setManageGroup(false)} onChanged={applyConversation} onLeft={removeConversation} onExpired={expire} /> : null}
    {user && token ? <Modal visible={newDirect} transparent animationType="slide" onRequestClose={() => { if (!creating) setNewDirect(false); }}>
      <SafeAreaView style={styles.overlay}><KeyboardAvoidingView style={styles.dialogWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.dialog} contentContainerStyle={{ padding: 24, gap: 20 }}>
          <View style={styles.actions}><Text accessibilityRole="header" style={[styles.heading, styles.flex]}>New message</Text><Pressable accessibilityRole="button" disabled={creating} onPress={() => setNewDirect(false)} style={styles.smallButton}><Text style={styles.link}>Cancel</Text></Pressable></View>
          <RecipientPicker key={token + String(newDirect)} token={token} opening={creating} onChoose={createConversation} onExpired={expire} />
          {error ? <Text accessibilityRole="alert" style={{ color: '#991b1b' }}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView></SafeAreaView>
    </Modal> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' }, flex: { flex: 1 }, layout: { flex: 1, flexDirection: 'row' },
  inbox: { flex: 1, backgroundColor: 'white' }, wideInbox: { flexGrow: 0, flexShrink: 0, flexBasis: 350, width: 350, borderRightWidth: 1, borderColor: '#e2e8f0' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, newButton: { paddingVertical: 12, paddingHorizontal: 16, minHeight: 44, borderRadius: 10, backgroundColor: '#4f46e5' },
  inboxFooter: { padding: 16, gap: 8, borderTopWidth: 1, borderColor: '#edf0f5' }, chat: { flex: 1, minWidth: 0, backgroundColor: '#f8fafc' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  heading: { color: '#172033', fontSize: 17, fontWeight: '700' }, caption: { color: '#64748b', fontSize: 12, lineHeight: 18 }, link: { color: '#4338ca', fontWeight: '600', fontSize: 14 },
  smallButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }, messages: { padding: 20, gap: 14, paddingBottom: 24, flexGrow: 1 },
  earlier: { alignSelf: 'center', padding: 14, backgroundColor: '#eef2ff', borderRadius: 20 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 8 }, emptyTitle: { color: '#172033', fontSize: 20, fontWeight: '600', textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 16, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#e2e8f0' },
  input: { flex: 1, minWidth: 0, maxHeight: 130, minHeight: 48, backgroundColor: '#f1f5f9', padding: 14, borderRadius: 18, fontSize: 16, color: '#172033' },
  sendButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 16, backgroundColor: '#4f46e5' }, buttonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fef2f2' },
  overlay: { flex: 1, backgroundColor: '#0f172a66', padding: 20 }, dialogWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' }, dialog: { backgroundColor: 'white', borderRadius: 24, width: '100%', maxWidth: 560, maxHeight: '90%' },
});
