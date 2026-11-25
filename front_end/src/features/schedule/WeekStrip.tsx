import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/shared/components/ThemedText';
import { Opacity, Radius, Size, Spacing } from '@/shared/constants/theme';
import { formatLongDate, formatWeekdayLetter, getDayOfMonth } from '@/shared/dates';
import { useTheme } from '@/shared/hooks/useTheme';

type WeekStripProps = {
  // The 7 days to show, as "YYYY-MM-DD".
  days: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

// The row of 7 day buttons at the top of the Schedule.
export function WeekStrip({ days, selectedDate, onSelectDate }: WeekStripProps) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {days.map((day) => (
        <DateCell
          key={day}
          date={day}
          selected={day === selectedDate}
          onPress={() => onSelectDate(day)}
        />
      ))}
    </View>
  );
}

type DateCellProps = {
  date: string;
  selected: boolean;
  onPress: () => void;
};

function DateCell({ date, selected, onPress }: DateCellProps) {
  const theme = useTheme();
  const textColor = selected ? 'onPrimary' : 'text';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={formatLongDate(date)}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor: selected ? theme.primary : theme.backgroundSelected },
        pressed && { opacity: Opacity.pressed },
      ]}
    >
      <ThemedText type="eyebrow" themeColor={selected ? 'onPrimary' : 'textSecondary'}>
        {formatWeekdayLetter(date)}
      </ThemedText>
      <ThemedText type="dateNumber" themeColor={textColor}>
        {getDayOfMonth(date)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  cell: {
    // Each cell takes an equal share of the row, so the strip fits any screen width.
    flex: 1,
    minHeight: Size.dateCellMinHeight,
    borderRadius: Radius.dateCell,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
});
