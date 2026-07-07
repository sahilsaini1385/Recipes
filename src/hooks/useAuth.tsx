import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface AuthState {
  session: Session | null;
  /** Signed in AND on the family allowlist (may add/edit recipes). */
  isFamily: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  isFamily: false,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isFamily, setIsFamily] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Keyed on the user id (not the session object) so routine token refreshes
  // don't re-run the check mid-task. On a transient RPC failure we keep the
  // previous answer rather than wrongly demoting a family member.
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      setIsFamily(false);
      return;
    }
    let cancelled = false;
    supabase.rpc("is_family").then(({ data, error }) => {
      if (cancelled || error) return;
      setIsFamily(Boolean(data));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, isFamily, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
