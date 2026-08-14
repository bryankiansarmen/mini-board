import { create } from "zustand";
import type { CardRow } from "@/types";

// Board card state. Framework-agnostic (no React imports — see
// eslint.config.mjs). Holds the flat list of cards for the current board so
// drag-and-drop can apply optimistic updates immediately and roll back on a
// failed DB write. Server props are the source of truth after any mutation;
// the board view hydrates this store during render whenever the props change.
type BoardCardsState = {
  cards: CardRow[];
  hydrateCards: (cards: CardRow[]) => void;
  moveCardOptimistic: (
    cardId: string,
    columnId: string,
    position: number,
  ) => void;
  rollbackCards: (cards: CardRow[]) => void;
};

export const useBoardStore = create<BoardCardsState>((set) => ({
  cards: [],

  hydrateCards: (cards) => set({ cards }),

  moveCardOptimistic: (cardId, columnId, position) =>
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === cardId
          ? { ...card, column_id: columnId, position }
          : card,
      ),
    })),

  rollbackCards: (cards) => set({ cards }),
}));
