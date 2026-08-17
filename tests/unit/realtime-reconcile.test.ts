import { describe, expect, it } from "vitest";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  reconcileCardList,
  reconcileColumnList,
} from "@/lib/realtime/reconcile";
import type { CardRow, ColumnRow } from "@/types";

const card = (
  id: string,
  columnId: string,
  position: number,
  title = `Card ${id}`,
): CardRow => ({
  id,
  column_id: columnId,
  title,
  description: null,
  position,
  due_date: null,
  assignee_id: null,
  labels: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const column = (
  id: string,
  boardId: string,
  position: number,
  title = `Column ${id}`,
): ColumnRow => ({
  id,
  board_id: boardId,
  title,
  position,
  created_at: "2026-01-01T00:00:00.000Z",
});

function cardPayload(
  eventType: "INSERT" | "UPDATE" | "DELETE",
  row: CardRow | null,
): RealtimePostgresChangesPayload<CardRow> {
  return {
    eventType,
    schema: "public",
    table: "cards",
    commit_timestamp: "2026-01-01T00:00:00.000Z",
    new: eventType === "DELETE" ? {} : row ?? {},
    old: eventType === "INSERT" ? {} : { id: row?.id ?? "" },
    errors: [],
  } as RealtimePostgresChangesPayload<CardRow>;
}

function columnPayload(
  eventType: "INSERT" | "UPDATE" | "DELETE",
  row: ColumnRow | null,
): RealtimePostgresChangesPayload<ColumnRow> {
  return {
    eventType,
    schema: "public",
    table: "columns",
    commit_timestamp: "2026-01-01T00:00:00.000Z",
    new: eventType === "DELETE" ? {} : row ?? {},
    old: eventType === "INSERT" ? {} : { id: row?.id ?? "" },
    errors: [],
  } as RealtimePostgresChangesPayload<ColumnRow>;
}

describe("reconcileCardList", () => {
  it("inserts a card it has never seen", () => {
    const start = [card("a", "col-1", 0)];
    const next = reconcileCardList(
      start,
      cardPayload("INSERT", card("b", "col-2", 0)),
    );
    expect(next).toHaveLength(2);
    expect(next.find((c) => c.id === "b")).toMatchObject({ column_id: "col-2" });
  });

  it("updates an existing card in place without duplicating it", () => {
    const start = [card("a", "col-1", 0), card("b", "col-1", 1)];
    const next = reconcileCardList(
      start,
      cardPayload("UPDATE", card("a", "col-2", 2, "Moved")),
    );
    expect(next).toHaveLength(2);
    const moved = next.find((c) => c.id === "a");
    expect(moved).toMatchObject({ column_id: "col-2", position: 2, title: "Moved" });
  });

  it("re-sorts the list by column then position after an insert", () => {
    const start = [card("b", "col-1", 1), card("a", "col-1", 0)];
    const next = reconcileCardList(
      start,
      cardPayload("INSERT", card("c", "col-1", 0.5)),
    );
    expect(next.map((c) => c.id)).toEqual(["a", "c", "b"]);
  });

  it("removes a card on delete", () => {
    const start = [card("a", "col-1", 0), card("b", "col-1", 1)];
    const next = reconcileCardList(start, cardPayload("DELETE", card("a", "col-1", 0)));
    expect(next.map((c) => c.id)).toEqual(["b"]);
  });

  it("is a no-op when deleting an unknown id", () => {
    const start = [card("a", "col-1", 0)];
    const next = reconcileCardList(start, cardPayload("DELETE", card("nope", "col-1", 0)));
    expect(next).toEqual(start);
  });
});

describe("reconcileColumnList", () => {
  it("inserts, updates, and re-sorts columns by position", () => {
    const start = [column("a", "board-1", 1), column("b", "board-1", 0)];
    const afterUpdate = reconcileColumnList(
      start,
      columnPayload("UPDATE", column("a", "board-1", 2, "Renamed")),
    );
    expect(afterUpdate.find((c) => c.id === "a")?.title).toBe("Renamed");
    expect(afterUpdate.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("removes a column on delete and keeps order", () => {
    const start = [column("a", "board-1", 0), column("b", "board-1", 1)];
    const next = reconcileColumnList(start, columnPayload("DELETE", column("a", "board-1", 0)));
    expect(next.map((c) => c.id)).toEqual(["b"]);
  });

  it("returns the same content when a delete targets an unknown id", () => {
    const start = [column("a", "board-1", 0)];
    const next = reconcileColumnList(start, columnPayload("DELETE", column("nope", "board-1", 0)));
    expect(next).toEqual(start);
  });
});
