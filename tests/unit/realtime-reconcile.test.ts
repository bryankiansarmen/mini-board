import { describe, expect, it } from "vitest";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  reconcileCardList,
  reconcileChecklistItems,
  reconcileColumnList,
  reconcileComments,
  reconcileActivities,
} from "@/lib/realtime/reconcile";
import type {
  ActivityLogRow,
  CardRow,
  ChecklistItemRow,
  ColumnRow,
  CommentRow,
} from "@/types";

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

const checklistItem = (
  id: string,
  cardId: string,
  position: number,
  content = `Item ${id}`,
  isComplete = false,
): ChecklistItemRow => ({
  id,
  card_id: cardId,
  content,
  is_complete: isComplete,
  position,
  created_at: "2026-01-01T00:00:00.000Z",
});

function checklistPayload(
  eventType: "INSERT" | "UPDATE" | "DELETE",
  row: ChecklistItemRow | null,
): RealtimePostgresChangesPayload<ChecklistItemRow> {
  return {
    eventType,
    schema: "public",
    table: "checklist_items",
    commit_timestamp: "2026-01-01T00:00:00.000Z",
    new: eventType === "DELETE" ? {} : row ?? {},
    old: eventType === "INSERT" ? {} : { id: row?.id ?? "" },
    errors: [],
  } as RealtimePostgresChangesPayload<ChecklistItemRow>;
}

const comment = (
  id: string,
  cardId: string,
  createdAt = "2026-01-01T00:00:00.000Z",
  body = `Comment ${id}`,
  authorId = "author-1",
): CommentRow => ({
  id,
  card_id: cardId,
  author_id: authorId,
  body,
  created_at: createdAt,
});

