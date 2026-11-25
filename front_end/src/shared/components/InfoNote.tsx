import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

import { Button } from './Button';
import { ThemedText } from './ThemedText';

type InfoNoteProps = {
  message: string;
  title?: string;
  // neutral: demo notices and help text
  // error:   something failed; the text turns red and screen readers announce it
  variant?: 'neutral' | 'error';
  // Optional small button inside the note, e.g. "Try again".
  actionLabel?: string;
  onAction?: () => void;
};

// A small shaded box for notices, help and inline errors.
export function InfoNote({
  message,
  title,
  variant = 'neutral',
  actionLabel,
  onAction,
}: InfoNoteProps) {
  const theme = useTheme();
  const textColor = variant === 'error' ? 'danger' : 'text';

  return (
    <View
      style={[styles.note, { backgroundColor: theme.backgroundSelected }]}
      // Errors are read out as soon as they appear, so screen-reader users notice them.
      accessibilityLiveRegion={variant === 'error' ? 'polite' : 'none'}
      accessibilityRole={variant === 'error' ? 'alert' : undefined}
    >
      {title && (
        <ThemedText type="bodyBold" themeColor={textColor}>
          {title}
        </ThemedText>
      )}
      <ThemedText type="caption" themeColor={variant === 'error' ? 'danger' : 'textSecondary'}>
        {message}
      </ThemedText>
      {actionLabel && onAction && (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="text" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    gap: Spacing.xs,
    padding: Spacing.lg,
    borderRadius: Radius.control,
  },
  action: {
    alignSelf: 'flex-start',
    // Pulls the text button left so its label lines up with the message above.
    marginLeft: -Spacing.lg,
  },
});
