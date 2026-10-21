import type { Conversation, Message, PublicProfile } from '../types';

export type InboxFilter = 'all' | 'direct' | 'group';
export type InboxRow = { id: number | null; title: string; kind: 'public' | 'direct' | 'group'; profile?: PublicProfile; preview: string; timestamp: string; draft: boolean; search: string };
export function draftKey(id: number | null) { return id === null ? 'public' : String(id); }
export function clearSentDraft(drafts: Record<string, string>, key: string, sent: string) {
  // A response for an earlier send must not erase a newer edit or another chat's draft.
  if (drafts[key] !== sent) return drafts;
  const next = { ...drafts }; delete next[key]; return next;
}
export function conversationName(conversation: Conversation, userId: number) {
  if (conversation.type === 'group') return conversation.name || 'Group chat';
  const peer = conversation.members.find(member => member.id !== userId);
  return peer?.display_name || peer?.username || peer?.email || 'Direct message';
}
function newest(saved: Message | null | undefined, cached: Message[] = []) {
  const latest = cached[cached.length - 1];
  return latest && (!saved || latest.id >= saved.id) ? latest : saved;
}
function preview(message: Message | null | undefined, userId: number) {
  if (!message) return 'Start a conversation';
  const prefix = message.kind !== 'system' && message.user_id === userId ? 'You: ' : '';
  return prefix + message.text.replace(/\s+/g, ' ').slice(0, 160);
}
export function inboxRows(conversations: Conversation[], cached: Record<number, Message[]>, publicMessages: Message[], drafts: Record<string, string>, userId: number, filter: InboxFilter, query: string): InboxRow[] {
  const publicLast = publicMessages[publicMessages.length - 1];
  const rows: InboxRow[] = [{ id: null, title: 'Public chat', kind: 'public', preview: drafts.public || (publicLast ? preview(publicLast, userId) : 'A conversation for everyone on campus'), timestamp: publicLast?.created_at || '', draft: !!drafts.public, search: 'public chat campus' }];
  const privateRows = conversations.map(conversation => {
    const last = newest(conversation.last_message, cached[conversation.id]);
    const title = conversationName(conversation, userId);
    const draft = drafts[draftKey(conversation.id)];
    return { id: conversation.id, title, kind: conversation.type === 'group' ? 'group' as const : 'direct' as const,
      profile: conversation.type === 'group' ? undefined : conversation.members.find(member => member.id !== userId),
      preview: draft || preview(last, userId), timestamp: last?.created_at || conversation.created_at, draft: !!draft,
      search: [title, ...conversation.members.flatMap(member => [member.email, member.username || '', member.display_name || ''])].join(' ').toLowerCase(),
    };
  }).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) || b.id - a.id);
  rows.push(...privateRows);
  const search = query.trim().toLowerCase();
  return rows.filter(row => (filter === 'all' || row.kind === filter) && (!search || row.search.includes(search)));
}
export function inboxTime(value: string, now = new Date()) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toDateString() === now.toDateString() ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export function dayLabel(value: string, now = new Date()) {
  const date = new Date(value);
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}
