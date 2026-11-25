import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { Colors, Size } from '@/shared/constants/theme';
import { useColorScheme } from '@/shared/hooks/useColorScheme';

// Root layout: wraps every screen in src/app/.
//
// The Stack holds the screens that cover the whole display (no tab bar):
// Welcome, Sign in, Create account, Book appointment, Appointment confirmed and
// Organization details. The tabs live in the "(tabs)" folder, which is one screen of this Stack.
export default function RootLayout() {
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
      <StatusBar style="auto" />
      {/* In a wide browser window the app stays a phone-sized column in the middle (spec: browser layout). */}
      <View style={[styles.page, { backgroundColor: colors.background }]}>
        <View style={styles.column}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: Size.browserContentMaxWidth,
  },
});
