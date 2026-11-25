// Data for the Clubs tab and organization details.
// There is no backend endpoint for organizations yet; see clubService.ts.

// Each category has its own card color (see HeroCard and OrganizationRow).
export type OrganizationCategory = 'technology' | 'outdoors' | 'arts';

export type Meetup = {
  title: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM", 24-hour
  location: string;
  // Which Map destination the "Find the student union" button opens, e.g. "student-union".
  destinationId: string;
};

export type Organization = {
  id: string; // used in the URL: /organizations/computing-society
  initials: string; // e.g. "CS", shown in the colored badge
  name: string;
  category: OrganizationCategory;
  categoryLabel: string; // e.g. "Technology"
  shortDescription: string; // one line for the list, e.g. "Build, learn, connect."
  tagline: string;
  description: string;
  // null when no meetup is planned.
  nextMeetup: Meetup | null;
};
