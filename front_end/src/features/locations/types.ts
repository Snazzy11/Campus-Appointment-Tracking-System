// The shape of one location, as returned by GET /locations.
// Keep this in sync with LocationOut in back_end/app/api/routers/locations/locations.py
export type Location = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};
