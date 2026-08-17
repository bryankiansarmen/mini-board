import { beforeEach, describe, expect, it } from "vitest";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useBoardStore } from "@/lib/store/board";
import type { CardRow, ColumnRow } from "@/types";

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

const column = (
  id: string,
  boardId: string,
  position: number,
): ColumnRow => ({
  id,
  board_id: boardId,
  title: `Column ${id}`,
  position,
  created_at: new Date().toISOString(),
});

function cardPayload(
  eventType: "INSERT" | "UPDATE" | "DELETE",
  row: CardRow | null,
): RealtimePostgresChangesPayload<CardRow> {
  return {
    eventType,
    schema: "public",
    table: "cards",
    commit_timestamp: new Date().toISOString(),
    new: eventType === "DELETE" ? {} : row ?? {},
    old: eventType === "INSERT" ? {} : { id: row?.id ?? "" },
    errors: [],
  } as RealtimePostgresChangesPayload<CardRow>;
}

describe("useBoardStore", () => {
  beforeEach(() => {
    // Reset to a pristine store between tests.
    useBoardStore.setState({ cards: [], columns: [] });
  });

  it("starts empty", () => {
    expect(useBoardStore.getState().cards).toEqual([]);
    expect(useBoardStore.getState().columns).toEqual([]);
  });

  it("hydrates a card list", () => {
    const cards = [card("a", "col-1", 0), card("b", "col-1", 1)];
    useBoardStore.getState().hydrateCards(cards);
    expect(useBoardStore.getState().cards).toEqual(cards);
  });

  it("hydrates a column list", () => {
    const columns = [column("c1", "board-1", 0), column("c2", "board-1", 1)];
    useBoardStore.getState().hydrateColumns(columns);
    expect(useBoardStore.getState().columns).toEqual(columns);
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

  it("reconciles a card INSERT/UPDATE via a Realtime payload", () => {
    useBoardStore
      .getState()
      .hydrateCards([card("a", "col-1", 0), card("b", "col-1", 1)]);

    useBoardStore
      .getState()
      .reconcileCard(cardPayload("UPDATE", card("a", "col-2", 2)));

    const moved = useBoardStore.getState().cards.find((c) => c.id === "a");
    expect(moved?.column_id).toBe("col-2");
    expect(useBoardStore.getState().cards).toHaveLength(2);
  });

  it("reconciles a card DELETE via a Realtime payload", () => {
    useBoardStore
      .getState()
      .hydrateCards([card("a", "col-1", 0), card("b", "col-1", 1)]);

    useBoardStore.getState().reconcileCard(cardPayload("DELETE", card("a", "col-1", 0)));

    expect(useBoardStore.getState().cards.map((c) => c.id)).toEqual(["b"]);
  });
});
