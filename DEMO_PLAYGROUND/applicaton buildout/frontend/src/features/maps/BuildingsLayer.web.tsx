import { useEffect } from 'react';
import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl';
import type { Buildings3D } from './buildings3d';
import { buildingLayers } from './buildingLayers';
export function BuildingsLayer({map,data,onSelect,onFailure}:{map:LibreMap|null;data:Buildings3D|null;onSelect:(id:number)=>void;onFailure:()=>void}){
  useEffect(()=>{
    if(!map||!data)return;
    const restore=()=>{try{
      const source=map.getSource('campus-3d') as GeoJSONSource|undefined;
      if(source)source.setData(data);else map.addSource('campus-3d',{type:'geojson',data});
      for(const layer of buildingLayers)if(!map.getLayer(layer.id))map.addLayer(layer,map.getLayer('campus-location-accuracy')?'campus-location-accuracy':undefined);
    }catch{onFailure();}};
    const click=(event:{point:{x:number;y:number}})=>{
      const layers=buildingLayers.map(l=>l.id).filter(id=>!!map.getLayer(id));if(!layers.length)return;
      const feature=map.queryRenderedFeatures([event.point.x,event.point.y],{layers})[0];const id=Number(feature?.properties.buildingId);
      if(Number.isSafeInteger(id)&&id>0)onSelect(id);
    };
    map.on('style.load',restore);map.on('click',click);if(map.isStyleLoaded())restore();else map.once('idle',restore);
    return()=>{map.off('style.load',restore);map.off('click',click);map.off('idle',restore);try{for(const layer of [...buildingLayers].reverse())if(map.getLayer(layer.id))map.removeLayer(layer.id);if(map.getSource('campus-3d'))map.removeSource('campus-3d');}catch{/* The parent may already have disposed the map. */}};
  },[map,data,onSelect,onFailure]);
  return null;
}
