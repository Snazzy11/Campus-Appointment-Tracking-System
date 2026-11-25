// FAKE DATA: this file returns the illustrative map from the design until the backend has a
// map endpoint (the maps router in back_end/cats/api/routers/maps/ has no endpoints yet).
// Screens call these functions exactly as they will call the real ones, so only this file
// needs to change. See FRONTEND_TASKS.md.
//
// The map is a drawing, not real GPS: the buildings are placed to match the Figma frame.

import { simulateRequest } from '@/shared/fakeBackend';

import { CampusMap, MapPoint, MapRoute } from './types';

// The route used when no destination is picked.
export const DEFAULT_DESTINATION_ID = 'library';

const SAMPLE_MAP: CampusMap = {
  buildings: [
    {
      id: 'arts',
      label: 'Arts',
      kind: 'building',
      rect: { left: 4, top: 7, width: 14, height: 15 },
    },
    {
      id: 'library',
      label: 'Library',
      kind: 'building',
      rect: { left: 32, top: 6, width: 26, height: 16 },
    },
    {
      id: 'science',
      label: 'Science',
      kind: 'building',
      rect: { left: 73, top: 7, width: 22, height: 15 },
    },
    {
      id: 'hall-a',
      label: 'Hall A',
      kind: 'building',
      rect: { left: 4, top: 40, width: 14, height: 26 },
    },
    { id: 'quad', label: 'Quad', kind: 'park', rect: { left: 32, top: 40, width: 26, height: 26 } },
    {
      id: 'union',
      label: 'Union',
      kind: 'building',
      rect: { left: 73, top: 40, width: 22, height: 26 },
    },
    {
      id: 'advising',
      label: 'Advising',
      kind: 'building',
      rect: { left: 32, top: 85, width: 26, height: 9 },
    },
  ],
  // Two roads running top to bottom and two running left to right.
  roads: [
    { left: 21, top: 0, width: 6, height: 100 },
    { left: 63, top: 0, width: 6, height: 100 },
    { left: 0, top: 26, width: 100, height: 6 },
    { left: 0, top: 74, width: 100, height: 6 },
  ],
};

// The green starting dot: where the left road crosses the bottom road.
const ORIGIN: MapPoint = { x: 24, y: 77 };

const SAMPLE_ROUTES: MapRoute[] = [
  {
    destinationId: 'library',
    destinationName: 'Library',
    marker: 'L',
    markerPosition: { x: 45, y: 22 },
    summaryTitle: 'A quiet place to focus.',
    summarySubtitle: 'Library · Sample walking route',
    instructions: 'Follow the maroon path from the green dot.',
    // Right along the bottom road, up the right road, left along the top road, up to the Library.
    path: [ORIGIN, { x: 66, y: 77 }, { x: 66, y: 29 }, { x: 45, y: 29 }, { x: 45, y: 22 }],
  },
  {
    destinationId: 'student-union',
    destinationName: 'Student union',
    marker: 'U',
    markerPosition: { x: 73, y: 53 },
    summaryTitle: 'Meet at the union.',
    summarySubtitle: 'Student union · Sample walking route',
    instructions: 'Follow the maroon path from the green dot.',
    // Right along the bottom road, up the right road, then right into the Union.
    path: [ORIGIN, { x: 66, y: 77 }, { x: 66, y: 53 }, { x: 73, y: 53 }],
  },
];

export async function getCampusMap(): Promise<CampusMap> {
  await simulateRequest();
  return SAMPLE_MAP;
}

// Returns the route to a destination, or null if there is no route for it.
export async function getRoute(destinationId: string): Promise<MapRoute | null> {
  await simulateRequest();
  return SAMPLE_ROUTES.find((route) => route.destinationId === destinationId) ?? null;
}
