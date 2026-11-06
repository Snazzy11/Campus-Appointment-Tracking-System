import { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

type ScreenProps = {
  children: ReactNode;
};

// Wraps a screen so it uses the theme background (light/dark) and stays clear of
// the notch, status bar and home indicator. Use it as the outer element of every screen.
export function Screen({ children }: ScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.three,
  },
});
