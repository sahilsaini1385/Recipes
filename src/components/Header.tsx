import { Link, useNavigate } from "react-router-dom";
import { Plus, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const { session, isFamily, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-paper-deep bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
        <Link to="/" className="font-serif text-lg font-semibold text-ink">
          Jungman Family Recipes
        </Link>
        <div className="flex items-center gap-1">
          {isFamily && (
            <Button size="sm" onClick={() => navigate("/add")}>
              <Plus className="h-4 w-4" />
              Add recipe
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
