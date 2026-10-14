import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
export function plainMapStyle(style:StyleSpecification):StyleSpecification {
  // Provider render_height may contain inferred floor counts/default heights.
  return {...style,layers:style.layers.filter(layer=>layer.type!=='fill-extrusion')};
}
