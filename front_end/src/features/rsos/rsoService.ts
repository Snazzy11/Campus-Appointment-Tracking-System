import { getFromApi } from '@/shared/api';

import { RSO } from './types';

// All backend calls for the RSOs are in this function.
export async function getRSOs(): Promise<RSO[]> {
  return await getFromApi('/rsos');
}
