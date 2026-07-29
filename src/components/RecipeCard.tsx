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
    <Card className="group relative overflow-hidden border-[#dcc9a8] bg-[#fffdf8] shadow-[0_1px_2px_rgba(78,59,33,0.06),0_6px_16px_-6px_rgba(78,59,33,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_2px_4px_rgba(78,59,33,0.07),0_10px_24px_-6px_rgba(191,87,0,0.16)]">
      <Link to={`/recipe/${recipe.slug}`} className="block">
        {!photo && (
          <div className="flex items-center border-b border-dashed border-[#dcc9a8] bg-paper-warm/50 px-3.5 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-dark/70">
              {recipe.category}
            </span>
          </div>
        )}
        {photo && (
          <div className="relative h-40 w-full overflow-hidden">
            <img
              src={photo}
              alt={recipe.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#2b2317]/25 via-transparent to-transparent" />
            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(43,35,23,0.10)]" />
            <span className="absolute left-2 top-2">
              <Badge className="border border-[#dcc9a8]/70 bg-[#fffdf8]/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-dark shadow-sm backdrop-blur-[2px]">
                {recipe.category}
              </Badge>
            </span>
          </div>
        )}
        <div className="p-3.5 pr-12">
          <h3 className="font-serif text-lg font-medium leading-snug text-ink">
            {recipe.title}
          </h3>
          {recipe.credit && (
            <p className="mt-0.5 font-serif text-[13px] italic text-ink-soft">
              {recipe.credit}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {cost && (
              <span className="rounded-full border border-[#dcc9a8]/80 bg-paper/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-soft">
                {cost}
              </span>
            )}
            {recipe.tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="secondary" className="border border-[#dcc9a8]/50">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </Link>
      <button
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        onClick={() => onToggleFavorite(recipe.id)}
        className="absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-colors hover:border-[#dcc9a8] hover:bg-[#fae7d4]/70"
      >
        <Heart
          className={cn(
            "h-5 w-5 transition-all",
            isFavorite
              ? "scale-110 fill-accent text-accent"
              : "text-ink-faint/80 group-hover:text-accent/60"
          )}
        />
      </button>
    </Card>
  );
}
