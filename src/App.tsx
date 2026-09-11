import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, useLocation, Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import Home from "@/pages/Home";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Home stays eager: it is what opens when somebody taps the bookmark, and
// lazy-loading it would only add a flash of nothing.
//
// Everything else loads on demand. A phone opening a recipe was downloading
// the family-tree layout engine, the document parsers behind the importer and
// the places browser too, all in one chunk it would never use on that visit.
const RecipePage = lazy(() => import("@/pages/RecipePage"));
const AddRecipe = lazy(() => import("@/pages/AddRecipe"));
const EditRecipe = lazy(() => import("@/pages/EditRecipe"));
const SignIn = lazy(() => import("@/pages/SignIn"));
const Passport = lazy(() => import("@/pages/Passport"));
const FamilyTree = lazy(() => import("@/pages/FamilyTree"));
const Trips = lazy(() => import("@/pages/Trips"));
const TripPage = lazy(() => import("@/pages/TripPage"));
const Places = lazy(() => import("@/pages/Places"));
const Shopping = lazy(() => import("@/pages/Shopping"));

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
    const section = pathname.startsWith("/shopping")
      ? "Shopping list"
      : pathname.startsWith("/passport")
      ? "Passport"
      : pathname.startsWith("/tree")
        ? "Family Tree"
        : pathname.startsWith("/places")
          ? "Places"
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
      <Suspense
        fallback={<p className="mt-10 text-center text-ink-soft">Loading…</p>}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recipe/:slug" element={<RecipePage />} />
          <Route path="/add" element={<AddRecipe />} />
          <Route path="/edit/:slug" element={<EditRecipe />} />
          <Route path="/shopping" element={<Shopping />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/trips/:id" element={<TripPage />} />
          <Route path="/places" element={<Places />} />
          <Route path="/passport" element={<Passport />} />
          <Route path="/tree" element={<FamilyTree />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <BottomNav />
    </div>
  );
}
