"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  createChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
} from "@/lib/checklist/actions";
import { reconcileChecklistItems } from "@/lib/realtime/reconcile";
import { MAX_CHECKLIST_CONTENT_LENGTH } from "@/lib/checklist/service";
import type { ChecklistItemRow } from "@/types";

const COUNTDOWN_THRESHOLD = 40;

// Checklist for a single card, shown inside the card detail modal. Appends new
// items at the end (whole-integer positions), toggles complete with an
// optimistic update, deletes on hover. Completion state persists and syncs to
// other clients viewing the same card via a card-scoped Postgres Changes
// subscription (auth'd with the session JWT before subscribing, like the board
// realtime hook). Local state resyncs from fresh server props during render.
export function ChecklistField({
  cardId,
  items: initialItems,
}: {
  cardId: string;
  items: ChecklistItemRow[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [prevInitial, setPrevInitial] = useState(initialItems);

  // Server props are the source of truth after any refresh; resync during
  // render (the same sanctioned pattern as the board view) so a completed
  // toggle is confirmed by server data rather than only the optimistic write.
  if (initialItems !== prevInitial) {
    setPrevInitial(initialItems);
    setItems(initialItems);
  }

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();

  // Card-scoped Realtime subscription: checklist changes made by other clients
  // viewing the same card appear here without a refresh. Auth the socket with
  // the session JWT before subscribing (see the board realtime hook for the
  // empty-access-token failure mode this prevents).
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await supabase.realtime.setAuth(token);
      }
      if (cancelled) return;

      channel = supabase.channel(`checklist-${cardId}`);
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "checklist_items",
            filter: `card_id=eq.${cardId}`,
          },
          (payload: RealtimePostgresChangesPayload<ChecklistItemRow>) => {
            setItems((prev) => reconcileChecklistItems(prev, payload));
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [cardId]);

  const completed = items.filter((item) => item.is_complete).length;
  const showCountdown = input.length > MAX_CHECKLIST_CONTENT_LENGTH - COUNTDOWN_THRESHOLD;

  function addItem() {
    const trimmed = input.trim();
    if (!trimmed || saving) return;
    if (trimmed.length > MAX_CHECKLIST_CONTENT_LENGTH) {
      setError(
        `Checklist item must be ${MAX_CHECKLIST_CONTENT_LENGTH} characters or fewer.`,
      );
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createChecklistItem(cardId, trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setInput("");
      // The realtime echo also appends this item; setting it here makes the
      // create feel instant rather than waiting for the round-trip.
      router.refresh();
    });
  }

  function toggleItem(item: ChecklistItemRow) {
    const previous = item.is_complete;
    setError(null);
    setPendingItemId(item.id);

    // Optimistic flip; roll back to the prior state if the write fails.
    setItems((prev) =>
      prev.map((existing) =>
        existing.id === item.id
          ? { ...existing, is_complete: !previous }
          : existing,
      ),
    );

    startTransition(async () => {
      const result = await toggleChecklistItem(item.id, !previous);
      if (result.error) {
        setError(result.error);
        setItems((prev) =>
          prev.map((existing) =>
            existing.id === item.id
              ? { ...existing, is_complete: previous }
              : existing,
          ),
        );
      } else {
        router.refresh();
      }
      setPendingItemId(null);
    });
  }

  function removeItem(item: ChecklistItemRow) {
    setError(null);
    setPendingItemId(item.id);
    startTransition(async () => {
      const result = await deleteChecklistItem(item.id);
      if (result.error) {
        setError(result.error);
        setPendingItemId(null);
        return;
      }
      // The realtime echo also drops the item; removing it here keeps the UI
      // in sync without waiting for the round-trip.
      setItems((prev) => prev.filter((existing) => existing.id !== item.id));
      setPendingItemId(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Checklist
        </p>
        {items.length > 0 && (
          <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
            {completed}/{items.length}
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div
          className="mb-2 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={completed}
          aria-label={`${completed} of ${items.length} checklist items complete`}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(completed / items.length) * 100}%` }}
          />
        </div>
      )}

      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="group flex items-start gap-2 rounded px-1.5 py-1 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <input
              type="checkbox"
              checked={item.is_complete}
              aria-label={item.content}
              disabled={pendingItemId === item.id}
              onChange={() => toggleItem(item)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900"
            />
            <span
              className={`flex-1 break-words text-sm ${
                item.is_complete
                  ? "text-zinc-400 line-through dark:text-zinc-500"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {item.content}
            </span>
            {pendingItemId === item.id ? (
              <span className="mt-1 inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-zinc-400 border-t-transparent dark:border-zinc-500 dark:border-t-transparent" />
            ) : (
              <button
                type="button"
                aria-label={`Delete item ${item.content}`}
                onClick={() => removeItem(item)}
                className="shrink-0 rounded p-0.5 text-zinc-400 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-red-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" x2="6" y1="6" y2="18" />
                  <line x1="6" x2="18" y1="6" y2="18" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center gap-1.5">
        <input
          type="text"
          value={input}
          maxLength={MAX_CHECKLIST_CONTENT_LENGTH + 1}
          aria-label="Checklist item"
          placeholder="Add an item…"
          disabled={saving}
          onChange={(event) => {
            setInput(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem();
            }
          }}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
        />
        {showCountdown && (
          <span
            className={`shrink-0 text-xs tabular-nums ${
              input.length > MAX_CHECKLIST_CONTENT_LENGTH
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {input.length}/{MAX_CHECKLIST_CONTENT_LENGTH}
          </span>
        )}
        <button
          type="button"
          onClick={addItem}
          disabled={saving || !input.trim()}
          className="shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900"
        >
          Add
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
