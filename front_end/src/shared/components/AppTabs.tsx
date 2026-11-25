import { Tabs } from 'expo-router/tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Size, Spacing, TextStyles } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

import { Icon, type IconName } from './Icon';

// The bottom tab bar, used on phones and in the browser.
// Each <Tabs.Screen name="..."> matches a file in src/app/(tabs)/.
export default function AppTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      // "history" makes the back button return to the tab you came from (e.g. Saved places -> Map).
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: TextStyles.tabLabel,
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
          // The bar is 70 tall, plus the space phones need for the home indicator.
          height: Size.tabBarMinHeight + insets.bottom,
          paddingTop: Spacing.sm,
        },
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Tabs.Screen name="home" options={tabOptions('Home', 'home')} />
      <Tabs.Screen name="map" options={tabOptions('Map', 'map')} />
      <Tabs.Screen name="schedule" options={tabOptions('Schedule', 'schedule')} />
      <Tabs.Screen name="clubs" options={tabOptions('Clubs', 'clubs')} />
      <Tabs.Screen name="settings" options={tabOptions('Settings', 'settings')} />

      {/* Saved places is not a tab, but the design keeps the tab bar visible on it, so it lives
          inside the tabs with no button in the bar. Don't use `href: null` here: in Expo Router 58
          that marks the tab "hidden", and hidden tabs redirect to Home when you open them. */}
      <Tabs.Screen
        name="saved-places"
        options={{ title: 'Saved places', tabBarButton: () => null }}
      />
    </Tabs>
  );
}

// The title and icon for one tab.
function tabOptions(title: string, icon: IconName) {
  return {
    title,
    tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon={icon} focused={focused} />,
  };
}

type TabIconProps = {
  icon: IconName;
  focused: boolean;
};

// The selected tab's icon sits on a light rounded "pill", as in the design.
function TabIcon({ icon, focused }: TabIconProps) {
  const theme = useTheme();
  // Same colors as the tab labels (tabBarActiveTintColor / tabBarInactiveTintColor above).
  const color = focused ? theme.primary : theme.textSecondary;

  return (
    <View style={[styles.iconPill, focused && { backgroundColor: theme.backgroundSelected }]}>
      <Icon name={icon} color={color} size={Size.iconSmall} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    width: Size.tabIconPillWidth,
    height: Size.tabIconPillHeight,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
