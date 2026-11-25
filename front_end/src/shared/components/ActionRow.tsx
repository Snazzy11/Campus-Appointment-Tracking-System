import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Opacity, Radius, Size, Spacing } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

type ActionRowProps = {
  title: string;
  subtitle?: string;
  onPress: () => void;
  // Optional small number badge at the start, like "01" on Home.
  leadingLabel?: string;
  // Optional custom element at the start instead of the number badge (e.g. an organization's initials).
  leading?: ReactNode;
  // Minimum height of the row. Defaults to the standard action row height.
  minHeight?: number;
};

// A white tappable card with a title, an optional subtitle and an arrow on the right.
// Used for Home actions, Settings rows, saved places and organizations.
export function ActionRow({
  title,
  subtitle,
  onPress,
  leadingLabel,
  leading,
  minHeight = Size.actionRowMinHeight,
}: ActionRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, minHeight },
        pressed && { opacity: Opacity.pressed },
      ]}
    >
      {leadingLabel && (
        <View style={[styles.leadingBadge, { backgroundColor: theme.accentBackground }]}>
          <ThemedText type="bodyBold" themeColor="primary">
            {leadingLabel}
          </ThemedText>
        </View>
      )}
      {leading}

      <View style={styles.textColumn}>
        <ThemedText type="rowTitle">{title}</ThemedText>
        {subtitle && (
          <ThemedText type="caption" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        )}
      </View>

      <Icon name="arrowRight" color={theme.primary} size={Size.iconSmall} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.card,
  },
  leadingBadge: {
    width: Size.badge,
    height: Size.badge,
    borderRadius: Radius.control,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textColumn: {
    flex: 1,
    gap: Spacing.xs,
  },
});
