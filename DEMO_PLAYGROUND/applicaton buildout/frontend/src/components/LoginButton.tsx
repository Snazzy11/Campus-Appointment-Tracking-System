import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform, Pressable, Text } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { api, jsonBody } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { beginWebAuth } from '../services/web-auth';
import { AuthConfig } from '../types';

export function LoginButton({ config, onError, compact = false }: { config: AuthConfig; onError: (error: string) => void; compact?: boolean }) {
  const { signIn } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'campusmessaging', path: 'auth/callback' });
  const [request, , promptAsync] = AuthSession.useAuthRequest({
    clientId: config.client_id, redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ['openid', 'email', 'profile'], usePKCE: true, prompt: AuthSession.Prompt.Login,
  }, { authorizationEndpoint: `${config.domain}/oauth2/authorize` });

  async function login() {
    if (Platform.OS !== 'web' && Constants.appOwnership === 'expo') {
      onError('Cognito sign-in needs a development build. Expo Go can preview public chat.');
      return;
    }
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        if (!request?.codeVerifier) throw new Error('Login is not ready. Please try again.');
        const authorizationUrl = request.url || await request.makeAuthUrlAsync({
          authorizationEndpoint: `${config.domain}/oauth2/authorize`,
        });
        const url = beginWebAuth(authorizationUrl, {
          state: request.state, codeVerifier: request.codeVerifier, redirectUri,
        }, window.sessionStorage);
        window.location.assign(url);
        return;
      }
      const result = await promptAsync();
      if (result.type === 'error') throw new Error(result.error?.message || 'Cognito login failed');
      if (result.type !== 'success') return;
      if (!request?.codeVerifier || result.params.state !== request.state) throw new Error('Invalid OAuth login state');
      const session = await api<{ session_token: string }>('/api/auth/session', null, jsonBody({
        code: result.params.code, code_verifier: request.codeVerifier, redirect_uri: redirectUri,
      }));
      await signIn(session.session_token);
      router.replace('/');
    } catch (failure) { onError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setBusy(false); }
  }
  return <Pressable accessibilityRole="button" disabled={!request || busy} onPress={() => void login()}
    style={{ backgroundColor: '#4f46e5', padding: 12, borderRadius: 10, opacity: !request || busy ? 0.5 : 1 }}>
    <Text style={{ color: 'white', fontWeight: '600' }}>{busy ? 'Signing in…' : compact ? 'Sign in' : 'Sign in with Cognito'}</Text>
  </Pressable>;
}
