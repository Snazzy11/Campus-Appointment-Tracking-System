import { Text, type TextProps } from 'react-native';

import { TextStyles, type TextStyleName, type ThemeColor } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

export type ThemedTextProps = TextProps & {
  // Which text style from the design to use. Defaults to 'body'.
  type?: TextStyleName;
  // Which theme color to use. Defaults to 'text'.
  themeColor?: ThemeColor;
};

// Use this instead of React Native's <Text> so text follows the design's fonts and
// switches color in dark mode.
export function ThemedText({
  style,
  type = 'body',
  themeColor = 'text',
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  return <Text style={[TextStyles[type], { color: theme[themeColor] }, style]} {...rest} />;
}
