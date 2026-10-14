import { Tabs } from 'expo-router';
import { ProfileButton } from '../../components/ProfileButton';
import { AppIcon, AppIconName } from '../../components/AppIcon';

const destinations: { name: string; title: string; icon: AppIconName }[] = [
  { name: 'schedule', title: 'Schedule', icon: 'schedule' },
  { name: 'maps', title: 'Maps', icon: 'maps' },
  { name: 'index', title: 'Messaging', icon: 'messaging' },
  { name: 'rso', title: 'RSO', icon: 'rso' },
];

export default function TabLayout() {
  return <Tabs initialRouteName="index" backBehavior="history" screenOptions={{
    headerRight: () => <ProfileButton />,
    headerTitleStyle: { fontWeight: '700', color: '#172033' },
    headerStyle: { backgroundColor: '#ffffff' },
    tabBarActiveTintColor: '#4f46e5', tabBarInactiveTintColor: '#64748b',
    tabBarItemStyle: { paddingVertical: 6 },
    tabBarStyle: { minHeight: 72, backgroundColor: '#ffffff', borderTopColor: '#e2e8f0' },
    tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
    tabBarHideOnKeyboard: true,
  }}>
    {destinations.map(item => <Tabs.Screen key={item.name} name={item.name} options={{
      title: item.title,
      tabBarAccessibilityLabel: item.name === 'rso' ? 'Registered student organizations' : item.title,
      tabBarIcon: ({ color }) => <AppIcon name={item.icon} color={color} />,
    }} />)}
  </Tabs>;
}
