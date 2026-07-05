import { cn } from "@/lib/utils";
import type { UnitSystem } from "@/lib/units";

interface Props {
  value: UnitSystem;
  onChange: (value: UnitSystem) => void;
  className?: string;
}

export function UnitToggle({ value, onChange, className }: Props) {
  const options: Array<{ key: UnitSystem; label: string }> = [
    { key: "us", label: "US" },
    { key: "metric", label: "Metric" },
  ];
  return (
    <div
      role="group"
      aria-label="Measurement units"
      className={cn(
        "inline-flex rounded-lg border border-paper-deep bg-white p-0.5",
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          aria-pressed={value === opt.key}
          className={cn(
            "h-9 rounded-md px-3 text-sm font-medium",
            value === opt.key
              ? "bg-accent text-white"
              : "text-ink-soft hover:bg-paper-warm"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
