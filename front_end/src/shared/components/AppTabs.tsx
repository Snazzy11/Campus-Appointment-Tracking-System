import { Link, usePathname, type Href } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderWidth, Opacity, Radius, Size, Spacing, TextStyles } from '@/shared/constants/theme';
import { useIsWideScreen } from '@/shared/hooks/useIsWideScreen';
import { useTheme } from '@/shared/hooks/useTheme';

import { Icon, type IconName } from './Icon';
import { ThemedText } from './ThemedText';

// The five tabs, in order. `name` matches a file in src/app/(tabs)/.
const TABS: { name: string; title: string; icon: IconName; href: Href }[] = [
  { name: 'home', title: 'Home', icon: 'home', href: '/home' },
  { name: 'map', title: 'Map', icon: 'map', href: '/map' },
  { name: 'schedule', title: 'Schedule', icon: 'schedule', href: '/schedule' },
  { name: 'clubs', title: 'Clubs', icon: 'clubs', href: '/clubs' },
  { name: 'settings', title: 'Settings', icon: 'settings', href: '/settings' },
];

// The app's main navigation.
// - Phones and narrow browser windows: a tab bar at the bottom (as in the Figma design).
// - Wide screens (laptops, tablets): a sidebar on the left (our addition for the web).
export default function AppTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isWide = useIsWideScreen();

  return (
    <Tabs
      // "history" makes the back button return to the tab you came from (e.g. Saved places -> Map).
      backBehavior="history"
      // On wide screens, draw our own Sidebar instead of the bottom bar.
      tabBar={isWide ? () => <Sidebar /> : undefined}
      screenOptions={{
        headerShown: false,
        // 'left' puts the Sidebar to the left of the screen instead of below it.
        tabBarPosition: isWide ? 'left' : 'bottom',
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
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }: { focused: boolean }) => (
              <TabIcon icon={tab.icon} focused={focused} />
            ),
          }}
        />
      ))}

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

// The navigation sidebar shown on wide screens.
function Sidebar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // The current URL, e.g. "/schedule". Used to highlight the matching tab.
  const pathname = usePathname();

  return (
    <View
      style={[
        styles.sidebar,
        {
          backgroundColor: theme.backgroundElement,
          borderRightColor: theme.border,
          paddingTop: Spacing.xxl + insets.top,
        },
      ]}
      accessibilityRole="tablist"
    >
      <ThemedText type="hero" themeColor="primary" style={styles.brand}>
        CATS
      </ThemedText>

      {TABS.map((tab) => {
        const focused = pathname === tab.href;
        const color = focused ? theme.primary : theme.textSecondary;
        return (
          // Link makes each item a real link in the browser (right-click, open in new tab).
          <Link key={tab.name} href={tab.href} asChild>
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={tab.title}
              accessibilityState={{ selected: focused }}
              style={({ pressed }) => [
                styles.sidebarItem,
                focused && { backgroundColor: theme.backgroundSelected },
                pressed && { opacity: Opacity.pressed },
              ]}
            >
              <Icon name={tab.icon} color={color} size={Size.iconSmall} />
              <ThemedText type="rowTitle" style={{ color }}>
                {tab.title}
              </ThemedText>
            </Pressable>
          </Link>
        );
      })}
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
  sidebar: {
    width: Size.sidebarWidth,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.xs,
    borderRightWidth: BorderWidth.default,
  },
  brand: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: Size.touchTargetMin,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.control,
  },
});
