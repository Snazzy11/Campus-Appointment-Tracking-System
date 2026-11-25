import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

import { ThemedText } from './ThemedText';

type DetailCardProps = {
  // Small maroon label at the top, e.g. "NEXT MEETUP".
  eyebrow?: string;
  title?: string;
  // Anything else to show under the title: ThemedText lines or DetailField rows.
  children?: ReactNode;
};

// A white card that shows a title and some details, e.g. an advisor or an appointment summary.
export function DetailCard({ eyebrow, title, children }: DetailCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      {eyebrow && (
        <ThemedText type="eyebrow" themeColor="primary">
          {eyebrow}
        </ThemedText>
      )}
      {title && <ThemedText type="cardTitle">{title}</ThemedText>}
      {children}
    </View>
  );
}

type DetailFieldProps = {
  label: string;
  value: string;
};

// One labeled value inside a DetailCard, e.g. "WHEN" / "Wednesday, November 18".
export function DetailField({ label, value }: DetailFieldProps) {
  return (
    <View style={styles.field}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="body">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.card,
  },
  field: {
    gap: Spacing.xxs,
    paddingVertical: Spacing.xs,
  },
});
