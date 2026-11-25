import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/constants/theme';

import { ThemedText } from './ThemedText';

type SectionHeadingProps = {
  title: string;
  description?: string;
};

// A heading that starts a section of a screen, e.g. "What do you need today?".
export function SectionHeading({ title, description }: SectionHeadingProps) {
  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" accessibilityRole="header">
        {title}
      </ThemedText>
      {description && (
        <ThemedText type="caption" themeColor="textSecondary">
          {description}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
});
