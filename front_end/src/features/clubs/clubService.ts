// FAKE DATA: this file returns three sample organizations until the backend has an
// organizations endpoint. Screens call these functions exactly as they will call the real ones,
// so only this file needs to change. See FRONTEND_TASKS.md.

import { simulateRequest } from '@/shared/fakeBackend';

import { Meetup, Organization } from './types';

// In the design, all three organizations share the same sample meetup.
const SAMPLE_MEETUP: Meetup = {
  title: 'An open table for big ideas',
  date: '2026-11-19',
  startTime: '18:00',
  location: 'Demo campus · Student union',
  destinationId: 'student-union',
};

const SAMPLE_ORGANIZATIONS: Organization[] = [
  {
    id: 'computing-society',
    initials: 'CS',
    name: 'Computing Society',
    category: 'technology',
    categoryLabel: 'Technology',
    shortDescription: 'Build, learn, connect.',
    tagline: 'Find your next “I made that.”',
    description:
      'Meet curious students, swap ideas, and build something together. Everyone is welcome, whether you are just starting or already creating.',
    nextMeetup: SAMPLE_MEETUP,
  },
  {
    id: 'outdoor-collective',
    initials: 'OC',
    name: 'Outdoor Collective',
    category: 'outdoors',
    categoryLabel: 'Outdoors',
    shortDescription: 'Take the scenic route.',
    tagline: 'Make room for the outdoors.',
    description:
      'Get outside with a welcoming community. Share walks, fresh air, and new perspectives. All experience levels are welcome.',
    nextMeetup: SAMPLE_MEETUP,
  },
  {
    id: 'creative-circle',
    initials: 'CC',
    name: 'Creative Circle',
    category: 'arts',
    categoryLabel: 'Arts',
    shortDescription: 'Make something together.',
    tagline: 'A little space to create.',
    description:
      'Share ideas, try a new medium, and create alongside other students. Bring your curiosity; you do not need to be an artist.',
    nextMeetup: SAMPLE_MEETUP,
  },
];

export async function getOrganizations(): Promise<Organization[]> {
  await simulateRequest();
  return SAMPLE_ORGANIZATIONS;
}

// Returns one organization, or null if there is none with that id.
export async function getOrganization(id: string): Promise<Organization | null> {
  await simulateRequest();
  return SAMPLE_ORGANIZATIONS.find((organization) => organization.id === id) ?? null;
}
