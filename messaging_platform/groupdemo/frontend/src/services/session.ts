import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'campus.session';
// Browser sessions intentionally stay in memory instead of exposing credentials in web storage.
let webToken: string | null = null;

export async function readToken(): Promise<string | null> {
  return Platform.OS === 'web' ? webToken : SecureStore.getItemAsync(KEY);
}

export async function writeToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') { webToken = token; return; }
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
}
