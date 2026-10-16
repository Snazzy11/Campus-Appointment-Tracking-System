import type { FillLayerSpecification, LineLayerSpecification, CircleLayerSpecification } from 'maplibre-gl';
export const destinationLayers = [
  { id: 'campus-location-accuracy', type: 'fill', source: 'campus-overlay', filter: ['==', ['get', 'kind'], 'location-accuracy'], paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.15 } },
  { id: 'campus-closure-preview', type: 'line', source: 'campus-overlay', filter: ['==', ['get', 'kind'], 'closure-preview'], paint: { 'line-color': '#dc2626', 'line-width': 8, 'line-opacity': 0.85 } },
  { id: 'campus-blips', type: 'circle', source: 'campus-overlay', filter: ['==', ['get', 'kind'], 'blip'], paint: { 'circle-radius': 9, 'circle-color': '#ea580c', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } },
  { id: 'campus-route-halo', type: 'line', source: 'campus-overlay', filter: ['==', ['get', 'kind'], 'route'], paint: { 'line-color': '#ffffff', 'line-width': 9 } },
  { id: 'campus-route', type: 'line', source: 'campus-overlay', filter: ['==', ['get', 'kind'], 'route'], paint: { 'line-color': '#4338ca', 'line-width': 5 } },
  { id: 'campus-building-fill', type: 'fill', source: 'campus-overlay', filter: ['==', ['get', 'kind'], 'building'], paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.3 } },
  { id: 'campus-building-outline', type: 'line', source: 'campus-overlay', filter: ['==', ['get', 'kind'], 'building'], paint: { 'line-color': '#4338ca', 'line-width': 3 } },
  { id: 'campus-entrances', type: 'circle', source: 'campus-overlay', filter: ['==', ['get', 'kind'], 'entrance'], paint: { 'circle-radius': ['case', ['==', ['get', 'selected'], true], 10, 7], 'circle-color': ['case', ['==', ['get', 'selected'], true], '#4338ca', '#ffffff'], 'circle-stroke-color': '#4338ca', 'circle-stroke-width': 3 } },
  { id: 'campus-route-endpoints', type: 'circle', source: 'campus-overlay', filter: ['in', ['get', 'kind'], ['literal', ['route-start', 'route-end']]], paint: { 'circle-radius': 8, 'circle-color': ['case', ['==', ['get', 'kind'], 'route-start'], '#15803d', '#4338ca'], 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } },
  { id: 'campus-user-location', type: 'circle', source: 'campus-overlay', filter: ['==', ['get', 'kind'], 'user-location'], paint: { 'circle-radius': 7, 'circle-color': '#2563eb', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } },
] satisfies (FillLayerSpecification | LineLayerSpecification | CircleLayerSpecification)[];
