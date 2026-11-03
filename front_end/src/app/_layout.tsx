import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from '@/shared/hooks/useColorScheme';

import AppTabs from '@/shared/components/AppTabs';

// Root layout: wraps every screen in src/app/. Each file in that folder becomes a route.
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppTabs />
    </ThemeProvider>
  );
}
