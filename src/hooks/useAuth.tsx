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
  const [sessionChecked, setSessionChecked] = useState(false);
  // The allowlist check is a second round-trip. Until it lands we are still
  // loading -- otherwise a family member briefly renders as an outsider and
  // gets told they aren't on the list.
  const [familyChecked, setFamilyChecked] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSessionChecked(true);
      setFamilyChecked(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
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
      setFamilyChecked(sessionChecked);
      return;
    }
    let cancelled = false;
    setFamilyChecked(false);
    const check = async (attempt: number): Promise<void> => {
      const { data, error } = await supabase.rpc("is_family");
      if (cancelled) return;
      if (error) {
        // One retry covers a dropped connection; after that keep whatever we
        // last knew rather than wrongly demoting a family member.
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          if (!cancelled) await check(1);
          return;
        }
        setFamilyChecked(true);
        return;
      }
      setIsFamily(Boolean(data));
      setFamilyChecked(true);
    };
    void check(0);
    return () => {
      cancelled = true;
    };
  }, [userId, sessionChecked]);

  const loading = !sessionChecked || !familyChecked;

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
