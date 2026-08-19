"use client";

import { useEffect, useState } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  REALTIME_SUBSCRIBE_STATES,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useBoardStore } from "@/lib/store/board";
import type { CardRow, ColumnRow } from "@/types";

export type RealtimeStatus =
  | "CONNECTING"
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT";

// Board-scoped Realtime subscription: one Postgres Changes channel per board,
// not per row. Subscribes to `columns` filtered by `board_id` and to `cards`
// filtered by `column_id=in.(...)`, then reconciles each event into the
// Zustand store via getState()/setState, never through a selector, so no
// component re-renders during the store write. The store owns the reconciled
// list; the callbacks mirror it into the board view's local render state.
export function useBoardRealtime({
  boardId,
  columnIds,
  onCardsChange,
  onColumnsChange,
}: {
  boardId: string;
  columnIds: string[];
  onCardsChange: (cards: CardRow[]) => void;
  onColumnsChange: (columns: ColumnRow[]) => void;
}): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("CONNECTING");

  // Resubscribe only when the *set* of columns changes, not on every render.
  // Sorting makes the key order-independent: adding/removing a column changes
  // the key; reordering columns does not.
  const columnKey = [...columnIds].sort().join(",");

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    void (async () => {
      // Ensure the Realtime socket is authenticated with the current user's
      // JWT BEFORE subscribing. The socket's accessToken callback reads the
      // session asynchronously on connect; if the board mounts before that
      // resolves, the join payload goes out without an access_token and
      // Realtime RLS silently drops every event for the member. Setting auth
      // from a resolved session first makes the JWT deterministic.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await supabase.realtime.setAuth(token);
      }

      if (cancelled) return;

      channel = supabase.channel(`board-${boardId}`);

      const applyCards = (payload: RealtimePostgresChangesPayload<CardRow>) => {
        const store = useBoardStore.getState();
        store.reconcileCard(payload);
        onCardsChange(useBoardStore.getState().cards);
      };

      const applyColumns = (
        payload: RealtimePostgresChangesPayload<ColumnRow>,
      ) => {
        const store = useBoardStore.getState();
        store.reconcileColumn(payload);
        onColumnsChange(useBoardStore.getState().columns);
      };

      // Columns change within the board (create/rename/reorder/delete).
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "columns",
            filter: `board_id=eq.${boardId}`,
          },
          applyColumns,
        );

      // Cards are scoped by their column ids (they have no board_id column).
      // Skip the cards subscription entirely when the board has no columns;
      // `column_id=in.()` with zero ids is an invalid Realtime filter.
      if (columnKey) {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "cards",
            filter: `column_id=in.(${columnKey})`,
          },
          applyCards,
        );
      }

      channel.subscribe((channelStatus: REALTIME_SUBSCRIBE_STATES) => {
        setStatus(channelStatus as RealtimeStatus);
      });
    })();

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
    // columnKey encodes the full column-id set, so it is the correct dependency
    // for resubscribing when that set changes.
  }, [boardId, columnKey, onCardsChange, onColumnsChange]);

  return status;
}
