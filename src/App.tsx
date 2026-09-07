import { useEffect } from "react";
import { Routes, Route, useLocation, Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import Home from "@/pages/Home";
import RecipePage from "@/pages/RecipePage";
import AddRecipe from "@/pages/AddRecipe";
import EditRecipe from "@/pages/EditRecipe";
import SignIn from "@/pages/SignIn";
import Passport from "@/pages/Passport";
import FamilyTree from "@/pages/FamilyTree";
import Trips from "@/pages/Trips";
import TripPage from "@/pages/TripPage";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

function SetupNotice() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl mb-4">Setup needed</h1>
      <p className="text-ink-soft">
        Set <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
        <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> environment
        variables, then rebuild. See the README for the full setup guide.
      </p>
    </div>
  );
}

/** Anything that isn't a real page. Without this, a mistyped or stale link
 *  painted the header and tab bar with nothing in between. */
function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="font-serif text-5xl text-accent/40">?</p>
      <h1 className="mt-4 font-serif text-2xl">This page isn't here</h1>
      <p className="mt-2 text-ink-soft">
        The link may be old, or the recipe may have been renamed.
      </p>
      <Link to="/" className={cn(buttonVariants(), "mt-6")}>
        Back to the recipes
      </Link>
    </main>
  );
}

export default function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    const section = pathname.startsWith("/passport")
      ? "Passport"
      : pathname.startsWith("/tree")
        ? "Family Tree"
        : pathname.startsWith("/trips")
          ? "Trips"
          : "Recipes";
    document.title = `Jungman Family · ${section}`;
  }, [pathname]);

  if (!isSupabaseConfigured) return <SetupNotice />;

  return (
    // Bottom padding keeps content clear of the phone tab bar.
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recipe/:slug" element={<RecipePage />} />
        <Route path="/add" element={<AddRecipe />} />
        <Route path="/edit/:slug" element={<EditRecipe />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/trips/:id" element={<TripPage />} />
        <Route path="/passport" element={<Passport />} />
        <Route path="/tree" element={<FamilyTree />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
