import { createContext, useCallback, useContext, useEffect, useState, PropsWithChildren } from 'react';
import { api, ApiError } from '../services/api';
import { readToken, writeToken } from '../services/session';
import { User } from '../types';

type AuthState = {
  token: string | null; user: User | null; loading: boolean; error: string;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  expire: () => void;
  clearError: () => void;
};
const Context = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const saved = await readToken();
        if (saved) {
          const account = await api<User>('/api/me', saved);
          if (active) { setToken(saved); setUser(account); }
        }
      } catch (failure) {
        if (failure instanceof ApiError && failure.status === 401) await writeToken(null);
        else if (active) setError(failure instanceof Error ? failure.message : 'Could not restore login');
      } finally { if (active) setLoading(false); }
    }
    void restore();
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (value: string) => {
    const account = await api<User>('/api/me', value);
    await writeToken(value);
    setToken(value); setUser(account); setError('');
  }, []);
  const expire = useCallback(() => {
    setToken(null); setUser(null);
    void writeToken(null).catch(failure => setError(String(failure)));
  }, []);
  const signOut = useCallback(async () => {
    let revokeError: unknown;
    try { if (token) await api('/api/auth/logout', token, { method: 'POST' }); }
    catch (failure) {
      if (!(failure instanceof ApiError && failure.status === 401)) revokeError = failure;
    }
    // Always clear the device session, even if the API cannot currently revoke it.
    await writeToken(null);
    setToken(null); setUser(null);
    if (revokeError) setError('Signed out locally. The server session could not be revoked and will expire automatically.');
    else setError('');
  }, [token]);
  const clearError = useCallback(() => setError(''), []);
  return <Context.Provider value={{ token, user, loading, error, signIn, signOut, expire, clearError }}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
