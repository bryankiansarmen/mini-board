import type { Positioned } from "@/lib/columns/position";

// Position re-normalization. `position` is a float; every drag or insert
// between two neighbors halves the gap. Once adjacent positions drift within
// DRIFT_THRESHOLD, further midpoint insertion can no longer be represented
// reliably, so the owning column/board is re-normalized back to whole-integer
// spacing (0, 1, 2, ...) without changing relative order.
export const DRIFT_THRESHOLD = 0.0001;

// True when any two adjacent positions (after sorting) are within
// DRIFT_THRESHOLD of each other. Fewer than two positions can never drift.
export function detectPositionDrift(positions: number[]): boolean {
  if (positions.length < 2) return false;
  const sorted = [...positions].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! - sorted[i - 1]! <= DRIFT_THRESHOLD) return true;
  }
  return false;
}

// Re-normalizes items to whole-integer spacing in position order. Uses a
// stable sort so ties (equal positions) keep their current relative order;
// re-normalization must never reorder cards, only tighten their spacing.
export function renormalizePositions<T extends Positioned>(
  items: T[],
): Array<{ id: string; position: number }> {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((item, index) => ({ id: item.id, position: index }));
}
