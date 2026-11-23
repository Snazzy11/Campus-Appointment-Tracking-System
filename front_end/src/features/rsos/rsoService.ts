import { getFromApi } from '@/shared/api';

import { RSO } from './types';

// All backend calls for the locations feature live in this file.
export async function getRSOs(): Promise<RSO[]> {
  return await getFromApi('/rsos');
}
