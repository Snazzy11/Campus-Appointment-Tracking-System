import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import AuthGate from '@/shared/components/AuthGate';

import AppTabs from '@/shared/components/AppTabs';

// Root layout: wraps every screen in src/app/. Each file in that folder becomes a route.
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthGate>
        <AppTabs />
      </AuthGate>
    </ThemeProvider>
  );
}
