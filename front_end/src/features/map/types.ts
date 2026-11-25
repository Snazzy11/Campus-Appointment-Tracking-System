// Data for the illustrative campus map on the Map tab.
// There is no backend endpoint for this yet; see mapService.ts.
//
// All positions and sizes are PERCENTAGES of the map's width or height (0 to 100), so the map
// scales to any screen. Example: { left: 50, top: 0 } is the middle of the top edge.

export type MapRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type MapPoint = {
  x: number;
  y: number;
};

export type MapBuilding = {
  id: string;
  label: string;
  // 'park' is drawn green (the Quad), 'building' is drawn tan.
  kind: 'building' | 'park';
  rect: MapRect;
};

// The parts of the map that never change: buildings and roads.
export type CampusMap = {
  buildings: MapBuilding[];
  roads: MapRect[];
};

// A sample walking route to one destination.
export type MapRoute = {
  destinationId: string; // e.g. "library"
  destinationName: string; // e.g. "Library"
  marker: string; // the letter in the maroon circle, e.g. "L"
  markerPosition: MapPoint;
  summaryTitle: string; // e.g. "A quiet place to focus."
  summarySubtitle: string; // e.g. "Library · Sample walking route"
  instructions: string;
  // The route line, from the green starting dot to the destination. Each step must be straight
  // across or straight up/down (same x or same y as the previous point).
  path: MapPoint[];
};
