import type { CardRow } from "@/types";
import {
  calculateInsertPosition,
  type Positioned,
} from "@/lib/columns/position";

// Card drag-and-drop position logic. `position` is a float; dropping a card
// inserts a fractional value between its new neighbors instead of shifting
// every row. Same semantics as the column reorder utilities in
// lib/columns/position.ts.

// Given the destination column's ordered cards (excluding the dragged card)
// and the index the dragged card should land at, returns the fractional
// position to write.
export function calculateCardPosition(
  dest: Positioned[],
  targetIndex: number,
): number {
  const clamped = Math.max(0, Math.min(targetIndex, dest.length));
  const prev = clamped > 0 ? dest[clamped - 1].position : null;
  const next = clamped < dest.length ? dest[clamped].position : null;
  return calculateInsertPosition(prev, next);
}

// Computes the target column + position for a card drop.
//   cards         — every card currently on the board
//   activeCardId  — the card being dragged
//   targetColumnId — the column the drag ended over
//   overCardId    — the card the drag ended over, or null if over empty space
// Returns null when the drop leaves the order unchanged (no DB write needed).
export function computeCardMove(
  cards: CardRow[],
  activeCardId: string,
  targetColumnId: string,
  overCardId: string | null,
): { columnId: string; position: number } | null {
  const active = cards.find((c) => c.id === activeCardId);
  if (!active) return null;

  // Dropping a card onto itself is always a no-op.
  if (overCardId === activeCardId) return null;

  const dest = cards
    .filter((c) => c.column_id === targetColumnId && c.id !== activeCardId)
    .sort((a, b) => a.position - b.position);

  let targetIndex: number;
  if (overCardId) {
    const idx = dest.findIndex((c) => c.id === overCardId);
    targetIndex = idx === -1 ? dest.length : idx;
  } else {
    targetIndex = dest.length;
  }

  // The resulting ordered list for the target column after the move.
  const result = [
    ...dest.slice(0, targetIndex),
    active,
    ...dest.slice(targetIndex),
  ];

  // No-op when the card already occupies exactly this position.
  if (active.column_id === targetColumnId) {
    const source = cards
      .filter((c) => c.column_id === active.column_id)
      .sort((a, b) => a.position - b.position);
    const sameOrder =
      source.length === result.length &&
      source.every((c, i) => c.id === result[i]?.id);
    if (sameOrder) return null;
  }

  return {
    columnId: targetColumnId,
    position: calculateCardPosition(dest, targetIndex),
  };
}
