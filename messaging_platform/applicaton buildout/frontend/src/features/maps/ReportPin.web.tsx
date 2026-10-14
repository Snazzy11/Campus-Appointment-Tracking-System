import { useEffect, useRef } from 'react';
import type { Map, Marker } from 'maplibre-gl';
import type { ReportPoint } from './reportPoint';
export function ReportPin({ map, point, onMove }: {map:Map|null;point:ReportPoint|null;onMove:(point:ReportPoint)=>boolean}) {
  const latest=useRef({point,onMove});
  const marker=useRef<Marker|null>(null);
  useEffect(()=>{latest.current={point,onMove};if(point)marker.current?.setLngLat(point);},[point,onMove]);
  const active=!!point;
  useEffect(()=>{
    if (!map || !active) return;
    let stopped=false;
    let pin:Marker|undefined;
    const click=(event:{lngLat:{lng:number;lat:number}})=>{
      const p:ReportPoint=[event.lngLat.lng,event.lngLat.lat];
      if(latest.current.onMove(p))pin?.setLngLat(p);
    };
    void import('maplibre-gl').then(({Marker})=>{
      if(stopped || !latest.current.point)return;
      pin=new Marker({draggable:true,color:'#ea580c'}).setLngLat(latest.current.point).addTo(map);
      marker.current=pin;
      pin.getElement().setAttribute('aria-label','Report location pin. Drag or use arrow keys to move.');
      pin.on('dragend',()=>{
        const location=pin!.getLngLat();
        if(!latest.current.onMove([location.lng,location.lat]) && latest.current.point)pin!.setLngLat(latest.current.point);
      });
      map.on('click',click);
    });
    return ()=>{stopped=true;map.off('click',click);pin?.remove();marker.current=null;};
  },[map,active]);
  return null;
}
