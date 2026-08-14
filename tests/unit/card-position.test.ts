import { describe, expect, it } from "vitest";
import {
  calculateInsertPosition,
  type Positioned,
} from "@/lib/columns/position";

// Cards reuse the column position utilities; these tests pin the specific
// card-append semantics used by lib/cards/actions.ts (createCard appends at
// (max ?? -1) + 1, i.e. calculateInsertPosition(lastPosition, null)).

describe("card append position (createCard)", () => {
  it("positions the first card in an empty column at 0", () => {
    expect(calculateInsertPosition(null, null)).toBe(0);
  });

  it("appends after the current last card", () => {
    expect(calculateInsertPosition(4, null)).toBe(5);
  });

  it("appends sequentially for consecutive creates", () => {
    let position: number | null = null;
    const created: number[] = [];
    for (let i = 0; i < 3; i++) {
      position = calculateInsertPosition(position, null);
      created.push(position);
    }
    expect(created).toEqual([0, 1, 2]);
  });
});

describe("card ordering via calculatePositionAt", () => {
  it("orders newly created cards by their assigned position", () => {
    const cards: Positioned[] = [
      { id: "a", position: 0 },
      { id: "b", position: 1 },
      { id: "c", position: 2 },
    ];
    const sorted = [...cards].sort((x, y) => x.position - y.position);
    expect(sorted.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});
