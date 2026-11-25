import { getFromApi } from '@/shared/api';

import { Location, SavedPlace } from './types';

// All backend calls for the locations feature live in this file.

// Real data: every named campus building, from GET /locations.
export async function getLocations(): Promise<Location[]> {
  return await getFromApi('/locations');
}

// Which buildings the student has saved.
// FAKE DATA: the backend can't save places yet, so this list is fixed. The buildings themselves
// are real: they are looked up in GET /locations by name. Once there is a saved-places endpoint,
// replace this list with a call to it. See FRONTEND_TASKS.md.
const SAMPLE_SAVED_PLACES = [
  {
    destinationId: 'library',
    name: 'Library',
    description: 'Study spaces · Quiet corners',
    buildingName: 'CMU Park Library',
  },
  {
    destinationId: 'student-union',
    name: 'Student union',
    description: 'Meetups · Community spaces',
    buildingName: 'Bovee University Center',
  },
];

// Returns the saved places whose building exists in the backend's locations.
export async function getSavedPlaces(): Promise<SavedPlace[]> {
  const locations = await getLocations();

  const savedPlaces: SavedPlace[] = [];
  for (const place of SAMPLE_SAVED_PLACES) {
    const location = locations.find((item) => item.name === place.buildingName);
    // Skip a saved building the database doesn't have (e.g. the import hasn't been run).
    if (location) {
      savedPlaces.push({
        destinationId: place.destinationId,
        name: place.name,
        description: place.description,
        location,
      });
    }
  }
  return savedPlaces;
}
