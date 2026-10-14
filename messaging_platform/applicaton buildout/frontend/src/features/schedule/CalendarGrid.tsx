import { Pressable, ScrollView, Text, View } from 'react-native';
import { Course, Term, clock, colors, dateLabel, layoutEvents, weekdays, weekday } from './calendar';
import { s } from './ui';
export function CalendarGrid({ term, days, today, select }: { term: Term; days: string[]; today: string; select: (c: Course) => void }) {
  const timed = [...term.courses.flatMap(c => c.meetings).filter(m => m.start !== null), ...(term.events ?? [])];
  const from = Math.min(8, ...timed.map(m => Math.floor(m.start! / 60)));
  const to = Math.max(18, ...timed.map(m => Math.ceil(m.end! / 60)));
  const hourHeight = 88;
  return <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' }}>
    <View style={{ flexDirection: 'row', paddingLeft: 58, borderBottomWidth: 1, borderColor: '#e2e8f0' }}>{days.map(day => <View key={day} style={{ flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: day === today ? '#eef2ff' : '#fff', opacity: day < term.start_date || day > term.end_date ? 0.4 : 1 }}><Text style={s.label}>{weekdays[weekday(day)]}</Text><Text style={{ fontSize: 22, fontWeight: '600', color: day === today ? '#4338ca' : '#172033', marginTop: 4 }}>{dateLabel(day, { day: 'numeric' })}</Text></View>)}</View>
    <ScrollView style={{ maxHeight: 650 }} nestedScrollEnabled contentContainerStyle={{ height: (to - from) * hourHeight }}>
      <View style={{ flexDirection: 'row', height: (to - from) * hourHeight }}>
        <View style={{ width: 58 }}>{Array.from({ length: to - from }, (_, i) => <Text key={i} style={{ position: 'absolute', top: i * hourHeight + 5, left: 6, fontSize: 10, color: '#64748b' }}>{clock((from + i) * 60).replace(':00', '')}</Text>)}</View>
        {days.map(day => <View key={day} style={{ flex: 1, borderLeftWidth: 1, borderColor: '#edf0f5', backgroundColor: day === today ? '#fafaff' : '#fff' }}>
          {Array.from({ length: to - from }, (_, i) => <View key={i} style={{ position: 'absolute', top: i * hourHeight, width: '100%', height: hourHeight, borderTopWidth: 1, borderColor: '#edf0f5' }} />)}
          {layoutEvents(term, day).map(e => <Pressable key={e.key} accessibilityRole="button" accessibilityLabel={`${e.course.course}, ${clock(e.meeting.start!)}, ${e.meeting.location}`} onPress={() => select(e.course)} style={{ position: 'absolute', top: (e.meeting.start! / 60 - from) * hourHeight + 1, height: Math.max(22, (e.meeting.end! - e.meeting.start!) / 60 * hourHeight - 2), left: `${e.lane / e.lanes * 100}%`, width: `${100 / e.lanes}%`, backgroundColor: colors[e.color % colors.length][0], borderLeftWidth: 3, borderLeftColor: colors[e.color % colors.length][1], borderRadius: 6, padding: 5, overflow: 'hidden' }}>
            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: colors[e.color % colors.length][1] }}>{e.course.course}</Text><Text numberOfLines={1} style={{ fontSize: 10, color: colors[e.color % colors.length][1], marginTop: 3 }}>{clock(e.meeting.start!)}–{clock(e.meeting.end!)}</Text><Text numberOfLines={2} style={{ fontSize: 11, color: colors[e.color % colors.length][1], marginTop: 4 }}>{e.meeting.location}</Text>
          </Pressable>)}
        </View>)}
      </View>
    </ScrollView>
  </View>;
}
