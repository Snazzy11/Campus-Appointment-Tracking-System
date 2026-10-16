import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router/react-navigation';
import { createLocationFollower, emptyFollow } from './following';
import { watchLocation } from './watchLocation';
import { onLocationHidden } from './locationVisibility';
import { validReportPoint } from './reportPoint';
export function useFollowing() {
  const [state,setState] = useState(emptyFollow);
  const focused = useIsFocused();
  const controller = useRef<ReturnType<typeof createLocationFollower> | null>(null);
  useEffect(() => {
    const current = createLocationFollower(watchLocation,setState,validReportPoint);
    controller.current = current;
    const cleanup = onLocationHidden(() => current.stop('Location following stopped while the map was inactive.'));
    return () => {cleanup();current.dispose();controller.current=null;};
  }, []);
  useEffect(() => { if(!focused)controller.current?.stop(); },[focused]);
  const stop = useCallback(() => controller.current?.stop(),[]);
  return { state, stop, start: () => {if(focused)controller.current?.start();} };
}

export type ReturnTypeOfFollowing = ReturnType<typeof useFollowing>;
