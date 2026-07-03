import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  servings: number;
  baseServings: number;
  estimated: boolean;
  onChange: (servings: number) => void;
}

const MULTIPLIERS: Array<{ label: string; factor: number }> = [
  { label: "×0.5", factor: 0.5 },
  { label: "×2", factor: 2 },
  { label: "×3", factor: 3 },
];

export function ServingsControl({
  servings,
  baseServings,
  estimated,
  onChange,
}: Props) {
  const clamp = (n: number) => Math.min(999, Math.max(1, Math.round(n)));

  return (
    <div className="rounded-xl border border-paper-deep bg-paper-warm p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-soft">
          Servings
          {estimated && (
            <Badge variant="outline" className="ml-2">
              servings estimated
            </Badge>
          )}
        </span>
        {servings !== baseServings && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(baseServings)}
          >
            <RotateCcw className="h-4 w-4" />
            Reset to original
          </Button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Fewer servings"
          onClick={() => onChange(clamp(servings - 1))}
        >
          <Minus className="h-5 w-5" />
        </Button>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          value={servings}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= 1) onChange(clamp(n));
          }}
          className="h-11 w-16 rounded-lg border border-paper-deep bg-white text-center text-lg font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Number of servings"
        />
        <Button
          variant="secondary"
          size="icon"
          aria-label="More servings"
          onClick={() => onChange(clamp(servings + 1))}
        >
          <Plus className="h-5 w-5" />
        </Button>
        <div className="ml-1 flex gap-1">
          {MULTIPLIERS.map((m) => (
            <Button
              key={m.label}
              variant="outline"
              size="sm"
              onClick={() => onChange(clamp(baseServings * m.factor))}
            >
              {m.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
