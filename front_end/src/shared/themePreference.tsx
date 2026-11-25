import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { loadSavedPreference, savePreference } from './themePreferenceStorage';

// What the student picked in Settings → Appearance.
// 'system' follows the phone's or browser's own light/dark setting.
export type ThemePreference = 'system' | 'light' | 'dark';

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

// A React context lets any component read the preference without passing it down as a prop.
const ThemePreferenceContext = createContext<ThemePreferenceContextValue>({
  preference: 'system',
  setPreference: () => {},
});

// Wrap the whole app in this (see src/app/_layout.tsx) so every screen can use the preference.
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Load the choice saved last time, once, when the app starts.
  useEffect(() => {
    async function loadPreference() {
      const saved = await loadSavedPreference();
      if (saved) {
        setPreferenceState(saved);
      }
    }

    loadPreference();
  }, []);

  function setPreference(newPreference: ThemePreference) {
    setPreferenceState(newPreference);
    savePreference(newPreference);
  }

  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

// Returns the current preference and a function to change it.
export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
