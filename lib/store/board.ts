import { create } from "zustand";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { CardRow, ColumnRow } from "@/types";
import {
  reconcileCardList,
  reconcileColumnList,
} from "@/lib/realtime/reconcile";

// Board card + column state, framework-agnostic with no React imports (a lint
// rule enforces this). Holds the flat lists for the current board so
// drag-and-drop can apply optimistic updates immediately and roll back on a
// failed DB write, and so Realtime events can be reconciled in place. Server
// props are the source of truth after any mutation; the board view hydrates
// this store during render whenever the props change.
type BoardCardsState = {
  cards: CardRow[];
  columns: ColumnRow[];
  hydrateCards: (cards: CardRow[]) => void;
  hydrateColumns: (columns: ColumnRow[]) => void;
  moveCardOptimistic: (
    cardId: string,
    columnId: string,
    position: number,
  ) => void;
  rollbackCards: (cards: CardRow[]) => void;
  reconcileCard: (
    payload: RealtimePostgresChangesPayload<CardRow>,
  ) => void;
  reconcileColumn: (
    payload: RealtimePostgresChangesPayload<ColumnRow>,
  ) => void;
};

export const useBoardStore = create<BoardCardsState>((set) => ({
  cards: [],
  columns: [],

  hydrateCards: (cards) => set({ cards }),
  hydrateColumns: (columns) => set({ columns }),

  moveCardOptimistic: (cardId, columnId, position) =>
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === cardId
          ? { ...card, column_id: columnId, position }
          : card,
      ),
    })),

  rollbackCards: (cards) => set({ cards }),

  reconcileCard: (payload) =>
    set((state) => ({
      cards: reconcileCardList(state.cards, payload),
    })),

  reconcileColumn: (payload) =>
    set((state) => ({
      columns: reconcileColumnList(state.columns, payload),
    })),
}));
