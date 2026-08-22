import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Linking } from 'react-native';
import type { GenderKey } from './gender';


import { isBackendConfigured } from './backend/config';
import { supabase } from './backend/supabase';
import { userFacingError } from './user-facing-error';

type AuthResult = { error?: string; needsEmailConfirmation?: boolean };

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: SupabaseUser | null;
  error?: string;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: {
    email: string;
    password: string;
    displayName: string;
    gender?: GenderKey;
  }) => Promise<AuthResult>;
  sendMagicLink: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    const consumeAuthUrl = async (url: string) => {
      const parsed = new URL(url);
      const code = parsed.searchParams.get('code');
      if (code) {
        await client.auth.exchangeCodeForSession(code);
        return;
      }
      const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
      const accessToken = fragment.get('access_token');
      const refreshToken = fragment.get('refresh_token');
      if (accessToken && refreshToken) {
        await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    };

    Linking.getInitialURL()
      .then((url) => { if (url) return consumeAuthUrl(url); })
      .catch((cause) => setError(userFacingError(cause, 'That sign-in link could not be opened.')));
    const subscription = Linking.addEventListener('url', ({ url }) => {
      consumeAuthUrl(url)
        .then(() => setError(undefined))
        .catch((cause) => setError(userFacingError(cause, 'That sign-in link could not be opened.')));
    });
    return () => subscription.remove();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase is not configured.' };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: userFacingError(error, 'Could not sign in. Please try again.') } : {};
  }, []);

  const signUp = useCallback(
    async ({
      email,
      password,
      displayName,
      gender,
    }: {
      email: string;
      password: string;
      displayName: string;
      gender?: GenderKey;
    }) => {
      if (!supabase) return { error: 'Supabase is not configured.' };
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // `handle_new_user` reads these off the auth metadata to seed the profile.
        options: { data: { display_name: displayName.trim(), gender: gender ?? null } },
      });
      if (error) return { error: userFacingError(error, 'Could not create your account. Please try again.') };
      return { needsEmailConfirmation: !data.session };
    },
    [],
  );

  const sendMagicLink = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase is not configured.' };
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: 'weship://auth/callback' },
    });
    return error
      ? { error: userFacingError(error, 'Could not send the sign-in link. Please try again.') }
      : { needsEmailConfirmation: true };
  }, []);

  const signOut = useCallback(async () => {
    // Clear the cached Space first: it must never outlive the session that
    // produced it, or the next person to sign in on this device could see it.
    const { clearSnapshot } = await import('./offline-cache');
    await clearSnapshot();
    await supabase?.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isBackendConfigured,
      loading,
      session,
      user: session?.user ?? null,
      error,
      signIn,
      signUp,
      sendMagicLink,
      signOut,
    }),
    [error, loading, sendMagicLink, session, signIn, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within <AuthProvider>');
  return value;
}
