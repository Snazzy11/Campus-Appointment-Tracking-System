import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api, jsonBody } from '../../services/api';
import { Course, Review, Term, campusToday, meetingLabel } from './calendar';
import { Action, s } from './ui';

export function CourseSummary({ course }: { course: Course }) {
  return <View style={{ gap: 5 }}><Text style={s.heading}>{course.course} · {course.title}</Text><Text style={s.text}>{course.credits} credits · {course.instructor} · Section {course.section}</Text>{course.meetings.map((m, i) => <Text key={i} style={s.text}>{meetingLabel(m)}{'\n'}{m.start_date} – {m.end_date}</Text>)}</View>;
}
export function ImportSchedule({ token, term, close, saved }: { token: string; term?: Term; close: () => void; saved: (message: string) => void }) {
  const [season, setSeason] = useState<Term['season']>(term?.season ?? 'Fall');
  const [year, setYear] = useState(String(term?.year ?? Number(campusToday().slice(0, 4))));
  const [start, setStart] = useState(term?.start_date ?? '');
  const [end, setEnd] = useState(term?.end_date ?? '');
  const [csv, setCsv] = useState('');
  const [filename, setFilename] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const payload = { term: { season, year: Number(year), start_date: start, end_date: end }, csv };
  async function pick() {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true, base64: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.name.toLowerCase().endsWith('.csv')) throw new Error('Choose a .csv file exported from your registration schedule.');
      if (asset.size && asset.size > 500_000) throw new Error('Choose a CSV smaller than 500 KB.');
      let content: string;
      if (Platform.OS === 'web' && asset.file) content = await asset.file.text();
      else {
        const { File } = await import('expo-file-system');
        const file = new File(asset.uri);
        try { if (file.size > 500_000) throw new Error('Choose a CSV smaller than 500 KB.'); content = await file.text(); }
        finally { if (file.exists) file.delete(); }
      }
      if (content.length > 500_000) throw new Error('Choose a CSV smaller than 500 KB.');
      setCsv(content); setFilename(asset.name); setReview(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read the CSV.'); }
  }
  async function preview() {
    setBusy(true); setError('');
    try {
      const result = await api<Review>('/api/schedule/preview', token, jsonBody(payload));
      setReview(result); setChosen(result.courses.filter(c => c.status === 'new').map(c => c.section));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not review this CSV.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!review) return;
    setBusy(true); setError('');
    try {
      const result = await api<{ added: number; updated: number }>('/api/schedule/import', token, jsonBody({ ...payload, sections: chosen, version: review.version }));
      saved(`${result.added} added${result.updated ? ` · ${result.updated} updated` : ''}. Your other classes are unchanged.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Import failed. Your schedule was not saved.'); }
    finally { setBusy(false); }
  }
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) close(); }}><View style={s.overlay}><View style={s.modal} accessibilityViewIsModal>
    <View style={[s.row, { justifyContent: 'space-between' }]}><Text accessibilityRole="header" style={s.heading}>{review ? 'Review your classes' : 'Import a class schedule'}</Text><Action label="Close" onPress={close} disabled={busy} /></View>
    <ScrollView contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
      {!review ? <>
        <Text style={s.text}>Add classes to {term ? `${term.season} ${term.year}` : 'a new term'}. Existing classes stay in place. You’ll review everything before saving.</Text>
        <View style={s.card}><Text style={s.label}>TERM</Text><View style={s.row}>{(['Fall', 'Spring', 'Summer'] as const).map(value => <Action key={value} label={value} selected={season === value} disabled={!!term} onPress={() => setSeason(value)} />)}</View>
          <Text style={s.label}>YEAR</Text><TextInput accessibilityLabel="Term year" editable={!term} style={s.input} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />
          <Text style={s.label}>TERM START · YYYY-MM-DD</Text><TextInput accessibilityLabel="Term start date" editable={!term} style={s.input} value={start} onChangeText={setStart} placeholder="2026-08-31" />
          <Text style={s.label}>TERM END · YYYY-MM-DD</Text><TextInput accessibilityLabel="Term end date" editable={!term} style={s.input} value={end} onChangeText={setEnd} placeholder="2026-12-18" />
          <Text style={s.text}>Use your university’s term dates. The schedule is hidden after the end date, in campus time (America/Detroit).</Text>
        </View>
        <Action label={filename || 'Choose CSV file'} onPress={() => void pick()} disabled={busy} />
        <Text style={s.text}>Headers: Section, Course, Title, Credits, Days, Time, Dates, Location, Delivery, Instructor. Lecture/lab continuation rows with blank course details are supported. Quote cells containing commas.</Text>
        <Action label={busy ? 'Reading schedule…' : 'Review import'} primary disabled={busy || !csv || !start || !end} onPress={() => void preview()} />
      </> : <>
        <Text style={s.text}>{season} {year} · {filename}{'\n'}New classes are selected. Identical classes are skipped. Select a changed class only if you want to replace its saved details.</Text>
        {!!review.issues.length && <View style={s.warning}><Text style={s.heading}>Some rows need correction</Text>{review.issues.map((issue, i) => <Text key={i} style={s.text}>{issue.row ? `Row ${issue.row}: ` : ''}{issue.message}</Text>)}<Text style={s.text}>These sections won’t be saved. You can import the valid selections now, or go back and choose a corrected file.</Text></View>}
        {review.courses.map(course => <View key={course.section} style={s.card}>
          <Pressable accessibilityRole="checkbox" accessibilityLabel={`Import ${course.course} section ${course.section}`} accessibilityState={{ checked: chosen.includes(course.section), disabled: course.status === 'duplicate' }} disabled={course.status === 'duplicate' || busy} onPress={() => setChosen(old => old.includes(course.section) ? old.filter(s => s !== course.section) : [...old, course.section])} style={[s.row, { minHeight: 44 }]}><Text style={s.heading}>{chosen.includes(course.section) ? '☑' : '☐'}</Text><Text style={s.label}>{course.status === 'duplicate' ? 'ALREADY IMPORTED · SKIPPED' : course.status === 'changed' ? 'CHANGED · REPLACES THIS SECTION' : 'NEW CLASS'}</Text></Pressable>
          <CourseSummary course={course} />
          {course.previous && <View style={s.warning}><Text style={s.label}>CURRENTLY SAVED</Text><CourseSummary course={course.previous} /></View>}
        </View>)}
        {!review.courses.length && <Text style={s.text}>No valid classes found. Correct the rows above and review again.</Text>}
        <View style={s.row}><Action label="Back to file and term" disabled={busy} onPress={() => setReview(null)} /><Action label={busy ? 'Saving…' : `Save ${chosen.length} selected classes`} primary disabled={busy || !chosen.length} onPress={() => void save()} /></View>
      </>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    </ScrollView>
  </View></View></Modal>;
}
