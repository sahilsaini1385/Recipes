import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  RecipeForm,
  draftToForm,
  formToDraft,
  type RecipeFormValue,
} from "@/components/RecipeForm";
import { useAuth } from "@/hooks/useAuth";
import { useRecipes } from "@/hooks/useRecipes";
import { updateRecipe } from "@/lib/saveRecipe";

export default function EditRecipe() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { session, isFamily, loading: authLoading } = useAuth();
  const { recipes, loading } = useRecipes();

  const recipe = useMemo(
    () => recipes?.find((r) => r.slug === slug) ?? null,
    [recipes, slug]
  );

  const [form, setForm] = useState<RecipeFormValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (recipe && !form) setForm(draftToForm(recipe));
  }, [recipe, form]);

  if (loading || authLoading) {
    return <p className="mt-10 text-center text-ink-soft">Loading…</p>;
  }
  if (!session || !isFamily) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-ink-soft">
          Editing requires a family sign-in.{" "}
          <Link to="/signin" className="text-accent underline">
            Sign in
          </Link>
        </p>
      </main>
    );
  }
  if (!recipe || !form) {
    return <p className="mt-10 text-center text-ink-soft">Recipe not found.</p>;
  }

  const save = async (photoFile: File | null) => {
    setSaving(true);
    setError(null);
    try {
      const draft = formToDraft(form);
      if (!draft.title) throw new Error("A title is required.");
      const newSlug = await updateRecipe(
        recipe.id,
        draft,
        photoFile,
        recipe.photo_path
      );
      navigate(`/recipe/${newSlug}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-4">
      <h1 className="mb-4 text-2xl">Edit recipe</h1>
      <RecipeForm
        value={form}
        onChange={setForm}
        onSubmit={save}
        submitLabel="Save changes"
        saving={saving}
        error={error}
      />
    </main>
  );
}
