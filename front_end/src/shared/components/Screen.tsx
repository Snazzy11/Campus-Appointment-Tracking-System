import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, type ThemeColor } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

type ScreenProps = {
  children: ReactNode;
  // Set this on screens that show the bottom tab bar. The tab bar already keeps clear of the
  // home indicator, so the screen must not add bottom padding for it a second time.
  hasTabBar?: boolean;
  // Background color of the whole screen. Defaults to 'background'.
  backgroundColor?: ThemeColor;
  // Extra styles for the scrolling content, e.g. to center it.
  contentStyle?: StyleProp<ViewStyle>;
};

// The outer element of every screen. It:
// - keeps content clear of the notch, status bar and home indicator,
// - uses the light/dark background,
// - lets the content scroll, so nothing gets cut off on small phones or with large text,
// - adds the standard side padding and the gap between sections from the design.
export function Screen({
  children,
  hasTabBar = false,
  backgroundColor = 'background',
  contentStyle,
}: ScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme[backgroundColor] }]}
      edges={hasTabBar ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        // Lets a tap on a button work on the first try while the keyboard is open.
        keyboardShouldPersistTaps="handled"
        // iOS only: scrolls the focused text field above the keyboard.
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
  },
});
