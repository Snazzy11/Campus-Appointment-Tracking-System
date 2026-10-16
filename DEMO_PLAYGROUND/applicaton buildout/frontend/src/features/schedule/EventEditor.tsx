import { useState } from 'react';
import { Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { api, jsonBody } from '../../services/api';
import { CalendarEvent, EventPlace, Term, campusToday } from './calendar';
import { LocationPicker } from './LocationPicker';
import { Action, s } from './ui';

export function EventEditor({ token, term, event, date, close, saved }: { token: string; term?: Term; event?: CalendarEvent; date: string; close: () => void; saved: (id: number) => void }) {
  const [season, setSeason] = useState<Term['season']>('Fall');
  const [year, setYear] = useState(campusToday().slice(0, 4));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [title, setTitle] = useState(event?.title ?? '');
  const [day, setDay] = useState(event?.date ?? date);
  const format = (v: number) => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
  const [start, setStart] = useState(format(event?.start ?? 540));
  const [end, setEnd] = useState(format(event?.end ?? 600));
  const [location, setLocation] = useState(event?.location ?? '');
  const [place, setPlace] = useState<EventPlace | null>(event?.place ?? null);
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function minutes(value: string) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value) && value !== '24:00') throw new Error('Use 24-hour times such as 09:30 or 14:00.');
    const [h, m] = value.split(':').map(Number); return h * 60 + m;
  }
  async function save(remove = false) {
    setBusy(true); setError('');
    try {
      if (!term) {
        const result = await api<{ id: number }>('/api/schedule/terms', token, jsonBody({ season, year: Number(year), start_date: startDate, end_date: endDate }));
        saved(result.id);
      } else {
        if (remove && event) await api(`/api/schedule/events/${event.id}/remove`, token, jsonBody({ version: event.version }));
        else await api(event ? `/api/schedule/events/${event.id}` : `/api/schedule/terms/${term.id}/events`, token, jsonBody({ title, date: day, start: minutes(start), end: minutes(end), location, notes, place, ...(event ? { version: event.version } : {}) }));
        saved(term.id!);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Try again.'); }
    finally { setBusy(false); }
  }
  const field = (label: string, value: string, change: (v: string) => void, placeholder = '', multiline = false, maxLength = 200) => <View style={{ gap: 5 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={change} placeholder={placeholder} multiline={multiline} maxLength={maxLength} editable={!busy} /></View>;
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) close(); }}><View style={s.overlay}><View style={s.modal} accessibilityViewIsModal>
    <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.heading}>{!term ? 'Create a term' : event ? 'Edit event' : 'Add event'}</Text><Action label="Close" onPress={close} disabled={busy} /></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
      {!term ? <><Text style={s.text}>Set your university’s term dates. You can add events or import classes afterward.</Text><View style={s.row}>{(['Fall', 'Spring', 'Summer'] as const).map(v => <Action key={v} label={v} selected={v === season} disabled={busy} onPress={() => setSeason(v)} />)}</View>{field('Year', year, setYear, '2026')}{field('Term start date', startDate, setStartDate, 'YYYY-MM-DD')}{field('Term end date', endDate, setEndDate, 'YYYY-MM-DD')}</> : <>
        <Text style={s.text}>{term.season} {term.year} · Campus time (Eastern){'\n'}{term.start_date} – {term.end_date}</Text>
        {field('Event title', title, setTitle, 'Study group', false, 120)}{field('Event date', day, setDay, 'YYYY-MM-DD')}
        {field('Start time', start, setStart, 'HH:MM, 24-hour')}{field('End time', end, setEnd, 'HH:MM, 24-hour')}
        <LocationPicker place={place} change={setPlace} />{field('Location details (optional)', location, setLocation, 'Room, meeting link, or other details')}{field('Notes', notes, setNotes, 'Optional details', true, 2000)}
        <Text style={s.text}>This event occurs once. Select it on the calendar to edit or delete it.</Text>
      </>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {confirm && <Text style={s.error}>Delete this event from your schedule?</Text>}
      <View style={s.row}><Action label={busy ? 'Saving…' : !term ? 'Create term' : 'Save event'} primary disabled={busy} onPress={() => void save()} />{event && <Action label={confirm ? 'Confirm delete' : 'Delete event'} disabled={busy} onPress={() => { if (confirm) void save(true); else setConfirm(true); }} />}</View>
    </ScrollView>
  </View></View></Modal>;
}
