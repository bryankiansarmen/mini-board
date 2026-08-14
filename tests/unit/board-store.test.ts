import { beforeEach, describe, expect, it } from "vitest";
import { useBoardStore } from "@/lib/store/board";
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

describe("useBoardStore", () => {
  beforeEach(() => {
    // Reset to a pristine store between tests.
    useBoardStore.setState({ cards: [] });
  });

  it("starts empty", () => {
    expect(useBoardStore.getState().cards).toEqual([]);
  });

  it("hydrates a card list", () => {
    const cards = [card("a", "col-1", 0), card("b", "col-1", 1)];
    useBoardStore.getState().hydrateCards(cards);
    expect(useBoardStore.getState().cards).toEqual(cards);
  });

  it("moves a card optimistically (column + position)", () => {
    const cards = [
      card("a", "col-1", 0),
      card("b", "col-1", 1),
      card("c", "col-2", 0),
    ];
    useBoardStore.getState().hydrateCards(cards);

    useBoardStore.getState().moveCardOptimistic("b", "col-2", 1.5);

    const moved = useBoardStore.getState().cards.find((c) => c.id === "b");
    expect(moved?.column_id).toBe("col-2");
    expect(moved?.position).toBe(1.5);

    // Other cards untouched.
    const a = useBoardStore.getState().cards.find((c) => c.id === "a");
    expect(a?.column_id).toBe("col-1");
    expect(a?.position).toBe(0);
  });

  it("rolls the whole card list back", () => {
    const before = [card("a", "col-1", 0), card("b", "col-1", 1)];
    const after = [card("a", "col-1", 0), card("b", "col-2", 1.5)];

    useBoardStore.getState().hydrateCards(after);
    useBoardStore.getState().rollbackCards(before);

    expect(useBoardStore.getState().cards).toEqual(before);
  });
});
