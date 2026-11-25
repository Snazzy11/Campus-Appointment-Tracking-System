import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Opacity, Radius, Size, Spacing, type ThemeColor } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

// primary:   filled maroon, for the main action on a screen
// secondary: light filled, for the second action
// text:      no background, for small extra actions like "Skip for now"
// inverse:   light button on a maroon background (Welcome screen)
export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'inverse';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  // Shows a spinner and ignores presses, e.g. while a request is running.
  loading?: boolean;
  // Shows an arrow after the label, like "Get started →".
  showArrow?: boolean;
  accessibilityHint?: string;
};

// Background and text color for each variant.
const VARIANT_COLORS: Record<ButtonVariant, { background?: ThemeColor; foreground: ThemeColor }> = {
  primary: { background: 'primary', foreground: 'onPrimary' },
  secondary: { background: 'backgroundSelected', foreground: 'primary' },
  text: { foreground: 'primary' },
  inverse: { background: 'onPrimary', foreground: 'primary' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  showArrow = false,
  accessibilityHint,
}: ButtonProps) {
  const theme = useTheme();
  const colors = VARIANT_COLORS[variant];
  const foreground = theme[colors.foreground];
  const isInactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        variant === 'text' ? styles.textButton : styles.filledButton,
        colors.background && { backgroundColor: theme[colors.background] },
        pressed && { opacity: Opacity.pressed },
        disabled && { opacity: Opacity.disabled },
      ]}
    >
      {/* The label stays in place (just invisible) while loading, so the button doesn't change size. */}
      <View style={[styles.content, loading && styles.hidden]}>
        <ThemedText type="button" style={{ color: foreground }}>
          {label}
        </ThemedText>
        {showArrow && <Icon name="arrowRight" color={foreground} size={Size.iconSmall} />}
      </View>
      {loading && <ActivityIndicator color={foreground} style={StyleSheet.absoluteFill} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.card,
  },
  filledButton: {
    minHeight: Size.buttonMinHeight,
  },
  textButton: {
    minHeight: Size.touchTargetMin,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  hidden: {
    opacity: 0,
  },
});
