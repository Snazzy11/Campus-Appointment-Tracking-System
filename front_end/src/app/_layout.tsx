import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/shared/constants/theme';
import { useColorScheme } from '@/shared/hooks/useColorScheme';
import { ThemePreferenceProvider } from '@/shared/themePreference';

// Root layout: wraps every screen in src/app/.
//
// The Stack holds the screens that cover the whole display (no tab bar):
// Welcome, Sign in, Create account, Book appointment, Appointment confirmed and
// Organization details. The tabs live in the "(tabs)" folder, which is one screen of this Stack.
export default function RootLayout() {
  // The provider must wrap everything that reads the light/dark choice (including RootNavigator).
  return (
    <ThemePreferenceProvider>
      <RootNavigator />
    </ThemePreferenceProvider>
  );
}

function RootNavigator() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  // Tells the navigation library our colors, so its own backgrounds match the app in light and dark mode.
  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.backgroundElement,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      {/* Light text on dark backgrounds and the other way round. Not "auto", because "auto"
          follows the phone's setting even when the student picked a different appearance. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* The app uses the whole window. On wide screens each Screen limits how wide its own
          content gets (see the `width` prop of Screen), and the tabs become a sidebar. */}
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
