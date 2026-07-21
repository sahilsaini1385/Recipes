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
  const cost = formatCostPerServing(recipe.cost_per_serving);

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-card-hover">
      <Link to={`/recipe/${recipe.slug}`} className="block">
        {photo ? (
          <div className="relative h-40 w-full overflow-hidden">
            <img
              src={photo}
              alt={recipe.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute left-2 top-2">
              <Badge className="bg-accent text-white shadow-sm">
                {recipe.category}
              </Badge>
            </span>
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center bg-gradient-to-br from-paper-warm to-paper-deep">
            <span className="font-serif text-3xl text-accent/30">
              {recipe.title.charAt(0)}
            </span>
          </div>
        )}
        <div className="p-3.5 pr-12">
          <h3 className="font-serif text-lg font-medium leading-snug text-ink">
            {recipe.title}
          </h3>
          {recipe.credit && (
            <p className="mt-0.5 text-sm text-ink-soft">{recipe.credit}</p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {!photo && <Badge>{recipe.category}</Badge>}
            {cost && (
              <span className="text-xs font-medium text-ink-faint">{cost}</span>
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
        className="absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent-soft"
      >
        <Heart
          className={cn(
            "h-5 w-5 transition-all",
            isFavorite
              ? "scale-110 fill-accent text-accent"
              : "text-ink-faint group-hover:text-accent/60"
          )}
        />
      </button>
    </Card>
  );
}
