import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';


interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<Awaited<ReturnType<typeof supabase.auth.signUp>>>;
  signIn: (email: string, password: string) => Promise<Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>>;
  signOut: () => Promise<Awaited<ReturnType<typeof supabase.auth.signOut>>>;
  signInWithGoogle: () => Promise<{ data: unknown; error: Error | null }>;
  resetPassword: (email: string) => Promise<Awaited<ReturnType<typeof supabase.auth.resetPasswordForEmail>>>;
  updatePassword: (password: string) => Promise<Awaited<ReturnType<typeof supabase.auth.updateUser>>>;
  isAuthenticated: boolean;
}


const AuthContext = createContext<AuthContextValue | undefined>(undefined);


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
      }
    );


    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });


    return () => subscription.unsubscribe();
  }, []);


  const signUp = useCallback(async (email: string, password: string) => {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
  }, []);


  const signIn = useCallback(async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  }, []);


  const signOut = useCallback(async () => {
    return supabase.auth.signOut();
  }, []);


  const resetPassword = useCallback(async (email: string) => {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  }, []);


  const updatePassword = useCallback(async (password: string) => {
    return supabase.auth.updateUser({ password });
  }, []);


  const signInWithGoogle = useCallback(async () => {
    try {
      const LOVABLE_ORIGIN = 'https://rupeewise-budget.lovable.app';
      const host = window.location.hostname;
      const onLovableHost =
        /(^|\.)lovable\.app$/.test(host) ||
        /(^|\.)lovableproject\.com$/.test(host) ||
        /(^|\.)lovableproject-dev\.com$/.test(host) ||
        /(^|\.)gpt-eng\.com$/.test(host) ||
        /(^|\.)gptengineer\.run$/.test(host);

      // On Lovable-hosted surfaces (or inside the editor preview iframe) the
      // platform serves /~oauth/initiate itself — keep the original flow.
      if (onLovableHost || window.self !== window.top) {
        const redirectUri = host.includes('preview') ? LOVABLE_ORIGIN : window.location.origin;
        const result = await lovable.auth.signInWithOAuth('google', {
          redirect_uri: redirectUri,
        });
        if (result.error) {
          return { data: null, error: result.error };
        }
        return { data: result, error: null };
      }

      // Off-platform hosts (e.g. Netlify) do not serve /~oauth/initiate, so a
      // top-level redirect just reloads the app and silently drops the OAuth
      // attempt. Instead, run Lovable's brokered Google OAuth in a popup on the
      // project's lovable.app origin and complete the Supabase session from
      // the broker's postMessage.
      const state = [...crypto.getRandomValues(new Uint8Array(16))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const params = new URLSearchParams({
        provider: 'google',
        redirect_uri: LOVABLE_ORIGIN,
        state,
        response_mode: 'web_message',
      });
      const width = Math.round(window.screen.width * 0.5);
      const height = Math.round(window.screen.height * 0.6);
      const left = Math.round((window.screen.width - width) / 2);
      const top = Math.round((window.screen.height - height) / 2);
      const popup = window.open(
        `${LOVABLE_ORIGIN}/~oauth/initiate?${params.toString()}`,
        'lovable-oauth',
        `width=${width},height=${height},left=${left},top=${top}`,
      );
      if (!popup) {
        return { data: null, error: new Error('Popup was blocked. Please allow popups for this site and try again.') };
      }

      const response = await new Promise<Record<string, string> | null>((resolve, reject) => {
        const supportedOrigins = ['https://oauth.lovable.app', 'https://lovable.dev', LOVABLE_ORIGIN];
        const cleanup = () => {
          window.clearInterval(timer);
          window.removeEventListener('message', onMessage);
          if (!popup.closed) popup.close();
        };
        const timer = window.setInterval(() => {
          if (popup.closed) {
            cleanup();
            reject(new Error('Sign in was cancelled'));
          }
        }, 500);
        const onMessage = (e: MessageEvent) => {
          if (!supportedOrigins.includes(e.origin)) return;
          const data = e.data as { type?: string; response?: Record<string, string> } | null;
          if (!data || data.type !== 'authorization_response') return;
          cleanup();
          resolve(data.response ?? null);
        };
        window.addEventListener('message', onMessage);
      });

      if (!response) {
        return { data: null, error: new Error('No response received from the sign-in window') };
      }
      if (response.state !== state) {
        return { data: null, error: new Error('Sign-in state mismatch. Please try again.') };
      }
      if (response.error) {
        return { data: null, error: new Error(response.error_description ?? response.error) };
      }
      if (!response.access_token || !response.refresh_token) {
        return { data: null, error: new Error('No tokens received from Google sign-in') };
      }

      const { error } = await supabase.auth.setSession({
        access_token: response.access_token,
        refresh_token: response.refresh_token,
      });
      if (error) {
        return { data: null, error: new Error(error.message) };
      }
      return { data: response, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }, []);


  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    signInWithGoogle,
    resetPassword,
    updatePassword,
    isAuthenticated: !!user,
  }), [loading, resetPassword, session, signIn, signInWithGoogle, signOut, signUp, updatePassword, user]);


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
