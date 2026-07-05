import { useState } from "react";
import type { UnitSystem } from "@/lib/units";

const KEY = "unit-system";

/** US/metric display preference, remembered per device. */
export function useUnitSystem(): [UnitSystem, (u: UnitSystem) => void] {
  const [system, setSystem] = useState<UnitSystem>(() => {
    const stored = localStorage.getItem(KEY);
    return stored === "metric" ? "metric" : "us";
  });
  const set = (u: UnitSystem) => {
    setSystem(u);
    localStorage.setItem(KEY, u);
  };
  return [system, set];
}
