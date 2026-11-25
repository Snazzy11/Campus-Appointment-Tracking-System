import { StyleSheet, View } from 'react-native';

import { Radius, Size } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

import { Icon } from '@/shared/components/Icon';

// The green circle with a checkmark at the top of Appointment confirmed.
export function SuccessEmblem() {
  const theme = useTheme();

  return (
    <View
      style={[styles.circle, { backgroundColor: theme.successBackground }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Success"
    >
      <Icon name="check" color={theme.success} size={Size.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: Size.successEmblem,
    height: Size.successEmblem,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
