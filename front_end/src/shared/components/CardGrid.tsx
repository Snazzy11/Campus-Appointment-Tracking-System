import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/constants/theme';
import { useIsWideScreen } from '@/shared/hooks/useIsWideScreen';

type CardGridProps = {
  children: ReactNode;
};

// Shows cards in a single column on phones and in two columns on wide screens.
// Example: <CardGrid>{organizations.map(...)}</CardGrid>
export function CardGrid({ children }: CardGridProps) {
  const isWide = useIsWideScreen();
  // Children.toArray turns whatever was passed in (one element, a list, ...) into a plain array.
  const items = Children.toArray(children);

  if (!isWide) {
    return <View style={styles.column}>{items}</View>;
  }

  // Split the cards into rows of two: [a, b, c] -> [[a, b], [c]].
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }

  return (
    <View style={styles.column}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((item, itemIndex) => (
            <View key={itemIndex} style={styles.cell}>
              {item}
            </View>
          ))}
          {/* An empty cell keeps the last card half-width when there is an odd number. */}
          {row.length === 1 && <View style={styles.cell} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cell: {
    flex: 1,
  },
});
