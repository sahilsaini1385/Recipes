import { Link } from "react-router-dom";
import { Compass, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function AppHeader() {
  const { session, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-20 border-b border-paper-deep/70 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white">
            <Compass size={18} />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">
            Waypoint
          </span>
        </Link>
        {isSupabaseConfigured &&
          (session ? (
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
            >
              <LogOut size={15} /> Sign out
            </button>
          ) : (
            <Link
              to="/signin"
              className="text-sm font-medium text-accent hover:text-accent-dark"
            >
              Sign in
            </Link>
          ))}
      </div>
    </header>
  );
}
