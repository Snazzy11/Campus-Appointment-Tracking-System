import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { api, jsonBody } from '../../services/api';
import { Message, Conversation } from '../../types';
import { Action, s } from '../schedule/ui';
import { Schedule, addDays, campusToday, clock, weekStart } from '../schedule/calendar';

type Scope = 'day' | 'week' | 'term';
type Slot = { date: string; start: number; end: number; title?: string; location?: string };
export type ChatAttachment = { type: 'schedule' | 'availability'; scope: Scope; start_date: string; end_date: string; timezone: string; entries?: Slot[] };
function Slots({ slots }: { slots: Slot[] }) {
  const [day, setDay] = useState('');
  const dates = [...new Set(slots.map(slot => slot.date))];
  const selected = dates.includes(day) ? day : dates[0];
  return <View style={{ gap: 8 }}>
    <ScrollView horizontal><View style={s.row}>{dates.map(date => <Action key={date} label={date} selected={date === selected} onPress={() => setDay(date)} />)}</View></ScrollView>
    {slots.filter(slot => slot.date === selected).map((slot, i) => <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: '#4f46e5', padding: 8, backgroundColor: '#eef2ff' }}><Text style={s.text}>{clock(slot.start)}–{clock(slot.end)}{slot.title ? ` · ${slot.title}` : ' · Free together'}</Text>{slot.location ? <Text style={s.text}>{slot.location}</Text> : null}</View>)}
    {!slots.length ? <Text style={s.text}>No time blocks in this range.</Text> : null}
  </View>;
}

