import { describe, expect, it } from "vitest";
import {
  calculateCardPosition,
  computeCardMove,
} from "@/lib/cards/position";
import type { CardRow } from "@/types";

const card = (
  id: string,
  columnId: string,
  position: number,
): CardRow => ({
  id,
  column_id: columnId,
  title: `Card ${id}`,
  description: null,
  position,
  due_date: null,
  assignee_id: null,
  labels: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

describe("calculateCardPosition", () => {
  it("returns 0 for an empty destination", () => {
    expect(calculateCardPosition([], 0)).toBe(0);
  });

  it("inserts at the front of a non-empty destination", () => {
    const dest = [card("a", "col", 0), card("b", "col", 1)];
    expect(calculateCardPosition(dest, 0)).toBe(-1);
  });

  it("inserts at the end of a non-empty destination", () => {
    const dest = [card("a", "col", 0), card("b", "col", 1)];
    expect(calculateCardPosition(dest, 2)).toBe(2);
  });

  it("inserts at the midpoint between two neighbors", () => {
    const dest = [card("a", "col", 0), card("b", "col", 1)];
    expect(calculateCardPosition(dest, 1)).toBe(0.5);
  });
});

describe("computeCardMove", () => {
  it("returns null when the card is unknown", () => {
    const cards = [card("a", "col-1", 0)];
    expect(computeCardMove(cards, "missing", "col-1", null)).toBeNull();
  });

  it("returns null when dropping a card onto itself", () => {
    const cards = [card("a", "col-1", 0), card("b", "col-1", 1)];
    expect(computeCardMove(cards, "a", "col-1", "a")).toBeNull();
  });

  it("moves a card into a different column (append when no over card)", () => {
    const cards = [
      card("a", "col-1", 0),
      card("b", "col-1", 1),
      card("c", "col-2", 0),
    ];
    const move = computeCardMove(cards, "a", "col-2", null);
    expect(move).toEqual({ columnId: "col-2", position: 1 });
  });

  it("moves a card into a different column before an existing card", () => {
    const cards = [
      card("a", "col-1", 0),
      card("b", "col-2", 0),
      card("c", "col-2", 1),
    ];
    const move = computeCardMove(cards, "a", "col-2", "c");
    expect(move).toEqual({ columnId: "col-2", position: 0.5 });
  });

  it("reorders within the same column", () => {
    const cards = [
      card("a", "col-1", 0),
      card("b", "col-1", 1),
      card("c", "col-1", 2),
    ];
    // Drag c to the front (over a).
    const move = computeCardMove(cards, "c", "col-1", "a");
    expect(move).toEqual({ columnId: "col-1", position: -1 });
  });

  it("returns null when the drop does not change the order", () => {
    const cards = [
      card("a", "col-1", 0),
      card("b", "col-1", 1),
      card("c", "col-1", 2),
    ];
    // Dropping b over c, the card immediately after it, lands b back in
    // its current slot, so the order is unchanged: no DB write needed.
    expect(computeCardMove(cards, "b", "col-1", "c")).toBeNull();
  });
});
