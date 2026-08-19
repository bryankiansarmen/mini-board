import { describe, expect, it } from "vitest";
import {
  DRIFT_THRESHOLD,
  detectPositionDrift,
  renormalizePositions,
} from "@/lib/shared/normalize";
import { calculateInsertPosition } from "@/lib/columns/position";
import type { Positioned } from "@/lib/columns/position";

const item = (id: string, position: number): Positioned => ({
  id,
  position,
});

describe("detectPositionDrift", () => {
  it("returns false for empty and single-item position lists", () => {
    expect(detectPositionDrift([])).toBe(false);
    expect(detectPositionDrift([3])).toBe(false);
  });

  it("returns false when every adjacent gap exceeds the threshold", () => {
    expect(detectPositionDrift([0, 1, 2, 5])).toBe(false);
    expect(detectPositionDrift([0, 0.5, 1, 2])).toBe(false);
  });

  it("returns true when two adjacent positions are within the threshold", () => {
    expect(detectPositionDrift([0, 0.0001])).toBe(true);
    expect(detectPositionDrift([0, 1, 1.00005, 2])).toBe(true);
  });

  it("detects drift regardless of input order", () => {
    expect(detectPositionDrift([1.00005, 2, 0, 1])).toBe(true);
  });
});

describe("renormalizePositions", () => {
  it("maps items to whole-integer spacing in position order", () => {
    const items = [
      item("a", 2.5),
      item("b", 0.125),
      item("c", 1.25),
    ];
    expect(renormalizePositions(items)).toEqual([
      { id: "b", position: 0 },
      { id: "c", position: 1 },
      { id: "a", position: 2 },
    ]);
  });

  it("preserves relative order when positions are tied (stable sort)", () => {
    const items = [
      item("x", 1),
      item("y", 1),
      item("z", 1),
    ];
    // Ties keep their input order; re-normalization never reorders items.
    expect(renormalizePositions(items).map(({ id }) => id)).toEqual([
      "x",
      "y",
      "z",
    ]);
  });

  it("is a no-op in terms of relative order for already-integer positions", () => {
    const items = [item("a", 0), item("b", 1), item("c", 2)];
    expect(renormalizePositions(items)).toEqual([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
      { id: "c", position: 2 },
    ]);
  });
});

describe("DoD: 25 cards inserted between the same two neighbors", () => {
  it("triggers re-normalization without changing relative order", () => {
    // Anchor the two neighbors, then repeatedly drop cards at the midpoint
    // between the anchor and the most recently inserted card, exactly how
    // repeated drag/drop between the same two neighbors behaves. Each insert
    // halves the remaining gap; after a handful the gap falls below threshold.
    const neighbors = [item("first", 0), item("last", 1)];
    const cards: Positioned[] = [...neighbors];
    let next = neighbors[1]!.position;
    for (let i = 0; i < 25; i++) {
      const position = calculateInsertPosition(neighbors[0]!.position, next);
      cards.push(item(`card-${i}`, position));
      next = position;
    }

    expect(cards).toHaveLength(27);
    // The exhaustion point has clearly been reached.
    expect(detectPositionDrift(cards.map((card) => card.position))).toBe(true);

    // Relative order is defined by position, not insertion order.
    const expectedOrder = [...cards]
      .sort((a, b) => a.position - b.position)
      .map((card) => card.id);
    const normalized = renormalizePositions(cards);

    // Whole-integer spacing, order untouched.
    expect(normalized.map(({ position }) => position)).toEqual(
      normalized.map((_, i) => i),
    );
    expect(normalized.map(({ id }) => id)).toEqual(expectedOrder);

    // Every resulting gap now comfortably exceeds the threshold, so future
    // midpoint drops have room again.
    const restoredGaps = normalized
      .map(({ position }) => position)
      .slice(1)
      .map((position, i) => position - i);
    expect(Math.min(...restoredGaps)).toBeGreaterThan(DRIFT_THRESHOLD);
  });
});
