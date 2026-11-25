// FAKE DATA: this file pretends to be the backend until appointment endpoints exist
// (get an available appointment, confirm it, get the confirmed one). Screens call these
// functions exactly as they will call the real ones, so only this file needs to change.
// See FRONTEND_TASKS.md.

import { simulateRequest } from '@/shared/fakeBackend';

import { AppointmentOffer, ConfirmedAppointment } from './types';

const SAMPLE_OFFER: AppointmentOffer = {
  id: 'advising-2026-11-18-1000',
  advisorName: 'Prof. Taylor Morgan',
  serviceName: 'Academic support',
  durationMinutes: 30,
  format: 'Office hours · In person',
  date: '2026-11-18',
  startTime: '10:00',
  endTime: '10:30',
  reason: 'Academic advising',
  location: 'Demo campus · Advising center',
  isDemo: true,
};

// The booked appointment. It only lives in memory, so reloading the app forgets it.
let confirmedAppointment: ConfirmedAppointment | null = null;

// Returns the appointment the student can book, or null if none are available.
export async function getAppointmentOffer(): Promise<AppointmentOffer | null> {
  await simulateRequest();
  return SAMPLE_OFFER;
}

// Books the appointment and returns it.
export async function confirmAppointment(offerId: string): Promise<ConfirmedAppointment> {
  await simulateRequest();

  if (offerId !== SAMPLE_OFFER.id) {
    throw new Error('That appointment is no longer available.');
  }

  confirmedAppointment = {
    id: SAMPLE_OFFER.id,
    advisorName: SAMPLE_OFFER.advisorName,
    date: SAMPLE_OFFER.date,
    startTime: SAMPLE_OFFER.startTime,
    endTime: SAMPLE_OFFER.endTime,
    reason: SAMPLE_OFFER.reason,
    location: SAMPLE_OFFER.location,
    isDemo: SAMPLE_OFFER.isDemo,
  };
  return confirmedAppointment;
}

// Returns the booked appointment, or null if nothing is booked yet.
export async function getConfirmedAppointment(): Promise<ConfirmedAppointment | null> {
  await simulateRequest();
  return confirmedAppointment;
}

// Forgets the booked appointment. Called when the student signs out of the demo.
export async function clearDemoAppointment(): Promise<void> {
  await simulateRequest();
  confirmedAppointment = null;
}
