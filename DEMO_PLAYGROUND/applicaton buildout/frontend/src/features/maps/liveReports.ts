import type { Blips } from './blips';
export type MapSnapshot = { reports: Blips; routing_version: string };
export function createMapSnapshotReceiver(accept: (snapshot:MapSnapshot,routeChanged:boolean)=>void) {
  let last='',routing='';
  return (data:string) => {
    if(data===last)return;
    const value=JSON.parse(data) as MapSnapshot;
    if(value.reports?.type!=='FeatureCollection' || !Array.isArray(value.reports.features) || typeof value.routing_version!=='string')throw new Error('Invalid map snapshot');
    const changed=!!routing && value.routing_version!==routing;
    last=data;routing=value.routing_version;accept(value,changed);
  };
}
export function moderationProblem(note:string) {
  return note.trim().length<10 ? 'Add a moderation reason of at least 10 characters. This is separate from the report description.' : '';
}
