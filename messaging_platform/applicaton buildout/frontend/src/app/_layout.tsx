import { Stack, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';

export default function RootLayout() {
  const router = useRouter();
  return <SafeAreaProvider><AuthProvider><Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="(tabs)" />
    <Stack.Screen name="profile" options={{ headerShown: true, title: 'Profile & account', headerBackTitle: 'Back', headerRight: () => <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} accessibilityRole="button" accessibilityLabel="Close profile" style={{ minHeight: 44, padding: 12, justifyContent: 'center' }}><Text style={{ color: '#4f46e5' }}>Done</Text></Pressable> }} />
    <Stack.Screen name="auth/callback" />
  </Stack></AuthProvider></SafeAreaProvider>;
}
