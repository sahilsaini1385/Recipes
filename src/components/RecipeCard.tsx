import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCostPerServing } from "@/lib/cost";
import { photoUrl } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/lib/types";

interface Props {
  recipe: Recipe;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

export function RecipeCard({ recipe, isFavorite, onToggleFavorite }: Props) {
  const photo = photoUrl(recipe.photo_path);

  return (
    <Card className="relative overflow-hidden">
      <Link to={`/recipe/${recipe.slug}`} className="block">
        {photo && (
          <img
            src={photo}
            alt={recipe.title}
            loading="lazy"
            className="h-36 w-full object-cover"
          />
        )}
        <div className="p-3 pr-12">
          <h3 className="font-serif text-lg leading-snug text-ink">
            {recipe.title}
          </h3>
          {recipe.credit && (
            <p className="mt-0.5 text-sm text-ink-soft">{recipe.credit}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge>{recipe.category}</Badge>
            {formatCostPerServing(recipe.cost_per_serving) && (
              <Badge variant="outline">
                {formatCostPerServing(recipe.cost_per_serving)}
              </Badge>
            )}
            {recipe.tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </Link>
      <button
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        onClick={() => onToggleFavorite(recipe.id)}
        className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-paper-warm"
      >
        <Heart
          className={cn(
            "h-5 w-5",
            isFavorite ? "fill-accent text-accent" : "text-ink-faint"
          )}
        />
      </button>
    </Card>
  );
}
