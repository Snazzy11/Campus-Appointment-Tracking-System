// The shape of one location, as returned by GET /locations.
// Keep this in sync with LocationOut in back_end/cats/api/routers/locations/locations.py

export type RSO = {
  id: number;
  name: string;
  description: string;
  link: string;
  email: string;
  phone: string;
  location: string;
};
