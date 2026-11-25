// The shape of one location, as returned by GET /locations.
// Keep this in sync with LocationOut in back_end/cats/api/routers/locations/locations.py
export type Location = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};

// A place the student saved, shown on the Saved places screen.
export type SavedPlace = {
  // Matches a destination on the Map tab, e.g. "library" or "student-union".
  destinationId: string;
  // Short name from the design, e.g. "Library".
  name: string;
  // e.g. "Study spaces · Quiet corners"
  description: string;
  // The real building from GET /locations, e.g. "CMU Park Library".
  location: Location;
};
