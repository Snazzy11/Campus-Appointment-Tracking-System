import { apiGet } from '@/api/client';

// Mirrors LocationOut in back_end/app/api/routers/locations/locations.py
export type Location = {
  id: number;
  name: string;
  longitude: number;
  latitude: number;
};

export function getLocations() {
  return apiGet<Location[]>('/locations');
}
