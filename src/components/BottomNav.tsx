import { Link, useLocation } from "react-router-dom";
import { ChefHat, Plane, TreeDeciduous } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Recipes", icon: ChefHat },
  { to: "/passport", label: "Passport", icon: Plane },
  { to: "/tree", label: "Tree", icon: TreeDeciduous },
] as const;

/** Which section a path belongs to (recipes is the catch-all). */
export function sectionFor(pathname: string): string {
  if (pathname.startsWith("/passport")) return "/passport";
  if (pathname.startsWith("/tree")) return "/tree";
  return "/";
}

/** App-style tab bar, phones only — larger screens get links in the header. */
export function BottomNav() {
  const { pathname } = useLocation();
  const section = sectionFor(pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-paper-deep/70 bg-paper/95 backdrop-blur-md sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-16 max-w-3xl items-stretch">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = to === section;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                active ? "text-accent" : "text-ink-faint"
              )}
            >
              <Icon
                className={cn("h-6 w-6", active && "drop-shadow-sm")}
                strokeWidth={active ? 2.4 : 2}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
