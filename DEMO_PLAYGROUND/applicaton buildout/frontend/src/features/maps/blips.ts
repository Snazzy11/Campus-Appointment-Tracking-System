import type { FeatureCollection, Point } from 'geojson';
export type Blip = { kind: 'blip'; id: number; category: string; description: string; severity: string; status: string; verified: boolean; expires_at: string };
export type Blips = FeatureCollection<Point, Blip> & { next_after?: number | null };
export const emptyBlips: Blips = { type: 'FeatureCollection', features: [] };
export function createBlipLoader(request: (signal: AbortSignal) => Promise<Blips>, publish: (value: {data:Blips;error:string;loading:boolean}) => void) {
  let generation=0, stopped=false, pending:AbortController | null=null;
  let state={data:emptyBlips,error:'',loading:false};
  const update=(patch:Partial<typeof state>) => { state={...state,...patch}; if (!stopped) publish(state); };
  return {
    async refresh() {
      pending?.abort(); const current=++generation; const abort=new AbortController(); pending=abort;
      update({loading:true});
      const timer=setTimeout(() => abort.abort(),10000);
      try { const data=await request(abort.signal); if (!stopped && current===generation) update({data,error:''}); }
      catch { if (!stopped && current===generation) update({data:emptyBlips,error:'Campus reports are unavailable. Try again.'}); }
      finally { clearTimeout(timer); if (!stopped && current===generation) update({loading:false}); }
    },
    expire(now=Date.now()) { update({data:{...state.data,features:state.data.features.filter(f=>Date.parse(f.properties.expires_at)>now)}}); },
    stop() { stopped=true; generation++; pending?.abort(); },
  };
}
