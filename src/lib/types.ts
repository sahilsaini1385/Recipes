export interface Ingredient {
  /** The original line, always kept verbatim. */
  raw: string;
  /** Parsed leading number, or null when none was found. */
  quantity: number | null;
  /** Upper end when the source gives a range like "2 to 3". */
  quantity_max?: number | null;
  unit: string | null;
  item: string;
  /** Trailing qualifier like "to taste", "divided". */
  note: string;
  /** True only when quantity is a real number. */
  scalable: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  slug: string;
  category: string;
  credit: string;
  source_url: string | null;
  base_servings: number;
  servings_estimated: boolean;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
  notes: string | null;
  photo_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type RecipeDraft = Omit<
  Recipe,
  "id" | "slug" | "created_by" | "created_at" | "updated_at"
>;
