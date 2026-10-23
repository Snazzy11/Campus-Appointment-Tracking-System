import { getFromApi } from '@/shared/api';

import { Location } from './types';

// All backend calls for the locations feature live in this file.
export async function getLocations(): Promise<Location[]> {
  return await getFromApi('/locations');
}
