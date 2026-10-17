import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, weekStart, eventsOn, layoutEvents } from '../src/features/schedule/calendar.ts';
import { sampleTerm } from './fixtures/schedule.ts';
test('week and date arithmetic stay stable across DST and year boundaries', () => {
  assert.equal(addDays('2026-11-01', 1), '2026-11-02');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(weekStart('2026-10-13'), '2026-10-12');
});
test('sample lecture, lab, weekdays, asynchronous courses and bounds', () => {
  assert.equal(eventsOn(sampleTerm, '2026-10-14').length, 3);
  assert.equal(eventsOn(sampleTerm, '2026-10-13').length, 3);
  assert.equal(eventsOn(sampleTerm, '2026-10-17').length, 0);
  assert.equal(eventsOn(sampleTerm, '2026-12-21').length, 0);
  assert.equal(eventsOn(sampleTerm, '2026-08-30').length, 0);
  assert.equal(eventsOn(sampleTerm, '2026-10-26').some(e => e.course.course === 'ANT 174WI'), false);
});
test('overlapping meetings get separate columns, including chained overlaps', () => {
  const course = sampleTerm.courses[0];
  const term = { ...sampleTerm, courses: [600, 630, 660].map((start, i) => ({ ...course, section: String(i), meetings: [{ ...course.meetings[0], start, end: start + 50 }] })) };
  const events = layoutEvents(term, '2026-10-12');
  assert.deepEqual(events.map(e => e.lanes), [2, 2, 2]);
  assert.deepEqual(events.map(e => e.lane), [0, 1, 0]);
});

test('individual events appear once, within term, and alongside classes', () => {
  const event = { id: 1, version: 1, title: 'Study group', date: '2026-10-14', start: 900, end: 960, location: 'Pearce Hall', notes: '' };
  const term = { ...sampleTerm, events: [event] };
  assert.equal(eventsOn(term, '2026-10-14').filter(e => e.course.event).length, 1);
  assert.equal(eventsOn(term, '2026-10-21').filter(e => e.course.event).length, 0);
});

test('class directions remove the room but preserve building names', async () => {
  const { buildingSearch } = await import('../src/features/schedule/calendar.ts');
  assert.equal(buildingSearch('Pearce Hall 137'), 'Pearce Hall');
  assert.equal(buildingSearch('Biosciences Building 2016'), 'Biosciences Building');
  assert.equal(buildingSearch('Rose Center 102'), 'Rose Center');
  assert.equal(buildingSearch('Pearce Hall, Room 424'), 'Pearce Hall');
  assert.equal(buildingSearch('Pearce Hall'), 'Pearce Hall');
  assert.equal(buildingSearch('Online'), null);
  assert.equal(buildingSearch('TBA'), null);
});
