export type Positioned = { id: string; position: number };

// Fractional position insertion logic. `position` is a float; reordering
// inserts a value between two neighbors instead of shifting every row.
// When two neighbors drift within 0.0001 the app re-normalizes.
//
//   calculateInsertPosition(null, 1)  -> 0   (insert before first)
//   calculateInsertPosition(1, null)  -> 2   (insert after last)
//   calculateInsertPosition(1, 2)     -> 1.5 (insert between)
//   calculateInsertPosition(null, null) -> 0  (empty list)

export function calculateInsertPosition(
  prev: number | null,
  next: number | null,
): number {
  if (prev === null && next === null) {
    return 0;
  }
  if (prev === null) {
    return next! - 1;
  }
  if (next === null) {
    return prev + 1;
  }
  return (prev + next) / 2;
}

// Given the full ordered list (with the moved item already at `index`),
// returns the position the item at `index` should take so it sorts between
// its new neighbors. `ordered` must be sorted by position.
export function calculatePositionAt(
  ordered: Positioned[],
  index: number,
): number {
  const prev = index > 0 ? (ordered[index - 1]?.position ?? null) : null;
  const next =
    index < ordered.length - 1 ? (ordered[index + 1]?.position ?? null) : null;
  return calculateInsertPosition(prev, next);
}
