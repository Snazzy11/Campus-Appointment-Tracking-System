import type { ThemePreference } from './themePreference';

// Browser version: saves the appearance choice in localStorage, so it is remembered after a reload.
// (On phones, themePreferenceStorage.ts is used instead.)

const STORAGE_KEY = 'cats-theme-preference';

export async function loadSavedPreference(): Promise<ThemePreference | null> {
  // `window` doesn't exist while the web build pre-renders pages, so check first.
  if (typeof window === 'undefined') {
    return null;
  }
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'system' || saved === 'light' || saved === 'dark') {
    return saved;
  }
  return null;
}

export async function savePreference(preference: ThemePreference): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, preference);
}
