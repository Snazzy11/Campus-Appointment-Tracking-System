import { useEffect, useState } from 'react';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { plainMapStyle } from './plainMapStyle';
export function useNativeMapStyle(url:string|undefined,attempt:number,onFailure:()=>void){
  const [loaded,setLoaded]=useState<{url:string;style:StyleSpecification}|null>(null);
  useEffect(()=>{
    if(!url)return;
    const abort=new AbortController();let active=true;const timer=setTimeout(()=>abort.abort(),12000);
    void fetch(url,{signal:abort.signal}).then(async response=>{if(!response.ok)throw Error('Map style unavailable');const raw=await response.json();
      // Resolve relative resources because the native renderer receives inline JSON.
      const absolute=(value:string)=>new URL(value,url).toString();
      if(typeof raw.glyphs==='string')raw.glyphs=absolute(raw.glyphs);
      if(typeof raw.sprite==='string')raw.sprite=absolute(raw.sprite);
      else if(Array.isArray(raw.sprite))raw.sprite=raw.sprite.map((s:{id:string;url:string})=>({...s,url:absolute(s.url)}));
      for(const source of Object.values(raw.sources) as {url?:string;tiles?:string[]}[]){if(source.url)source.url=absolute(source.url);if(source.tiles)source.tiles=source.tiles.map(absolute);}
      if(active)setLoaded({url,style:plainMapStyle(raw)});
    }).catch(()=>{if(active)onFailure();}).finally(()=>clearTimeout(timer));
    return()=>{active=false;abort.abort();clearTimeout(timer);};
  },[url,attempt,onFailure]);
  return loaded && loaded.url===url?loaded.style:undefined;
}
