import { useCallback, useState } from 'react';
export function useBuildings3D(){
  const [enabled,setEnabled]=useState(false);
  const [message,setMessage]=useState('');
  const [bearing,setBearing]=useState(0);
  const [pitch,setPitch]=useState(45);
  const disable=useCallback((reason='')=>{setEnabled(false);setMessage(reason);setBearing(0);setPitch(45);},[]);
  return {state:{enabled,message},bearing,pitch,disable,enable:()=>{setEnabled(true);setMessage('');},rotate:()=>setBearing(v=>(v+45)%360),tilt:()=>setPitch(v=>v===45?60:45)};
}
export type BuildingsView=ReturnType<typeof useBuildings3D>;
