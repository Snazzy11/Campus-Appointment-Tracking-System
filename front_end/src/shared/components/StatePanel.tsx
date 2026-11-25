import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

import { Button } from './Button';
import { ThemedText } from './ThemedText';

type StatePanelProps = {
  // loading: shows a spinner
  // empty:   there is nothing to show yet
  // error:   loading failed; the title turns red
  variant: 'loading' | 'empty' | 'error';
  title: string;
  message?: string;
  // Main button, e.g. "Try again".
  actionLabel?: string;
  onAction?: () => void;
  // Optional second button, e.g. "View saved places".
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

// Fills a section of a screen when its content is loading, empty or failed to load.
export function StatePanel({
  variant,
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: StatePanelProps) {
  const theme = useTheme();

  return (
    <View
      style={styles.panel}
      accessibilityRole={variant === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
    >
      {variant === 'loading' && <ActivityIndicator color={theme.primary} />}

      <View style={styles.text}>
        <ThemedText type="bodyBold" themeColor={variant === 'error' ? 'danger' : 'text'}>
          {title}
        </ThemedText>
        {message && (
          <ThemedText type="caption" themeColor="textSecondary">
            {message}
          </ThemedText>
        )}
      </View>

      {actionLabel && onAction && <Button label={actionLabel} onPress={onAction} />}
      {secondaryActionLabel && onSecondaryAction && (
        <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="secondary" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  text: {
    gap: Spacing.sm,
  },
});
