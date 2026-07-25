import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export function Header() {
  const { session, isFamily, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inPassport = pathname.startsWith("/passport");

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
                {inPassport ? "Passport" : "Recipes"}
              </span>
            </span>
          </Link>
          {/* Larger screens navigate here; phones use the bottom tab bar. */}
          <nav className="hidden items-center gap-1 sm:flex">
            {(
              [
                ["/", "Recipes", !inPassport],
                ["/passport", "Passport", inPassport],
              ] as const
            ).map(([to, label, active]) => (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
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
          {isFamily && !inPassport && (
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
