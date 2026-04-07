import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

WebBrowser.maybeCompleteAuthSession();
const E2E_AUTH_STORAGE_KEY = 'eu-david:e2e-auth-user';

function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getE2EUser(): User | null {
  if (process.env.EXPO_PUBLIC_E2E !== '1' || Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(E2E_AUTH_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<User> & { id?: string; email?: string };
    if (typeof parsed.id !== 'string' || parsed.id.length === 0) return null;

    return {
      id: parsed.id,
      email: parsed.email ?? 'e2e@example.com',
      app_metadata: parsed.app_metadata ?? {},
      user_metadata: parsed.user_metadata ?? {},
      aud: parsed.aud ?? 'authenticated',
      created_at: parsed.created_at ?? new Date(0).toISOString(),
    } as User;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const e2eUser = getE2EUser();
    if (e2eUser) {
      setSession({ user: e2eUser } as Session);
      setUser(e2eUser);
      setLoading(false);
      return () => undefined;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch(() => {
        // Session check failed — treat as unauthenticated
      })
      .finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    router.replace('/(tabs)');
  }

  async function signUp(email: string, password: string, username?: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username?.trim() || null } },
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  async function signInWithGoogle() {
    const redirectTo = Platform.OS === 'web' ? window.location.origin : 'eu-david://';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Could not start Google authentication.');

    if (Platform.OS === 'web') {
      window.location.assign(data.url);
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      throw new Error('Google sign-in was canceled.');
    }

    const { queryParams } = Linking.parse(result.url);
    const code = firstParam(queryParams?.code);
    if (typeof code === 'string' && code.length > 0) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      await WebBrowser.dismissBrowser();
      return;
    }

    const fragment = result.url.includes('#') ? result.url.split('#')[1] : '';
    const fragmentParams = new URLSearchParams(fragment);
    const accessToken =
      firstParam(queryParams?.access_token) ?? fragmentParams.get('access_token') ?? undefined;
    const refreshToken =
      firstParam(queryParams?.refresh_token) ?? fragmentParams.get('refresh_token') ?? undefined;

    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
      throw new Error('Could not complete Google sign-in.');
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw sessionError;
    await WebBrowser.dismissBrowser();
  }

  return { session, user, loading, signIn, signUp, signOut, signInWithGoogle };
}
