import { Link, useNavigate } from "react-router-dom";
import { Plus, LogOut, LogIn, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const { session, isFamily, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-paper-deep/70 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-2 px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-sm">
            <ChefHat className="h-5 w-5" />
          </span>
          <span className="font-serif text-lg font-semibold leading-tight text-ink">
            Jungman Family
            <span className="block text-xs font-normal uppercase tracking-widest text-accent">
              Recipes
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {isFamily && (
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
