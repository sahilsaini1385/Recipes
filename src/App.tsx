import { Routes, Route } from "react-router-dom";
import { Header } from "@/components/Header";
import Home from "@/pages/Home";
import RecipePage from "@/pages/RecipePage";
import AddRecipe from "@/pages/AddRecipe";
import EditRecipe from "@/pages/EditRecipe";
import SignIn from "@/pages/SignIn";
import { isSupabaseConfigured } from "@/lib/supabase";

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

export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />;

  return (
    <div className="min-h-screen">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recipe/:slug" element={<RecipePage />} />
        <Route path="/add" element={<AddRecipe />} />
        <Route path="/edit/:slug" element={<EditRecipe />} />
        <Route path="/signin" element={<SignIn />} />
      </Routes>
    </div>
  );
}
