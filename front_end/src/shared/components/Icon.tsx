import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { Size } from '@/shared/constants/theme';

// SymbolView takes a different icon name per platform:
// iOS uses SF Symbols, Android and web use Google's Material Symbols.
type PlatformIconNames = Extract<SymbolViewProps['name'], object>;

// Every icon the app uses. To add one, find the SF Symbol name (Apple's "SF Symbols" app)
// and the Material Symbol name (https://fonts.google.com/icons), then add a line here.
const ICONS = {
  home: { ios: 'house', android: 'home', web: 'home' },
  map: { ios: 'map', android: 'map', web: 'map' },
  schedule: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  clubs: { ios: 'person.2', android: 'group', web: 'group' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  back: { ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' },
  heart: { ios: 'heart', android: 'favorite', web: 'favorite' },
  arrowRight: { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  north: { ios: 'arrow.up', android: 'north', web: 'north' },
} satisfies Record<string, PlatformIconNames>;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  color: string;
  size?: number;
};

// Shows one icon from the list above. Icons are decorative: put the accessible label on the
// button around the icon, not on the icon itself.
export function Icon({ name, color, size = Size.icon }: IconProps) {
  return (
    <SymbolView
      name={ICONS[name]}
      tintColor={color}
      size={size}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
