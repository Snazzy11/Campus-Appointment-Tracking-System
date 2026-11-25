// FAKE DATA: this file returns a sample week until the backend has a schedule endpoint
// (the schedule router in back_end/cats/api/routers/schedule/ has no endpoints yet).
// Screens call getScheduleWeek() exactly as they will call the real one, so only this file
// needs to change. See FRONTEND_TASKS.md.

import { getConfirmedAppointment } from '@/features/booking/bookingService';
import { simulateRequest } from '@/shared/fakeBackend';

import { ScheduleEvent, ScheduleWeek } from './types';

const WEEK_START = '2026-11-16';
const DEFAULT_SELECTED_DATE = '2026-11-18';

// A sample week: CPS 340 on Monday, Wednesday and Friday, study blocks on the other weekdays,
// and nothing on the weekend (so the "nothing scheduled" state can be seen).
const SAMPLE_EVENTS: ScheduleEvent[] = [
  classEvent('2026-11-16'),
  studyEvent('2026-11-17'),
  classEvent('2026-11-18'),
  studyEvent('2026-11-18'),
  studyEvent('2026-11-19'),
  classEvent('2026-11-20'),
];

function classEvent(date: string): ScheduleEvent {
  return {
    id: `cps340-${date}`,
    type: 'class',
    title: 'CPS 340',
    date,
    startTime: '08:30',
    endTime: '09:45',
    location: 'Science building',
    detail: 'Sample class',
  };
}

function studyEvent(date: string): ScheduleEvent {
  return {
    id: `study-${date}`,
    type: 'study',
    title: 'A little focus time',
    date,
    startTime: '12:00',
    endTime: '13:00',
    location: 'Library',
    detail: 'Sample study block',
  };
}

export async function getScheduleWeek(): Promise<ScheduleWeek> {
  await simulateRequest();

  const events = [...SAMPLE_EVENTS];

  // A real backend would include booked appointments itself. Here we ask the (also fake)
  // booking service: if an appointment is booked, show it; if not, show a suggestion to book one.
  const appointment = await getConfirmedAppointment();
  if (appointment) {
    events.push({
      id: appointment.id,
      type: 'advising',
      title: appointment.reason,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      location: 'Advising center',
      detail: appointment.advisorName,
    });
  } else {
    events.push({
      id: 'advising-suggestion',
      type: 'suggestion',
      title: 'Book time for your next step',
      date: DEFAULT_SELECTED_DATE,
      startTime: '10:00',
      endTime: '10:30',
      location: '',
      detail: '',
    });
  }

  // Sort by date, then by start time. "HH:MM" strings sort correctly as text.
  events.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  return {
    weekStartDate: WEEK_START,
    defaultSelectedDate: DEFAULT_SELECTED_DATE,
    events,
  };
}
