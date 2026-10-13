import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';
import { useAuth } from '../context/AuthContext';

export function ProfileButton() {
  const { user } = useAuth();
  return <Link href="/profile" asChild>
    <Pressable accessibilityRole="button" accessibilityLabel={user ? 'Open your profile and account settings' : 'Open account and sign-in options'} style={styles.button}>
      <Avatar profile={user} fallback={user?.email} />
    </Pressable>
  </Link>;
}
const styles = StyleSheet.create({
  button: { width: 44, height: 44, marginRight: 12, borderRadius: 22, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#c7d2fe' },
  initial: { color: '#3730a3', fontSize: 19, fontWeight: '700' },
});
