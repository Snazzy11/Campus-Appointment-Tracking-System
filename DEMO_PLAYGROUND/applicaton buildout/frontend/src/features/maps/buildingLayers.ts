import type { FillLayerSpecification, FillExtrusionLayerSpecification } from 'maplibre-gl';
export const buildingLayers = [
  {id:'campus-3d-flat',type:'fill',source:'campus-3d',filter:['==',['get','height'],0],paint:{'fill-color':'#94a3b8','fill-opacity':0.25,'fill-outline-color':'#64748b'}},
  {id:'campus-3d-volumes',type:'fill-extrusion',source:'campus-3d',filter:['>',['get','height'],0],paint:{'fill-extrusion-height':['get','height'],'fill-extrusion-base':['get','base'],'fill-extrusion-color':'#64748b','fill-extrusion-opacity':0.55}},
] satisfies (FillLayerSpecification|FillExtrusionLayerSpecification)[];
