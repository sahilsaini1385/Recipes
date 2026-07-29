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
        "inline-flex rounded-full border border-[#dcc9a8] bg-[#fffdf8] p-0.5",
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          aria-pressed={value === opt.key}
          className={cn(
            "h-9 rounded-full px-3 text-sm font-medium",
            value === opt.key
              ? "bg-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
              : "text-ink-soft hover:bg-paper-warm"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
