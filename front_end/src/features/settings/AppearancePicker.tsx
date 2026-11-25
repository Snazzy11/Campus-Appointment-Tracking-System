import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/shared/components/ThemedText';
import { Opacity, Radius, Size, Spacing } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';
import { useThemePreference, type ThemePreference } from '@/shared/themePreference';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// Three buttons in a row to choose light mode, dark mode, or the device's setting.
// Not in the Figma design yet (see FRONTEND_TASKS.md); styled like the Schedule's week strip.
export function AppearancePicker() {
  const theme = useTheme();
  const { preference, setPreference } = useThemePreference();

  return (
    <View
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Appearance"
    >
      {OPTIONS.map((option) => {
        const selected = option.value === preference;
        return (
          <Pressable
            key={option.value}
            onPress={() => setPreference(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            style={({ pressed }) => [
              styles.option,
              selected && { backgroundColor: theme.primary },
              pressed && { opacity: Opacity.pressed },
            ]}
          >
            <ThemedText type="button" themeColor={selected ? 'onPrimary' : 'text'}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.xs,
    borderRadius: Radius.card,
  },
  option: {
    flex: 1,
    minHeight: Size.touchTargetMin,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.control,
  },
});
