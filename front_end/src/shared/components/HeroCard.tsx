import { Pressable, StyleSheet, View } from 'react-native';

import { Opacity, Radius, Size, Spacing, type ThemeColor } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

// primary: maroon card (Home, Settings profile)
// gold: light gold card (Clubs, Saved places)
// technology / outdoors / arts: one color per organization category
export type HeroVariant = 'primary' | 'gold' | 'technology' | 'outdoors' | 'arts';

type HeroCardProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  // Optional link text at the bottom, e.g. "View your schedule". Needs onPress.
  linkLabel?: string;
  onPress?: () => void;
  variant?: HeroVariant;
};

// Colors for each variant: card background, title color and eyebrow color.
const VARIANT_COLORS: Record<
  HeroVariant,
  { background: ThemeColor; title: ThemeColor; eyebrow: ThemeColor }
> = {
  primary: { background: 'primary', title: 'onPrimary', eyebrow: 'brandAccent' },
  gold: { background: 'accentBackground', title: 'primary', eyebrow: 'primary' },
  technology: { background: 'technologyBackground', title: 'primary', eyebrow: 'primary' },
  outdoors: { background: 'outdoorsBackground', title: 'primary', eyebrow: 'primary' },
  arts: { background: 'artsBackground', title: 'primary', eyebrow: 'primary' },
};

// The big colored card near the top of several screens.
export function HeroCard({
  title,
  eyebrow,
  description,
  linkLabel,
  onPress,
  variant = 'primary',
}: HeroCardProps) {
  const theme = useTheme();
  const colors = VARIANT_COLORS[variant];
  const titleColor = theme[colors.title];

  const content = (
    <>
      {eyebrow && (
        <ThemedText type="eyebrow" style={{ color: theme[colors.eyebrow] }}>
          {eyebrow}
        </ThemedText>
      )}
      <ThemedText type="hero" style={{ color: titleColor }}>
        {title}
      </ThemedText>
      {description && (
        <ThemedText type="supporting" style={{ color: titleColor }}>
          {description}
        </ThemedText>
      )}
      {linkLabel && (
        <View style={styles.linkRow}>
          <ThemedText type="caption" style={{ color: titleColor }}>
            {linkLabel}
          </ThemedText>
          <Icon name="arrowRight" color={titleColor} size={Size.iconSmall} />
        </View>
      )}
    </>
  );

  const cardStyle = [styles.card, { backgroundColor: theme[colors.background] }];

  // Only make the card tappable when there is something to do.
  if (!onPress) {
    return <View style={cardStyle}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={linkLabel ? `${title}. ${linkLabel}` : title}
      style={({ pressed }) => [cardStyle, pressed && { opacity: Opacity.pressed }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.hero,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
});
