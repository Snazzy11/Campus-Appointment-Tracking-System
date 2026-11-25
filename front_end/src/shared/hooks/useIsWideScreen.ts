import { useSyncExternalStore } from 'react';
import { useWindowDimensions } from 'react-native';

import { Breakpoints } from '@/shared/constants/theme';

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

// True when the window is wide enough for the wide layout (sidebar and two columns):
// a browser on a laptop, or a tablet. False on phones and narrow browser windows.
// It updates automatically when the browser window is resized or a tablet is rotated.
export function useIsWideScreen(): boolean {
  // On the web, the HTML for each page is built ahead of time without knowing the window size,
  // and the first render in the browser must match it. So we start with the phone layout and
  // switch right after the page loads. (Same trick as useColorScheme.web.ts.)
  const hasLoaded = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const { width } = useWindowDimensions();

  return hasLoaded && width >= Breakpoints.wide;
}
