import { useSyncExternalStore } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useThemePreference } from '@/shared/themePreference';

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

// Browser version of useColorScheme.ts: returns the student's choice in Settings → Appearance,
// or the browser's own setting when they picked "System".
export function useColorScheme() {
  const { preference } = useThemePreference();
  const systemScheme = useSystemColorScheme();
  // Match the HTML built ahead of time (always light) on the first render, then switch.
  const hasHydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);

  if (!hasHydrated) {
    return 'light';
  }
  if (preference === 'system') {
    return systemScheme;
  }
  return preference;
}
