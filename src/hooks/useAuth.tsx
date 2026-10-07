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

      // Off-platform hosts (e.g. Netlify) do not serve /~oauth/initiate, and
      // the popup brokered against the lovable.app origin no longer relays an
      // authorization_response back — the popup stalls or gets closed and the
      // user sees "Sign in was cancelled". The Supabase project's own Google
      // provider is enabled with this origin allowlisted, so run a plain
      // full-page OAuth redirect instead: Supabase bounces through Google and
      // returns to <origin>/auth with the session, which supabase-js picks up
      // from the URL hash automatically.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) {
        return { data: null, error: new Error(error.message) };
      }
      // The browser is navigating away to Google; nothing else to do here.
      return { data: {}, error: null };
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
