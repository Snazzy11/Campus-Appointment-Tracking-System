import type { FeatureCollection, Geometry } from 'geojson';
import type { CampusCollection } from './destinations';
export type Building3DProperties = { kind: 'building-3d'; buildingId: number; name: string; height: number; base: number; heightSource: string };
export type Buildings3D = FeatureCollection<Geometry, Building3DProperties>;
export const emptyBuildings3D: Buildings3D = { type: 'FeatureCollection', features: [] };
export function heightMeters(value: string | undefined): number | null {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?)\s*(m|ft)?$/i);
  if (!match) return null;
  const meters = Number(match[1]) * (match[2]?.toLowerCase() === 'ft' ? 0.3048 : 1);
  return meters > 0 && meters <= 300 ? meters : null;
}
export function buildingVolumes(collection: CampusCollection): Buildings3D {
  return { type: 'FeatureCollection', features: collection.features.filter(f=>f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon').map(f=>{
    const height = heightMeters(f.properties.tags.height);
    const base = heightMeters(f.properties.tags.min_height) || 0;
    // Floor counts deliberately do not imply a made-up metres-per-floor height.
    const usable = height !== null && base < height;
    return { type:'Feature', id:f.id, geometry:f.geometry, properties:{kind:'building-3d',buildingId:f.id,name:f.properties.name || 'Unnamed building',height:usable?height:0,base:usable?base:0,heightSource:usable?'OpenStreetMap height tag (not surveyed by this app)':'Height unavailable'} };
  }) };
}
export type BuildingsState = { enabled: boolean; status:'idle'|'loading'|'ready'|'error'; data:Buildings3D; message:string };
export const emptyBuildingsState: BuildingsState={enabled:false,status:'idle',data:emptyBuildings3D,message:''};
export function createBuildingsLoader(request:(signal:AbortSignal)=>Promise<CampusCollection>,publish:(state:BuildingsState)=>void) {
  let generation=0,disposed=false;let abort:AbortController|undefined;let timer:ReturnType<typeof setTimeout>|undefined;
  const cancel=()=>{generation++;abort?.abort();clearTimeout(timer);};
  return {
    async enable(){
      if(disposed)return;cancel();const current=generation;abort=new AbortController();
      publish({...emptyBuildingsState,enabled:true,status:'loading'});
      timer=setTimeout(()=>{if(!disposed&&current===generation){cancel();publish({...emptyBuildingsState,status:'error',message:'3D building data timed out. The 2D map remains available.'});}},10000);
      try{const collection=await request(abort.signal);if(disposed||current!==generation)return;clearTimeout(timer);const data=buildingVolumes(collection);const known=data.features.filter(f=>f.properties.height>0).length;
        publish({enabled:true,status:'ready',data,message:`${known} of ${data.features.length} footprints have a usable height. Unknown heights stay flat.${collection.next_after?' Showing the first 500 buildings.':''}`});
      }catch{if(!disposed&&current===generation){clearTimeout(timer);publish({...emptyBuildingsState,status:'error',message:'3D building data could not load. The 2D map remains available.'});}}
    },
    disable(message=''){cancel();if(!disposed)publish({...emptyBuildingsState,message});},
    dispose(){disposed=true;cancel();},
  };
}
