/** "~$1.50/serving" — or null when no estimate exists yet. */
export function formatCostPerServing(cost: number | null): string | null {
  if (cost == null || !isFinite(cost) || cost < 0.005) return null;
  const text = cost >= 9.995 ? `$${Math.round(cost)}` : `$${cost.toFixed(2)}`;
  return `~${text}/serving`;
}