export function ChatTools({ token, conversationId, onSaved }: { token: string; conversationId: number; onSaved: (message: Message) => void }) {
  const [open, setOpen] = useState(false), [kind, setKind] = useState<'schedule' | 'availability' | null>(null);
  const [scope, setScope] = useState<Scope>('week'), [date, setDate] = useState(campusToday());
  const [schedule, setSchedule] = useState<Schedule | null>(null), [termId, setTermId] = useState<number | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { let active = true; api<Schedule>('/api/schedule', token).then(value => { if (active) { setSchedule(value); setTermId(value.terms[0]?.id ?? null); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; } }, [open, token]);
  async function send() {
    setBusy(true); setError('');
    try { const value = await api<Message>(`/api/chat/${conversationId}/cards`, token, jsonBody({ kind, scope, date, term_id: termId })); onSaved(value); setOpen(false); setKind(null); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <><Action label="＋" onPress={() => { setOpen(true); setKind(null); setError(''); }} />
    <Modal visible={open} transparent onRequestClose={() => { if (!busy) setOpen(false); }}><View style={s.overlay}><View style={s.modal}><ScrollView contentContainerStyle={{ gap: 16 }}>
      <Text style={s.heading}>Add to chat</Text>
      <View style={s.row}><Action label="Share schedule" selected={kind === 'schedule'} onPress={() => setKind('schedule')} /><Action label="Find time together" selected={kind === 'availability'} onPress={() => setKind('availability')} /></View>
      {kind ? <><Text style={s.text}>{kind === 'schedule' ? 'Share a snapshot of class/event titles, times, and locations with this chat. Notes are excluded. Current and future members can view it. Delete the message to remove the snapshot.' : 'Invite members to opt in. Only common free time is returned, never class names or locations. Participants can withdraw. Availability is based on saved schedules, not a guarantee.'}</Text>
        <View style={s.row}>{(['day', 'week', 'term'] as Scope[]).map(value => <Action key={value} label={value} selected={scope === value} onPress={() => setScope(value)} />)}</View>
        {scope === 'term' ? <View style={s.row}>{schedule?.terms.map(term => <Action key={term.id} label={`${term.season} ${term.year}`} selected={termId === term.id} onPress={() => setTermId(term.id!)} />)}{!schedule?.terms.length ? <Text style={s.text}>Add a schedule term first.</Text> : null}</View> : <><Text style={s.label}>{scope === 'week' ? 'Any date in the target week (YYYY-MM-DD)' : 'Date (YYYY-MM-DD)'}</Text><TextInput accessibilityLabel="Schedule date" style={s.input} value={date} onChangeText={setDate} /></>}
        <Action label={busy ? 'Sending…' : kind === 'schedule' ? 'Share with this chat' : 'Send opt-in invitation'} primary disabled={busy || (scope === 'term' && !termId)} onPress={() => void send()} /></> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}<Action label="Cancel" disabled={busy} onPress={() => setOpen(false)} />
    </ScrollView></View></View></Modal></>;
}

export function ChatCard({ message, token, userId, conversation }: { message: Message; token: string; userId: number; conversation: Conversation }) {
  const a = message.attachment!;
  const [expanded, setExpanded] = useState(false), [ids, setIds] = useState<number[]>([]), [chosen, setChosen] = useState<number[]>([]);
  const [scope, setScope] = useState<Scope>('week'), [date, setDate] = useState(a.start_date);
  const membershipKey = conversation.members.map(member => member.id).join(',');
  const [resultMembership, setResultMembership] = useState('');
  const [resultVersion, setResultVersion] = useState<number | undefined>(undefined);
  const [slots, setSlots] = useState<Slot[] | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [first, setFirst] = useState('08:00'), [last, setLast] = useState('22:00');
  useEffect(() => {
    if (a.type !== 'availability' || !expanded) return;
    let active = true;
    api<{ user_ids: number[] }>(`/api/chat/cards/${message.id}/participants`, token).then(value => { if (active) { setIds(value.user_ids); setChosen(old => old.filter(id => value.user_ids.includes(id))); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [a.type, expanded, message.id, message.version, token, membershipKey]);
  async function consent(participate: boolean) {
    setBusy(true); setError(''); setSlots(null);
    try { const value = await api<{ user_ids: number[] }>(`/api/chat/cards/${message.id}/consent`, token, jsonBody({ participate })); setIds(value.user_ids); setChosen(value.user_ids); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function match() {
    setBusy(true); setError(''); setSlots(null);
    try {
      let start = scope === 'term' ? a.start_date : scope === 'week' ? weekStart(date) : date;
      let end = scope === 'term' ? a.end_date : scope === 'week' ? addDays(start, 6) : date;
      start = start < a.start_date ? a.start_date : start; end = end > a.end_date ? a.end_date : end;
      const minutes = (value: string) => { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Use HH:MM for hours, for example 08:00.'); const [h, m] = value.split(':').map(Number); return h * 60 + m; };
      const result = await api<{ windows: Slot[] }>(`/api/chat/cards/${message.id}/availability`, token, jsonBody({ user_ids: chosen, start_date: start, end_date: end, first: minutes(first), last: minutes(last) }));
      setResultMembership(membershipKey); setResultVersion(message.version); setSlots(result.windows);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <View style={[s.card, { marginVertical: 8 }]}>
    <Text style={s.heading}>{a.type === 'schedule' ? 'Shared schedule' : 'Find time together'}</Text>
    <Text style={s.text}>{a.start_date} – {a.end_date} · Campus time</Text>
    <Action label={expanded ? 'Collapse' : a.type === 'schedule' ? 'View schedule' : 'View / opt in'} onPress={() => setExpanded(!expanded)} />
    {expanded && a.type === 'schedule' ? <Slots slots={a.entries ?? []} /> : null}
    {expanded && a.type === 'availability' ? <>
      <Text style={s.text}>Opt in to let participating chat members compare your free time within this range. Class details stay private. Withdraw anytime. Results use saved schedules and may omit unrecorded commitments.</Text>
      <Action label={ids.includes(userId) ? 'Withdraw participation' : 'Opt in'} disabled={busy} onPress={() => void consent(!ids.includes(userId))} />
      {ids.includes(userId) ? <><Text style={s.label}>Select at least two participants</Text><View style={s.row}>{conversation.members.filter(member => ids.includes(member.id)).map(member => <Action key={member.id} label={member.display_name || member.username || member.email} selected={chosen.includes(member.id)} disabled={busy} onPress={() => { setSlots(null); setChosen(chosen.includes(member.id) ? chosen.filter(id => id !== member.id) : [...chosen, member.id]); }} />)}</View>
        <View style={s.row}>{(['day', 'week', 'term'] as Scope[]).map(value => <Action key={value} label={value === 'term' ? 'Entire invitation' : value} selected={scope === value} disabled={busy} onPress={() => { setScope(value); setSlots(null); }} />)}</View>
        {scope !== 'term' ? <TextInput editable={!busy} accessibilityLabel="Availability date (YYYY-MM-DD)" style={s.input} value={date} onChangeText={value => { setDate(value); setSlots(null); }} /> : null}
        <Text style={s.label}>Daily hours (24-hour campus time)</Text><View style={s.row}><TextInput editable={!busy} accessibilityLabel="Earliest time" style={s.input} value={first} onChangeText={value => { setFirst(value); setSlots(null); }} /><Text>to</Text><TextInput editable={!busy} accessibilityLabel="Latest time" style={s.input} value={last} onChangeText={value => { setLast(value); setSlots(null); }} /></View>
        <Action label={busy ? 'Finding times…' : 'Find common free time'} primary disabled={busy || chosen.length < 2} onPress={() => void match()} />
        {slots && resultVersion === message.version && resultMembership === membershipKey ? <><Text style={s.text}>Common free windows of at least 30 minutes. Your selection is private; other participants can explore this same card.</Text><Slots slots={slots} /></> : null}
      </> : <Text style={s.text}>{ids.length} opted in</Text>}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    </> : null}
  </View>;
}
