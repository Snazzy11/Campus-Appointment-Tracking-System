import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Size, Spacing, type ThemeColor } from '@/shared/constants/theme';
import { useIsWideScreen } from '@/shared/hooks/useIsWideScreen';
import { useTheme } from '@/shared/hooks/useTheme';

// How wide the content may get on big screens (on phones it always fills the screen):
// form:    480, for forms and short flows (Sign in, Book appointment, ...)
// reading: 760, for one-column screens (Schedule, Settings, ...)
// wide:    1100, for screens with two columns or a grid (Home, Map, Clubs, ...)
export type ScreenWidth = 'form' | 'reading' | 'wide';

const MAX_WIDTHS: Record<ScreenWidth, number> = {
  form: Size.formMaxWidth,
  reading: Size.readingMaxWidth,
  wide: Size.wideMaxWidth,
};

type ScreenProps = {
  children: ReactNode;
  // Set this on screens that show the bottom tab bar. The tab bar already keeps clear of the
  // home indicator, so the screen must not add bottom padding for it a second time.
  hasTabBar?: boolean;
  // Background color of the whole screen. Defaults to 'background'.
  backgroundColor?: ThemeColor;
  // How wide the content may get on big screens. Defaults to 'reading'.
  width?: ScreenWidth;
  // Extra styles for the content, e.g. to center it.
  contentStyle?: StyleProp<ViewStyle>;
};

// The outer element of every screen. It:
// - keeps content clear of the notch, status bar and home indicator,
// - uses the light/dark background,
// - lets the content scroll, so nothing gets cut off on small phones or with large text,
// - adds the standard side padding and the gap between sections from the design,
// - on big screens, centers the content and stops it from getting too wide to read.
export function Screen({
  children,
  hasTabBar = false,
  backgroundColor = 'background',
  width = 'reading',
  contentStyle,
}: ScreenProps) {
  const theme = useTheme();
  const isWide = useIsWideScreen();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme[backgroundColor] }]}
      edges={hasTabBar ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        // Lets a tap on a button work on the first try while the keyboard is open.
        keyboardShouldPersistTaps="handled"
        // iOS only: scrolls the focused text field above the keyboard.
        automaticallyAdjustKeyboardInsets
      >
        <View
          style={[
            styles.content,
            isWide && styles.contentWide,
            { maxWidth: MAX_WIDTHS[width] },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    // Centers the content column when the window is wider than its max width.
    alignItems: 'center',
  },
  content: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  // More breathing room around the content on big screens.
  contentWide: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxl,
  },
});
