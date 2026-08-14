import { describe, expect, it } from "vitest";
import {
  calculateInsertPosition,
  calculatePositionAt,
  type Positioned,
} from "@/lib/columns/position";

describe("calculateInsertPosition", () => {
  it("returns 0 for an empty list", () => {
    expect(calculateInsertPosition(null, null)).toBe(0);
  });

  it("inserts before the first item", () => {
    expect(calculateInsertPosition(null, 1)).toBe(0);
  });

  it("inserts after the last item", () => {
    expect(calculateInsertPosition(1, null)).toBe(2);
  });

  it("inserts at the exact midpoint between two neighbors", () => {
    expect(calculateInsertPosition(1, 2)).toBe(1.5);
  });

  it("keeps halving between the same two neighbors (fractional inserts)", () => {
    expect(calculateInsertPosition(1, 1.5)).toBe(1.25);
    expect(calculateInsertPosition(1.25, 1.5)).toBe(1.375);
  });
});

describe("calculatePositionAt", () => {
  const cols: Positioned[] = [
    { id: "a", position: 0 },
    { id: "b", position: 1 },
    { id: "c", position: 2 },
  ];

  it("moves an item to the front", () => {
    // c dragged to index 0 -> order [c, a, b]
    const ordered = [cols[2], cols[0], cols[1]];
    expect(calculatePositionAt(ordered, 0)).toBe(-1);
  });

  it("moves an item to the back", () => {
    // a dragged to index 2 -> order [b, c, a]
    const ordered = [cols[1], cols[2], cols[0]];
    expect(calculatePositionAt(ordered, 2)).toBe(3);
  });

  it("moves an item between two neighbors (midpoint)", () => {
    // a dragged to index 1 -> order [b, a, c]
    const ordered = [cols[1], cols[0], cols[2]];
    expect(calculatePositionAt(ordered, 1)).toBe(1.5);
  });

  it("keeps relative order stable for the non-moved items", () => {
    const ordered = [cols[1], cols[0], cols[2]];
    const newPos = calculatePositionAt(ordered, 1);
    // b stays at 1, a takes 1.5, c stays at 2 -> no ties.
    const positions = new Map(
      ordered.map((c) => [c.id, c.position]),
    );
    positions.set("a", newPos);
    const sorted = [...positions.entries()].sort((x, y) => x[1] - y[1]);
    expect(sorted.map(([id]) => id)).toEqual(["b", "a", "c"]);
  });
});
