import { Pressable, Text, View } from 'react-native';
import { clock, colors, Course, dateLabel, eventsOn, Term } from './calendar';
import { s } from './ui';

/** Natural page scrolling avoids a second, tiny scrolling timeline on phones. */
export function Agenda({ term, days, today, select }: { term: Term; days: string[]; today: string; select: (course: Course) => void }) {
  return <View style={{ gap: 20 }}>{days.map(day => {
    const events = eventsOn(term, day);
    return <View key={day} style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={[s.heading, { fontSize: 17, color: day === today ? '#4338ca' : '#172033' }]}>{day === today ? 'Today · ' : ''}{dateLabel(day, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
      {events.length ? events.map(event => <Pressable key={event.key} accessibilityRole="button" accessibilityLabel={`${event.course.course}, ${clock(event.meeting.start!)}, ${event.meeting.location}`} onPress={() => select(event.course)} style={({ pressed }) => ({ backgroundColor: pressed ? '#eef2ff' : '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: colors[event.color % colors.length][1], borderRadius: 12, padding: 14, gap: 5, minHeight: 88 })}>
        <Text style={{ fontSize: 14, color: '#475569', fontWeight: '600' }}>{clock(event.meeting.start!)} – {clock(event.meeting.end!)}</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: '#172033' }}>{event.course.course}</Text>
        {event.course.title !== event.course.course ? <Text style={s.text}>{event.course.title}</Text> : null}
        {event.meeting.location ? <Text style={s.text}>{event.meeting.location}</Text> : null}
      </Pressable>) : <Text style={s.text}>{day < term.start_date || day > term.end_date ? 'Outside this term' : 'No scheduled classes or events'}</Text>}
    </View>;
  })}</View>;
}
