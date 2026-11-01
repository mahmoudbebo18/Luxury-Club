// Session + own profile for the whole app; route guards for members and admins.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Tables } from '../types/database';
import { PageLoader } from '../components/PageLoader';

export type Profile = Tables<'profiles'>;

type Ctx = {
  session: Session | null;
  ready: boolean;
  /** True after arriving from a password-recovery email link (only then may /reset set a password). */
  recovery: boolean;
  profile: Profile | null | undefined; // undefined while loading
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

// supabase-js reads the recovery link from the URL hash before React subscribes, so remember it here.
const arrivedWithRecovery = /type=recovery/.test(location.hash);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(arrivedWithRecovery);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      setSession(next);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        ready,
        recovery,
        profile: userId ? profile : null,
        isAdmin: profile?.role === 'admin',
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready, profile } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />;
  if (profile === undefined) return <PageLoader />;
  return <>{children}</>;
}

/** Member-only pages (card, coupons): the admin account is not a membership, so it goes to /admin. */
export function RequireMember({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  return <RequireAuth>{isAdmin ? <Navigate to="/admin" replace /> : children}</RequireAuth>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, ready, profile, isAdmin } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />;
  if (profile === undefined) return <PageLoader />;
  if (!isAdmin) return <Navigate to="/account" replace />;
  return <>{children}</>;
}
