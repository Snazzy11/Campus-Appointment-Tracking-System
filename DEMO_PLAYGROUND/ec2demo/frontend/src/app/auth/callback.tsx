import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { api, jsonBody } from '../../services/api';
import { completeWebAuth } from '../../services/web-auth';

export default function AuthCallback() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [error, setError] = useState('');
  const completion = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let active = true;
    // Reuse the same exchange during StrictMode's effect setup/cleanup cycle.
    // Cognito authorization codes are single use.
    if (!completion.current) {
      completion.current = completeWebAuth({
        url: window.location.href,
        storage: window.sessionStorage,
        removeQuery: () => window.history.replaceState(window.history.state, '', window.location.pathname),
        exchange: payload => api('/api/auth/session', null, jsonBody(payload)),
        signIn,
      });
    }
    completion.current.then(() => { if (active) router.replace('/'); })
      .catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'Sign-in could not be completed.'); });
    return () => { active = false; };
  }, [router, signIn]);

  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 24 }}>
    {Platform.OS === 'web' && !error ? <ActivityIndicator /> : null}
    <Text accessibilityRole={error ? 'alert' : undefined} style={{ textAlign: 'center' }}>
      {error || (Platform.OS === 'web' ? 'Completing sign-in…' : 'Return to the app to finish sign-in.')}
    </Text>
    <Link href="/">Return to Campus Messaging</Link>
  </View>;
}
