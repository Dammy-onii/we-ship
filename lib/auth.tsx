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
import * as ExpoLinking from 'expo-linking';
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
  /** Emails a recovery link. Succeeds even for an unknown address, by design. */
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  /** True between following a recovery link and choosing a new password. */
  recovering: boolean;
  updatePassword: (password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

/**
 * Where an emailed auth link should come back to.
 *
 * Resolved per platform rather than hard-coded to `weship://`: on web that
 * scheme opens nothing, so `npx expo start --web` could never finish a magic
 * link or a password reset. `createURL` yields the dev server origin on web,
 * the `exp://` host in Expo Go, and `weship://` in a real build — all three are
 * on the redirect allow-list in `supabase/config.toml`.
 *
 * Supabase's own `site_url` stays `weship://auth/callback`, which is what mail
 * sent from the dashboard (with no explicit redirect) uses.
 */
function authRedirectUrl() {
  return ExpoLinking.createURL('/auth/callback');
}

/**
 * Where a recovery email sends the user back to.
 *
 * Carries our own `type=recovery` marker rather than relying on Supabase to
 * add one. Under the PKCE flow every emailed link comes back as `?code=…`
 * regardless of what it was for, and exchanging that code fires `SIGNED_IN` —
 * never `PASSWORD_RECOVERY`. So a reset link signed the user in and dropped
 * them on Home, behaving exactly like a magic link and never offering the new
 * password they came to set.
 */
function recoveryRedirectUrl() {
  return ExpoLinking.createURL('/auth/callback', { queryParams: { type: 'recovery' } });
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [error, setError] = useState<string>();
  const [recovering, setRecovering] = useState(false);

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
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      // A recovery link signs the user straight in, so without this the app
      // would just open normally and never ask for the new password they came
      // to set.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
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
      const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
      // Our own marker on the query string; Supabase's `type` in the fragment
      // covers the implicit flow, which older links still use.
      const isRecovery =
        parsed.searchParams.get('type') === 'recovery' || fragment.get('type') === 'recovery';

      const code = parsed.searchParams.get('code');
      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        // Previously unchecked, so an expired or already-used link looked like
        // it had worked and left the user on the sign-in screen with no reason.
        if (error) throw error;
        if (isRecovery) setRecovering(true);
        return;
      }

      const accessToken = fragment.get('access_token');
      const refreshToken = fragment.get('refresh_token');
      if (accessToken && refreshToken) {
        const { error } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
        if (isRecovery) setRecovering(true);
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
      options: { emailRedirectTo: authRedirectUrl() },
    });
    return error
      ? { error: userFacingError(error, 'Could not send the sign-in link. Please try again.') }
      : { needsEmailConfirmation: true };
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase is not configured.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: recoveryRedirectUrl(),
    });
    return error
      ? { error: userFacingError(error, 'Could not send the reset link. Please try again.') }
      : { needsEmailConfirmation: true };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase is not configured.' };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: userFacingError(error, 'Could not update your password.') };
    setRecovering(false);
    return {};
  }, []);

  const signOut = useCallback(async () => {
    setRecovering(false);
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
      sendPasswordReset,
      recovering,
      updatePassword,
      signOut,
    }),
    [
      error,
      loading,
      recovering,
      sendMagicLink,
      sendPasswordReset,
      session,
      signIn,
      signOut,
      signUp,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within <AuthProvider>');
  return value;
}
