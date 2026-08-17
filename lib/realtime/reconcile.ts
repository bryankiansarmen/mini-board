import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { CardRow, ColumnRow } from "@/types";

// Pure, framework-agnostic reconciliation helpers (mirrors
// lib/shared/normalize.ts). They take a Realtime Postgres Changes payload and
// return a NEW list; the caller (the store / hook) owns committing the result.
// Server data is the source of truth: an INSERT/UPDATE replaces or appends the
// row by id, a DELETE drops it. No client-side conflict resolution — the last
// committed write wins (matches ARCHITECTURE.md's sequence diagram).

function sortCards(cards: CardRow[]): CardRow[] {
  return [...cards].sort((a, b) => {
    if (a.column_id !== b.column_id) {
      return a.column_id < b.column_id ? -1 : 1;
    }
    return a.position - b.position;
  });
}

function sortColumns(columns: ColumnRow[]): ColumnRow[] {
  return [...columns].sort((a, b) => a.position - b.position);
}

export function reconcileCardList(
  cards: CardRow[],
  payload: RealtimePostgresChangesPayload<CardRow>,
): CardRow[] {
  if (payload.eventType === "DELETE") {
    const id = payload.old?.id;
    return id ? cards.filter((card) => card.id !== id) : cards;
  }

  const incoming = payload.new;
  const exists = cards.some((card) => card.id === incoming.id);
  const next = exists
    ? cards.map((card) => (card.id === incoming.id ? incoming : card))
    : [...cards, incoming];
  return sortCards(next);
}

export function reconcileColumnList(
  columns: ColumnRow[],
  payload: RealtimePostgresChangesPayload<ColumnRow>,
): ColumnRow[] {
  if (payload.eventType === "DELETE") {
    const id = payload.old?.id;
    return id ? columns.filter((column) => column.id !== id) : columns;
  }

  const incoming = payload.new;
  const exists = columns.some((column) => column.id === incoming.id);
  const next = exists
    ? columns.map((column) => (column.id === incoming.id ? incoming : column))
    : [...columns, incoming];
  return sortColumns(next);
}