function commentPayload(
  eventType: "INSERT" | "UPDATE" | "DELETE",
  row: CommentRow | null,
): RealtimePostgresChangesPayload<CommentRow> {
  return {
    eventType,
    schema: "public",
    table: "comments",
    commit_timestamp: "2026-01-01T00:00:00.000Z",
    new: eventType === "DELETE" ? {} : row ?? {},
    old: eventType === "INSERT" ? {} : { id: row?.id ?? "" },
    errors: [],
  } as RealtimePostgresChangesPayload<CommentRow>;
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

describe("reconcileChecklistItems", () => {
  it("appends an item it has never seen, sorted by position", () => {
    const start = [checklistItem("a", "card-1", 0), checklistItem("b", "card-1", 1)];
    const next = reconcileChecklistItems(
      start,
      checklistPayload("INSERT", checklistItem("c", "card-1", 1.5)),
    );
    expect(next.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("updates an item in place without duplicating it", () => {
    const start = [
      checklistItem("a", "card-1", 0),
      checklistItem("b", "card-1", 1),
    ];
    const next = reconcileChecklistItems(
      start,
      checklistPayload(
        "UPDATE",
        checklistItem("a", "card-1", 0, "Item A", true),
      ),
    );
    expect(next).toHaveLength(2);
    expect(next.find((item) => item.id === "a")).toMatchObject({
      is_complete: true,
      content: "Item A",
    });
  });

  it("removes an item on delete", () => {
    const start = [
      checklistItem("a", "card-1", 0),
      checklistItem("b", "card-1", 1),
    ];
    const next = reconcileChecklistItems(
      start,
      checklistPayload("DELETE", checklistItem("a", "card-1", 0)),
    );
    expect(next.map((item) => item.id)).toEqual(["b"]);
  });

  it("is a no-op when deleting an unknown id", () => {
    const start = [checklistItem("a", "card-1", 0)];
    const next = reconcileChecklistItems(
      start,
      checklistPayload("DELETE", checklistItem("nope", "card-1", 0)),
    );
    expect(next).toEqual(start);
  });
});

describe("reconcileComments", () => {
  it("appends a comment it has never seen, sorted by created_at", () => {
    const start = [
      comment("a", "card-1", "2026-01-01T00:00:00.000Z"),
      comment("b", "card-1", "2026-01-02T00:00:00.000Z"),
    ];
    const next = reconcileComments(
      start,
      commentPayload("INSERT", comment("c", "card-1", "2026-01-01T12:00:00.000Z")),
    );
    expect(next.map((item) => item.id)).toEqual(["a", "c", "b"]);
  });

  it("replaces an existing comment in place without duplicating it", () => {
    const start = [
      comment("a", "card-1", "2026-01-01T00:00:00.000Z", "First"),
      comment("b", "card-1", "2026-01-02T00:00:00.000Z", "Second"),
    ];
    const next = reconcileComments(
      start,
      commentPayload(
        "UPDATE",
        comment("a", "card-1", "2026-01-01T00:00:00.000Z", "Edited"),
      ),
    );
    expect(next).toHaveLength(2);
    expect(next.find((item) => item.id === "a")).toMatchObject({
      body: "Edited",
    });
  });

  it("removes a comment on delete", () => {
    const start = [
      comment("a", "card-1"),
      comment("b", "card-1"),
    ];
    const next = reconcileComments(
      start,
      commentPayload("DELETE", comment("a", "card-1")),
    );
    expect(next.map((item) => item.id)).toEqual(["b"]);
  });

  it("is a no-op when deleting an unknown id", () => {
    const start = [comment("a", "card-1")];
    const next = reconcileComments(
      start,
      commentPayload("DELETE", comment("nope", "card-1")),
    );
    expect(next).toEqual(start);
  });
});

const activityLog = (
  id: string,
  boardId: string,
  action: string,
  createdAt = "2026-01-01T00:00:00.000Z",
): ActivityLogRow => ({
  id,
  board_id: boardId,
  actor_id: "actor-1",
  action,
  metadata: {},
  created_at: createdAt,
});

function activityPayload(
  eventType: "INSERT" | "UPDATE" | "DELETE",
  row: ActivityLogRow | null,
): RealtimePostgresChangesPayload<ActivityLogRow> {
  return {
    eventType,
    schema: "public",
    table: "activity_log",
    commit_timestamp: "2026-01-01T00:00:00.000Z",
    new: eventType === "DELETE" ? {} : row ?? {},
    old: eventType === "INSERT" ? {} : { id: row?.id ?? "" },
    errors: [],
  } as RealtimePostgresChangesPayload<ActivityLogRow>;
}

describe("reconcileActivities", () => {
  it("appends an INSERT activity sorted newest-first", () => {
    const start = [
      activityLog("a", "board-1", "card_created", "2026-01-01T00:00:00.000Z"),
    ];
    const next = reconcileActivities(
      start,
      activityPayload(
        "INSERT",
        activityLog("b", "board-1", "card_moved", "2026-01-02T00:00:00.000Z"),
      ),
    );
    expect(next).toHaveLength(2);
    expect(next[0]?.id).toBe("b");
    expect(next[1]?.id).toBe("a");
  });

  it("ignores UPDATE payloads (activity log is immutable)", () => {
    const start = [
      activityLog("a", "board-1", "card_created", "2026-01-01T00:00:00.000Z"),
    ];
    const next = reconcileActivities(
      start,
      activityPayload(
        "UPDATE",
        activityLog("a", "board-1", "card_moved", "2026-01-01T00:00:00.000Z"),
      ),
    );
    expect(next).toEqual(start);
  });

  it("ignores DELETE payloads (activity log is immutable)", () => {
    const start = [
      activityLog("a", "board-1", "card_created", "2026-01-01T00:00:00.000Z"),
    ];
    const next = reconcileActivities(
      start,
      activityPayload("DELETE", activityLog("a", "board-1", "card_created")),
    );
    expect(next).toEqual(start);
  });

  it("does not duplicate an already-seen INSERT", () => {
    const start = [
      activityLog("a", "board-1", "card_created", "2026-01-01T00:00:00.000Z"),
    ];
    const next = reconcileActivities(
      start,
      activityPayload(
        "INSERT",
        activityLog("a", "board-1", "card_created", "2026-01-01T00:00:00.000Z"),
      ),
    );
    expect(next).toHaveLength(1);
  });

  it("sorts by created_at descending, then id descending as tiebreak", () => {
    const start: ActivityLogRow[] = [];
    const next1 = reconcileActivities(
      start,
      activityPayload(
        "INSERT",
        activityLog("a", "board-1", "card_created", "2026-01-01T12:00:00.000Z"),
      ),
    );
    const next2 = reconcileActivities(
      next1,
      activityPayload(
        "INSERT",
        activityLog("b", "board-1", "card_moved", "2026-01-01T12:00:00.000Z"),
      ),
    );
    // Same timestamp: b comes first (b > a).
    expect(next2.map((a) => a.id)).toEqual(["b", "a"]);
  });
});
