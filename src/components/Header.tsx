import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sectionFor } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const SECTION_LABELS: Record<string, string> = {
  "/": "Recipes",
  "/passport": "Passport",
  "/tree": "Family Tree",
};

export function Header() {
  const { session, isFamily, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const section = sectionFor(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-paper-deep/70 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-serif text-lg font-semibold text-white shadow-sm">
              J
            </span>
            <span className="font-serif text-lg font-semibold leading-tight text-ink">
              Jungman Family
              <span className="block text-xs font-normal uppercase tracking-widest text-accent">
                {SECTION_LABELS[section]}
              </span>
            </span>
          </Link>
          {/* Larger screens navigate here; phones use the bottom tab bar. */}
          <nav className="hidden items-center gap-1 sm:flex">
            {Object.entries(SECTION_LABELS).map(([to, label]) => (
              <Link
                key={to}
                to={to}
                aria-current={to === section ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  to === section
                    ? "bg-accent/10 text-accent-dark"
                    : "text-ink-soft hover:bg-paper-warm hover:text-ink"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          {isFamily && section === "/" && (
            <Button size="sm" onClick={() => navigate("/add")}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add recipe</span>
              <span className="sm:hidden">Add</span>
            </Button>
          )}
          {session ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/signin")}
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
