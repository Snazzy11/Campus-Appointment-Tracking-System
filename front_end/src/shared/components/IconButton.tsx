import { Pressable, StyleSheet } from 'react-native';

import { Opacity, Radius, Size } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

import { Icon, type IconName } from './Icon';

type IconButtonProps = {
  icon: IconName;
  // Screen readers read this out, because there is no visible text. Example: "Go back".
  accessibilityLabel: string;
  onPress: () => void;
  // plain:  just the icon (back arrow)
  // filled: icon on a light rounded square (saved-places heart on Home)
  variant?: 'plain' | 'filled';
  disabled?: boolean;
};

// A button that shows only an icon. It is always at least 48x48 so it is easy to tap,
// even though the icon itself is smaller.
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'plain',
  disabled = false,
}: IconButtonProps) {
  const theme = useTheme();
  const iconColor = variant === 'filled' ? theme.primary : theme.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        variant === 'filled' && { backgroundColor: theme.backgroundSelected },
        pressed && { opacity: Opacity.pressed },
        disabled && { opacity: Opacity.disabled },
      ]}
    >
      <Icon name={icon} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: Size.touchTargetMin,
    height: Size.touchTargetMin,
    borderRadius: Radius.control,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
