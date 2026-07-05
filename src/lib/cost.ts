/** "~$1.50/serving" — or null when no estimate exists yet. */
export function formatCostPerServing(cost: number | null): string | null {
  if (cost == null || !isFinite(cost) || cost <= 0) return null;
  const text = cost >= 10 ? `$${Math.round(cost)}` : `$${cost.toFixed(2)}`;
  return `~${text}/serving`;
}
