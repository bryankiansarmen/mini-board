import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { formatActivityMessage, formatRelativeTime } from "@/lib/activity/format";
import type { ActivityLogRow } from "@/types";

function activity(
  action: string,
  metadata: Record<string, unknown> = {},
  actorId = "actor-1",
  boardId = "board-1",
): ActivityLogRow {
  return {
    id: "act-1",
    board_id: boardId,
    actor_id: actorId,
    action,
    metadata,
    created_at: "2026-08-21T12:00:00.000Z",
  };
}

describe("formatActivityMessage", () => {
  it("formats card_created", () => {
    const msg = formatActivityMessage(
      activity("card_created", { cardTitle: "Fix bug", columnTitle: "To Do" }),
      "alice@example.com",
    );
    expect(msg).toBe('alice@example.com created "Fix bug" in To Do');
  });

  it("formats card_moved", () => {
    const msg = formatActivityMessage(
      activity("card_moved", {
        cardTitle: "Fix bug",
        fromColumn: "To Do",
        toColumn: "Done",
      }),
      "bob@example.com",
    );
    expect(msg).toBe('bob@example.com moved "Fix bug" from To Do to Done');
  });

  it("formats card_deleted", () => {
    const msg = formatActivityMessage(
      activity("card_deleted", { cardTitle: "Old task", columnTitle: "Archived" }),
      "carol@example.com",
    );
    expect(msg).toBe('carol@example.com deleted "Old task" from Archived');
  });

  it("formats column_created", () => {
    const msg = formatActivityMessage(
      activity("column_created", { columnTitle: "In Review" }),
      "dave@example.com",
    );
    expect(msg).toBe('dave@example.com created column "In Review"');
  });

  it("formats column_deleted with card count", () => {
    const msg = formatActivityMessage(
      activity("column_deleted", { columnTitle: "Done", cardCount: 5 }),
      "eve@example.com",
    );
    expect(msg).toBe('eve@example.com deleted column "Done" (5 cards)');
  });

  it("formats column_deleted with singular card count", () => {
    const msg = formatActivityMessage(
      activity("column_deleted", { columnTitle: "Done", cardCount: 1 }),
      "eve@example.com",
    );
    expect(msg).toBe('eve@example.com deleted column "Done" (1 card)');
  });

  it("falls back to 'Someone' when actor email is empty", () => {
    const msg = formatActivityMessage(
      activity("card_created", { cardTitle: "Task", columnTitle: "To Do" }),
      "",
    );
    expect(msg).toBe('Someone created "Task" in To Do');
  });

  it("handles unknown action types gracefully", () => {
    const msg = formatActivityMessage(
      activity("unknown_action", {}),
      "alice@example.com",
    );
    expect(msg).toBe("alice@example.com performed an action");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows 'just now' for less than 60 seconds ago", () => {
    expect(formatRelativeTime("2026-08-21T11:59:30.000Z")).toBe("just now");
  });

  it("shows minutes ago", () => {
    expect(formatRelativeTime("2026-08-21T11:55:00.000Z")).toBe("5m ago");
  });

  it("shows hours ago", () => {
    expect(formatRelativeTime("2026-08-21T09:00:00.000Z")).toBe("3h ago");
  });

  it("shows days ago", () => {
    expect(formatRelativeTime("2026-08-19T12:00:00.000Z")).toBe("2d ago");
  });

  it("shows absolute date for entries older than 7 days", () => {
    const result = formatRelativeTime("2026-08-10T12:00:00.000Z");
    expect(result).toMatch(/Aug 10/);
  });
});
