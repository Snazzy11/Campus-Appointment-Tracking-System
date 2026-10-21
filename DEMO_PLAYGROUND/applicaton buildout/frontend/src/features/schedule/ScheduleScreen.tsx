import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Modal, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { addDays, campusToday, Course, dateLabel, Schedule, Term, weekStart } from './calendar';
import { Agenda } from './Agenda';
import { CalendarGrid } from './CalendarGrid';
import { CourseSummary, ImportSchedule } from './ImportSchedule';
import { router } from 'expo-router';
import { EventEditor } from './EventEditor';
import { buildingSearch, type CalendarEvent } from './calendar';
import { Action, s } from './ui';

const subscribeLayout = () => () => {};
export default function ScheduleScreen() {
  const { token } = useAuth();
  return <StudentSchedule key={token ?? 'guest'} token={token} />;
}
function StudentSchedule({ token }: { token: string | null }) {
  const { width } = useWindowDimensions();
  const layoutReady = useSyncExternalStore(subscribeLayout, () => true, () => false);
  const compact = layoutReady && width < 760;
  const [data, setData] = useState<Schedule | null>(null);
  const [today, setToday] = useState(campusToday);
  const [selected, setSelected] = useState<number | undefined>();
  const [date, setDate] = useState(campusToday);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [editor, setEditor] = useState<'term' | 'event' | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();
  const [importing, setImporting] = useState(false);
  const [newTerm, setNewTerm] = useState(false);
  const [detail, setDetail] = useState<Course | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(!!token);
  const load = useCallback(async () => {
    if (!token) return;
    try { const result = await api<Schedule>('/api/schedule', token); setData(result); setToday(result.today); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load your schedule.'); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => {
    if (!token) return;
    let active = true;
    void api<Schedule>('/api/schedule', token).then(result => {
      if (active) { setData(result); setToday(result.today); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load your schedule.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    const tick = () => setToday(campusToday());
    const timer = setInterval(tick, 30_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') { tick(); void load(); } });
    return () => { clearInterval(timer); listener.remove(); };
  }, [load]);
  const terms = (data?.terms ?? []).filter(t => t.end_date >= today);
  const term = terms.find(t => t.id === selected) ?? terms.find(t => t.start_date <= today) ?? terms[0];
  const focus = term ? date < term.start_date ? term.start_date : date > term.end_date ? term.end_date : date : date;
  const actualView = view;
  const Calendar = compact ? Agenda : CalendarGrid;
  const first = actualView === 'week' ? weekStart(focus) : focus;
  const days = Array.from({ length: actualView === 'week' ? 7 : 1 }, (_, i) => addDays(first, i));
  function choose(t: Term) { setSelected(t.id); setDetail(null); setDate(today < t.start_date ? t.start_date : today > t.end_date ? t.end_date : today); }
  async function remove() {
    if (!token || !detail?.id) return;
    setBusy(true); setError('');
    try { await api(`/api/schedule/courses/${detail.id}/remove`, token, { method: 'POST' }); setDetail(null); setConfirmRemove(false); setNotice('Class removed from this term.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove this class.'); }
    finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={[s.page, compact && { padding: 14 }]}>
    <View style={[s.row, { justifyContent: 'space-between' }]}><View style={{ gap: 5 }}>{!compact ? <Text style={s.label}>YOUR CAMPUS, ORGANIZED</Text> : null}<Text accessibilityRole="header" style={[s.title, compact && { fontSize: 24 }]}>Schedule</Text>{!compact ? <Text style={s.text}>A little clarity for a busy week.</Text> : null}</View>
      {token && <View style={s.row}><Action label="New term" disabled={loading || !!error} onPress={() => setEditor('term')} /><Action label="Add event" disabled={loading || !!error} onPress={() => { setEditingEvent(undefined); setEditor(term ? 'event' : 'term'); }} /><Action label="Import CSV" primary disabled={loading || !!error} onPress={() => { setNewTerm(!term); setImporting(true); }} /></View>}
    </View>
    {!!error && <View style={s.warning}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Action label="Try again" onPress={() => void load()} /></View>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={s.text}>{notice}</Text>}
    {!token && <View style={s.card}><Text style={s.heading}>Your classes, in one place</Text><Text style={s.text}>Sign in using the header to import classes and manage your events.</Text></View>}
    {loading && <Text style={s.text}>Loading your schedule…</Text>}
    {!!terms.length && <View style={s.row}>{terms.map(t => <Action key={t.id} label={`${t.season} ${t.year}`} selected={term?.id === t.id} onPress={() => choose(t)} />)}</View>}
    {!term && !loading && <Text style={s.text}>Your calendar is empty. Create a term to add events, or import your registration CSV.</Text>}
    <>
      <View style={[s.row, { justifyContent: 'space-between' }]}><View style={{ gap: 5 }}><Text style={s.heading}>{term ? `${term.season} ${term.year}` : "Your calendar"}</Text>{term && <Text style={s.text}>{dateLabel(term.start_date)} – {dateLabel(term.end_date)} · {term.courses.length} courses · {(term.events ?? []).length} events</Text>}</View><Text style={s.text}>Campus time · Eastern</Text></View>
      <View style={[s.row, { justifyContent: 'space-between' }]}><View style={s.row}><Action label="Previous" disabled={!!term && first <= term.start_date} onPress={() => setDate(addDays(focus, actualView === 'week' ? -7 : -1))} /><Action label="Today" disabled={!!term && (today < term.start_date || today > term.end_date)} onPress={() => setDate(today)} /><Action label="Next" disabled={!!term && days[days.length - 1] >= term.end_date} onPress={() => setDate(addDays(focus, actualView === 'week' ? 7 : 1))} /><Text style={s.heading}>{actualView === 'week' ? `${dateLabel(first)} – ${dateLabel(days[6])}` : dateLabel(focus, { weekday: 'long', month: 'short', day: 'numeric' })}</Text></View>
      {<View style={s.row}><Action label="Week" selected={view === 'week'} onPress={() => setView('week')} /><Action label="Day" selected={view === 'day'} onPress={() => setView('day')} /></View>}</View>
      <Calendar term={term ?? { season: 'Fall', year: Number(today.slice(0, 4)), start_date: '1900-01-01', end_date: '2100-12-31', courses: [] }} days={days} today={today} select={c => { if (c.event) { setEditingEvent(c.event); setEditor('event'); } else { setDetail(c); setConfirmRemove(false); } }} />
      {term && !!term.courses.filter(c => c.meetings.some(m => m.start === null)).length && <View style={s.card}><Text style={s.heading}>On your own time</Text><Text style={s.text}>Online asynchronous classes have no fixed calendar time.</Text>{term.courses.filter(c => c.meetings.some(m => m.start === null)).map(c => <Action key={c.section} label={`${c.course} · ${c.title}`} onPress={() => { setDetail(c); setConfirmRemove(false); }} />)}</View>}
      {term && <View style={s.card}><Text style={s.heading}>This term’s classes</Text><View style={s.row}>{term.courses.map(c => <Action key={c.section} label={`${c.course} · ${c.credits} credits`} onPress={() => { setDetail(c); setConfirmRemove(false); }} />)}</View><Text style={s.text}>Meetings follow imported dates and weekdays. University holidays and cancellations aren’t included in the CSV.</Text></View>}
      {term && !!term.events?.length && <View style={s.card}><Text style={s.heading}>Your events</Text>{[...term.events].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start).map(event => <Action key={event.id} label={`${dateLabel(event.date)} · ${event.title}`} onPress={() => { setEditingEvent(event); setEditor('event'); }} />)}</View>}
    </>
    {editor && token && (editor === 'term' || term) && <EventEditor token={token} term={editor === 'term' ? undefined : term} event={editor === 'event' ? editingEvent : undefined} date={focus} close={() => { setEditor(null); void load(); }} saved={id => { setEditor(null); setSelected(id); setNotice(editor === 'term' ? 'Term created. Add an event or import your classes.' : 'Event saved.'); void load(); }} />}
    {importing && token && <ImportSchedule token={token} term={newTerm ? undefined : term} close={() => setImporting(false)} saved={message => { setImporting(false); setNotice(message); void load(); }} />}
    {detail && term && term.courses.includes(detail) && <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) setDetail(null); }}><View style={s.overlay}><View style={s.modal} accessibilityViewIsModal><ScrollView contentContainerStyle={{ gap: 16 }}><CourseSummary course={detail} />
      {Array.from(new Set(detail.meetings.map(m => m.location))).map(location => { const search = buildingSearch(location); return search ? <View key={location} style={{ gap: 6 }}><Text style={s.text}>{location}</Text><Action label={`Get directions to ${search}`} onPress={() => { setDetail(null); router.push({ pathname: '/maps', params: { search, request: String(Date.now()) } }); }} /></View> : null; })}
      {confirmRemove && <Text style={s.error}>Remove {detail.course} and all of its meetings from this term?</Text>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <View style={s.row}><Action label="Close" disabled={busy} onPress={() => setDetail(null)} />{!!detail.id && <Action label={confirmRemove ? 'Confirm removal' : 'Remove class'} disabled={busy} onPress={() => { if (confirmRemove) void remove(); else setConfirmRemove(true); }} />}</View>
    </ScrollView></View></View></Modal>}
  </ScrollView>;
}
