import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from './Avatar';
import { useAuth } from '../context/AuthContext';
import { api, ApiError, jsonBody } from '../services/api';
import { User } from '../types';

type Props = { user: User; token: string };
export function ProfileEditor({ user, token }: Props) {
  const { updateProfile, expire, signOut } = useAuth();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const [username, setUsername] = useState(user.username || '');
  const [displayName, setDisplayName] = useState(user.display_name || '');
  const [bio, setBio] = useState(user.bio || '');
  const [busy, setBusy] = useState('');
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = username !== (user.username || '') || displayName !== (user.display_name || '') || bio !== (user.bio || '');
  const invalidUsername = username.trim() !== '' && !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim());
  function cancel() {
    setUsername(user.username || ''); setDisplayName(user.display_name || ''); setBio(user.bio || '');
    setError(''); setNotice('Changes discarded.');
  }
  async function perform(label: string, action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(label); setError(''); setNotice('');
    try { await action(); }
    catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) expire();
      else setError(failure instanceof Error ? failure.message : 'Something went wrong. Please try again.');
    } finally { lock.current = false; setBusy(''); }
  }
  function save() {
    if (invalidUsername) return;
    void perform('Saving profile…', async () => {
      const saved = await api<User>('/api/me/profile', token, jsonBody({ username: username.trim() || null, display_name: displayName.trim() || null, bio: bio.trim() }));
      updateProfile(saved); setUsername(saved.username || ''); setDisplayName(saved.display_name || ''); setBio(saved.bio || ''); setNotice('Profile saved.');
    });
  }
  function pickPhoto() {
    void perform('Updating photo…', async () => {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
      if (result.canceled) return;
      const photo = result.assets[0];
      if (!photo.base64) throw new Error('Could not read this photo. Try a JPEG or PNG image.');
      if (photo.base64.length > 4 * Math.ceil(5 * 1024 * 1024 / 3)) throw new Error('Choose a photo smaller than 5 MB.');
      const saved = await api<User>('/api/me/avatar', token, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: photo.base64 });
      updateProfile(saved); setNotice('Profile photo updated.');
    });
  }
  function removePhoto() {
    void perform('Removing photo…', async () => {
      updateProfile(await api<User>('/api/me/avatar/remove', token, { method: 'POST' })); setNotice('Profile photo removed.');
    });
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>Your profile</Text>
        <View style={styles.photoRow}><Avatar profile={user} fallback={user.email} size={80} /><View style={{ gap: 8, flex: 1 }}>
          <Pressable accessibilityRole="button" disabled={!!busy} onPress={pickPhoto} style={styles.secondary}><Text style={styles.link}>Change photo</Text></Pressable>
          {user.avatar_url ? <Pressable accessibilityRole="button" disabled={!!busy} onPress={removePhoto} style={styles.secondary}><Text style={styles.link}>Remove photo</Text></Pressable> : null}
        </View></View>
        <Text style={styles.hint}>Photos save immediately. Choose a still JPEG, PNG, or WebP up to 5 MB. Photos are cropped to a square.</Text>
        <Text style={styles.label}>Username</Text>
        <TextInput accessibilityLabel="Username" autoCapitalize="none" autoCorrect={false} maxLength={30} editable={!busy} value={username} onChangeText={setUsername} placeholder="e.g. carter_s" style={styles.input} />
        <Text style={[styles.hint, invalidUsername && styles.error]}>3–30 letters, numbers, or underscores. Usernames are unique; capitalization doesn’t matter.</Text>
        <Text style={styles.label}>Display name</Text>
        <TextInput accessibilityLabel="Display name" maxLength={80} editable={!busy} value={displayName} onChangeText={setDisplayName} placeholder="How you appear in conversations" style={styles.input} />
        <Text style={styles.label}>About you</Text>
        <TextInput accessibilityLabel="About you" maxLength={300} multiline editable={!busy} value={bio} onChangeText={setBio} placeholder="A little about yourself…" style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]} />
        <Text style={styles.hint}>{bio.length}/300 · Your profile is visible to other members. Photos can be viewed by anyone with their link.</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {busy || notice ? <Text accessibilityLiveRegion="polite" style={styles.hint}>{busy || notice}</Text> : null}
        <Pressable accessibilityRole="button" disabled={!!busy || !dirty || invalidUsername} onPress={save} style={[styles.button, (!!busy || !dirty || invalidUsername) && { opacity: 0.5 }]}><Text style={styles.buttonText}>Save changes</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!!busy || !dirty} onPress={cancel} style={styles.secondary}><Text style={styles.link}>Cancel changes</Text></Pressable>
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.label}>Account</Text>
        <Text selectable style={styles.hint}>{user.email}</Text>
        <Text style={styles.hint}>Your sign-in email is managed by Cognito. Editing your profile doesn’t change it.</Text>
        <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => { void perform('Signing out…', async () => { await signOut(); router.replace('/'); }); }} style={styles.secondary}><Text style={styles.link}>Sign out</Text></Pressable>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', padding: 20, paddingBottom: 40, gap: 20, backgroundColor: '#f8fafc' },
  card: { maxWidth: 560, width: '100%', borderRadius: 20, backgroundColor: 'white', padding: 24, gap: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  title: { color: '#172033', fontWeight: '700', fontSize: 26 }, label: { color: '#172033', fontWeight: '600', fontSize: 16 },
  photoRow: { flexDirection: 'row', gap: 20, alignItems: 'center' },
  hint: { color: '#475569', lineHeight: 21, fontSize: 14 }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 16, color: '#172033' },
  button: { backgroundColor: '#4f46e5', padding: 14, minHeight: 48, borderRadius: 12, alignItems: 'center' }, buttonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  secondary: { padding: 12, minHeight: 44, borderRadius: 10, backgroundColor: '#eef2ff', alignItems: 'center' }, link: { color: '#3730a3', fontWeight: '600' }, error: { color: '#991b1b', lineHeight: 22 },
});
