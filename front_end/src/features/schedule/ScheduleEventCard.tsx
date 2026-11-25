import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { ThemedText } from '@/shared/components/ThemedText';
import {
  BorderWidth,
  Opacity,
  Radius,
  Size,
  Spacing,
  type ThemeColor,
} from '@/shared/constants/theme';
import { formatTimeRange } from '@/shared/dates';
import { useTheme } from '@/shared/hooks/useTheme';

import { ScheduleEvent, ScheduleEventType } from './types';

// The color of the line on the left of each card.
const ACCENT_COLORS: Record<ScheduleEventType, ThemeColor> = {
  class: 'success',
  advising: 'primary',
  study: 'warning',
  suggestion: 'primary',
};

type ScheduleEventCardProps = {
  event: ScheduleEvent;
  // Leave out for cards that don't open anything (classes and study blocks).
  onPress?: () => void;
};

// One event in the Schedule list.
export function ScheduleEventCard({ event, onPress }: ScheduleEventCardProps) {
  const theme = useTheme();
  const accentColor = theme[ACCENT_COLORS[event.type]];
  const isSuggestion = event.type === 'suggestion';

  // The suggestion card has its own wording instead of a time and location (see Figma).
  const eyebrow = isSuggestion
    ? 'A LITTLE ROOM IN YOUR DAY'
    : formatTimeRange(event.startTime, event.endTime);
  const subtitle = isSuggestion
    ? 'Explore a sample advising appointment'
    : `${event.detail} · ${event.location}`;

  const content = (
    <>
      <View style={[styles.accentLine, { backgroundColor: accentColor }]} />
      <View style={styles.textColumn}>
        <ThemedText type="eyebrow" style={{ color: accentColor }}>
          {eyebrow}
        </ThemedText>
        <ThemedText type="rowTitle">{event.title}</ThemedText>
        <View style={styles.subtitleRow}>
          <ThemedText type="caption" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
          {isSuggestion && (
            <Icon name="arrowRight" color={theme.textSecondary} size={Size.iconSmall} />
          )}
        </View>
      </View>
    </>
  );

  const cardStyle = [styles.card, { backgroundColor: theme.backgroundElement }];

  if (!onPress) {
    return (
      <View
        style={cardStyle}
        accessible
        accessibilityLabel={`${eyebrow}. ${event.title}. ${subtitle}`}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${eyebrow}. ${event.title}. ${subtitle}`}
      style={({ pressed }) => [cardStyle, pressed && { opacity: Opacity.pressed }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    minHeight: Size.eventCardMinHeight,
    padding: Spacing.lg,
    borderRadius: Radius.card,
  },
  accentLine: {
    width: BorderWidth.eventAccent,
    borderRadius: Radius.pill,
  },
  textColumn: {
    flex: 1,
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
});
