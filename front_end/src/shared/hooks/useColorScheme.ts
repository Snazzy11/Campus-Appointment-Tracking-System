import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useThemePreference } from '@/shared/themePreference';

// Returns 'light' or 'dark': the student's choice in Settings → Appearance,
// or the phone's own setting when they picked "System".
export function useColorScheme() {
  const { preference } = useThemePreference();
  const systemScheme = useSystemColorScheme();

  if (preference === 'system') {
    return systemScheme;
  }
  return preference;
}
