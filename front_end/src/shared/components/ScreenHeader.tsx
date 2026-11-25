import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/constants/theme';

import { IconButton } from './IconButton';
import { ThemedText } from './ThemedText';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  // Small maroon text above the title, e.g. "CATS / CAMPUS COMPANION".
  eyebrow?: string;
  // Pass this to show a back arrow above the title.
  onBack?: () => void;
  // An optional button shown at the top right, e.g. the saved-places heart on Home.
  action?: ReactNode;
};

// The title block at the top of a screen.
// Root screens (tabs) use `eyebrow`; pushed screens use `onBack`.
export function ScreenHeader({ title, subtitle, eyebrow, onBack, action }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      {onBack && (
        // The negative margin lines the arrow up with the text below, because the button's
        // tap area is bigger than the arrow itself.
        <View style={styles.backButton}>
          <IconButton icon="back" accessibilityLabel="Go back" onPress={onBack} />
        </View>
      )}

      <View style={styles.titleRow}>
        <View style={styles.textColumn}>
          {eyebrow && (
            <ThemedText type="eyebrow" themeColor="primary">
              {eyebrow}
            </ThemedText>
          )}
          <ThemedText type="title" accessibilityRole="header">
            {title}
          </ThemedText>
          {subtitle && (
            <ThemedText type="supporting" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          )}
        </View>
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  backButton: {
    marginLeft: -Spacing.md,
    alignSelf: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  textColumn: {
    flex: 1,
    gap: Spacing.sm,
  },
});
