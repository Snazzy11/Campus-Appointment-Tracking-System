import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { subscribe } from '../../services/stream';
import { createBlipLoader, emptyBlips, type Blips } from './blips';
import { createMapSnapshotReceiver } from './liveReports';
export type { Blips } from './blips';
export function useBlips(enabled = true) {
  const [state,setState]=useState({data:emptyBlips,error:'',loading:false});
  const [live,setLive]=useState('Connecting to live reports…');
  const [routeRevision,setRouteRevision]=useState(0);
  const controller=useRef<ReturnType<typeof createBlipLoader> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const current=createBlipLoader(signal=>api<Blips>('/api/geo/reports',null,{signal}),setState);
    controller.current=current;
    // Transport failures do not prove a path changed. Invalidate only when a
    // snapshot confirms a new routing version, including after reconnecting.
    const receive=createMapSnapshotReceiver((snapshot,changed)=>{
      setState({data:snapshot.reports,error:'',loading:false});
      setLive('Reports update live');
      if(changed)setRouteRevision(n=>n+1);
    });
    const stop=subscribe('/api/geo/reports/stream',null,{
      idleTimeoutMs:30000,
      onOpen:()=>setLive('Syncing reports…'),
      onEvent:event=>{
        if(event.event==='map_snapshot'){receive(event.data);setLive('Reports update live');setState(value=>({...value,error:''}));}
        else if(event.event==='map_unavailable'){setLive('Reconnecting to live reports…');setState(s=>({...s,error:'Live reports temporarily unavailable. Recalculate directions to check current path availability.',loading:false}));}
      },
      onError:()=>{setLive('Reconnecting to live reports…');setState(s=>({...s,error:'Live updates unavailable. Directions remain visible; recalculate to check current path availability.'}));},
    });
    const expiryTimer=setInterval(()=>setState(value=>{
      const features=value.data.features.filter(f=>Date.parse(f.properties.expires_at)>Date.now());
      return features.length===value.data.features.length?value:{...value,data:{...value.data,features}};
    }),1000);
    return ()=>{clearInterval(expiryTimer);stop();current.stop();controller.current=null;};
  },[enabled]);
  return {...state,live,routeRevision,refresh:()=>controller.current?.refresh()};
}
