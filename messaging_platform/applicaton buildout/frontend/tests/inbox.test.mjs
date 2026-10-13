import assert from 'node:assert/strict';
import test from 'node:test';
import { inboxRows, clearSentDraft, dayLabel, inboxTime } from '../src/services/inbox.ts';
const message = (id, text, date = '2026-10-13T12:00:00Z') => ({ id, text, created_at: date, user_id: 1, kind: 'user' });
const conversation = (id, last, type = 'direct') => ({ id, type, name: type === 'group' ? 'Study group' : null, members: [{ id: 1, email: 'me@test.edu' }, { id: 2, email: 'carter@test.edu', display_name: 'Carter' }], created_at: '2026-10-01T12:00:00Z', last_message: last });
test('inbox uses server previews before history is loaded and sorts private activity', () => {
  const rows = inboxRows([conversation(1, null), conversation(2, message(20, 'Latest')), conversation(3, message(10, 'Earlier', '2026-10-12T12:00:00Z'))], {}, [], {}, 1, 'all', '');
  assert.deepEqual(rows.map(row => row.id), [null, 2, 3, 1]);
  assert.equal(rows[1].preview, 'You: Latest');
});
test('older cached history does not replace a server preview, but live messages do', () => {
  const saved = [conversation(2, message(20, 'Server'))];
  assert.equal(inboxRows(saved, { 2: [message(10, 'Old')] }, [], {}, 1, 'direct', '')[0].preview, 'You: Server');
  assert.equal(inboxRows(saved, { 2: [message(21, 'Live')] }, [], {}, 1, 'direct', '')[0].preview, 'You: Live');
});
test('drafts stay isolated and a pending send cannot clear a newer edit', () => {
  const drafts = { public: 'Campus', 2: 'Sent', 3: 'Other' };
  assert.deepEqual(clearSentDraft(drafts, '2', 'Sent'), { public: 'Campus', 3: 'Other' });
  assert.equal(clearSentDraft(drafts, '2', 'Earlier'), drafts);
  const row = inboxRows([conversation(2, message(1, 'Message'))], {}, [], drafts, 1, 'direct', '')[0];
  assert.equal(row.preview, 'Sent'); assert.equal(row.draft, true);
});
test('search matches names and participant emails and composes with type filters', () => {
  const chats = [conversation(1, null), conversation(2, null, 'group')];
  assert.deepEqual(inboxRows(chats, {}, [], {}, 1, 'group', 'CARTER@')[0].id, 2);
  assert.equal(inboxRows(chats, {}, [], {}, 1, 'all', 'missing').length, 0);
  assert.equal(inboxRows(chats, {}, [], {}, 1, 'direct', 'carter').length, 1);
});
test('day labels use local calendar days including month boundaries', () => {
  const now = new Date(2026, 9, 1, 1);
  assert.equal(dayLabel(new Date(2026, 9, 1, 0).toISOString(), now), 'Today');
  assert.equal(dayLabel(new Date(2026, 8, 30, 23).toISOString(), now), 'Yesterday');
  assert.equal(inboxTime('invalid', now), '');
});
