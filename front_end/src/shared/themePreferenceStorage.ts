import type { ThemePreference } from './themePreference';

// Phones: the appearance choice is NOT saved yet, so it resets to 'system' when the app is closed.
// To save it, install AsyncStorage (see FRONTEND_TASKS.md) and use it in these two functions.
// The browser version of this file (themePreferenceStorage.web.ts) saves it in localStorage.

export async function loadSavedPreference(): Promise<ThemePreference | null> {
  return null;
}

export async function savePreference(preference: ThemePreference): Promise<void> {
  // Nothing to do until AsyncStorage is added.
  void preference;
}
