// FAKE DATA: this file returns sample data until the backend has an endpoint for the Home
// summary. Screens call getHomeSummary() exactly as they will call the real one, so only this
// file needs to change. See FRONTEND_TASKS.md.

import { simulateRequest } from '@/shared/fakeBackend';

import { HomeSummary } from './types';

export async function getHomeSummary(): Promise<HomeSummary> {
  await simulateRequest();

  return {
    // The demo is set in the week of November 16, 2026, to match the sample schedule.
    today: '2026-11-17',
    heroTitle: 'A good day to get connected.',
  };
}
