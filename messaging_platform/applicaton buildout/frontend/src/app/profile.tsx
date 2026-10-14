import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ProfileEditor } from '../components/ProfileEditor';

export default function Profile() {
  const { user, token, loading } = useAuth();
  if (loading) return <ActivityIndicator accessibilityLabel="Loading your account" style={{ padding: 32 }} />;
  if (user && token) return <ProfileEditor key={user.sub} user={user} token={token} />;
  return <View style={{ flex: 1, padding: 24, gap: 24, backgroundColor: '#f8fafc' }}>
    <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: '700' }}>Welcome to campus</Text>
    <Text style={{ fontSize: 16 }}>Sign in from Messaging to edit your profile.</Text>
    <Link href="/" asChild><Pressable accessibilityRole="button" style={{ padding: 16, borderRadius: 12, backgroundColor: '#4f46e5', alignSelf: 'flex-start' }}><Text style={{ color: 'white', fontWeight: '600' }}>Go to Messaging</Text></Pressable></Link>
  </View>;
}
