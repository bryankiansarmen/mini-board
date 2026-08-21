"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Column } from "@/components/board/column";
import { DeleteColumnModal } from "@/components/board/delete-column-modal";
import { CardDetailModal } from "@/components/board/card-detail-modal";
import { ActivityFeed } from "@/components/board/activity-feed";
import {
  deleteColumn,
  renormalizeColumnPositions,
  reorderColumn,
} from "@/lib/columns/actions";
import { calculatePositionAt } from "@/lib/columns/position";
import {
  moveCard,
  renormalizeCardPositions,
} from "@/lib/cards/actions";
import { computeCardMove } from "@/lib/cards/position";
import { detectPositionDrift } from "@/lib/shared/normalize";
import { useBoardRealtime } from "@/lib/realtime/useBoardRealtime";
import { useBoardPresence } from "@/lib/realtime/useBoardPresence";
import { PresenceStack } from "@/components/board/presence-stack";
import { ThemeToggle } from "@/components/theme-toggle";
import { useBoardStore } from "@/lib/store/board";
import type {
  ColumnRow,
  CardRow,
  ChecklistItemRow,
  CommentRow,
  MemberListItem,
  ActivityLogRow,
} from "@/types";

export function BoardView({
  boardId,
  columns: initialColumns,
  cards: initialCards,
  members,
  checklistItemsByCard,
  commentsByCard,
  activities: initialActivities,
  currentUserId,
  currentUserEmail,
}: {
  boardId: string;
  columns: ColumnRow[];
  cards: CardRow[];
  members: MemberListItem[];
  checklistItemsByCard: Record<string, ChecklistItemRow[]>;
  commentsByCard: Record<string, CommentRow[]>;
  activities: ActivityLogRow[];
  currentUserId: string;
  currentUserEmail: string;
}) {
  const router = useRouter();
  // Local state for optimistic column reordering. The server render (from
  // props) is the source of truth after any mutation, so when the props
  // change we resync during render (the React-recommended pattern, no effect).
  const [columns, setColumns] = useState(initialColumns);
  const [prevInitial, setPrevInitial] = useState(initialColumns);
  const [pendingDelete, setPendingDelete] = useState<ColumnRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  // Cards are render state initialized from the server props and resynced
  // during render, the same sanctioned pattern as columns above, so the
  // first paint (including the server-rendered HTML) always shows the board's
  // cards. The Zustand store stays as the optimistic-move engine only: the
  // render path does NOT subscribe to its cards slice, because a render-phase
  // store write would notify subscribers and trip React's "Cannot update a
  // component while rendering a different component" error. Drag handlers
  // read/write the store via getState() and mirror the result back into this
  // local state.
  const [cards, setCards] = useState(initialCards);
  const [prevCards, setPrevCards] = useState<CardRow[] | null>(null);
  const hydrateCards = useBoardStore((state) => state.hydrateCards);
  const hydrateColumns = useBoardStore((state) => state.hydrateColumns);
  const moveCardOptimistic = useBoardStore((state) => state.moveCardOptimistic);
  const rollbackCards = useBoardStore((state) => state.rollbackCards);

  // A null sentinel (not useState(initialCards)) guarantees the first render
  // always resyncs: prevCards starts null, so initialCards !== prevCards fires
  // on mount and again whenever the server props actually change.
  if (initialCards !== prevCards) {
    setPrevCards(initialCards);
    setCards(initialCards);
    hydrateCards(initialCards);
  }

  if (initialColumns !== prevInitial) {
    setPrevInitial(initialColumns);
    setColumns(initialColumns);
    // Keep the store's columns slice in sync during the render-time resync so
    // Realtime reconciliation always starts from the server's column set.
    hydrateColumns(initialColumns);
  }

  // The card being dragged, for the DragOverlay ghost.
  const [activeCard, setActiveCard] = useState<CardRow | null>(null);

  // The card whose detail modal is open. Rendered conditionally, so the modal
  // remounts on every open and shows fresh server props. If the card is
  // deleted (locally or via Realtime), detailCard becomes null and it closes.
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const detailCard = detailCardId
    ? (cards.find((card) => card.id === detailCardId) ?? null)
    : null;

  // Existing labels across the board, used as suggestions when adding a new
  // label in the card detail modal.
  const labelSuggestions = useMemo(() => {
    const seen = new Set<string>();
    for (const card of cards) {
      for (const label of card.labels) {
        seen.add(label);
      }
    }
    return [...seen].sort();
  }, [cards]);

  // Non-blocking error toast for rollback-on-failed-write.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Activity feed toggle (right sidebar).
  const [showActivity, setShowActivity] = useState(false);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  const cardsByColumn = cards.reduce<Record<string, CardRow[]>>((acc, card) => {
    if (!acc[card.column_id]) {
      acc[card.column_id] = [];
    }
    acc[card.column_id].push(card);
    return acc;
  }, {});

  const columnIds = columns.map((c) => c.id);

  // Board-scoped Realtime subscription: reconciles cards/columns events into
  // the store and mirrors the result into this local render state. The status
  // is exposed as a data attribute (not visual UI; the reconnection banner is
  // an error state, deliberately silent here) so E2E tests can wait
  // for a live subscription before asserting two-context sync.
  const realtimeStatus = useBoardRealtime({
    boardId,
    columnIds,
    onCardsChange: setCards,
    onColumnsChange: setColumns,
  });

  // Board-scoped presence tracking via Broadcast channel. Shows which users
  // are currently viewing the board as a stacked avatar list.
  const presenceList = useBoardPresence({
    boardId,
    currentUserId,
    currentUserEmail,
  });

  // distance: 5 keeps plain clicks and double-clicks working on the card and
  // column header (rename, delete) while still starting a drag once the
  // pointer actually moves. TouchSensor uses a 250ms long-press so dragging
  // doesn't fight vertical scroll on mobile (the design breakpoint note).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    const card = cards.find((c) => c.id === event.active.id);
    if (card) setActiveCard(card);
  }

  function handleDragCancel() {
    setActiveCard(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const isColumn = columns.some((c) => c.id === active.id);
    if (isColumn) {
      handleColumnDragEnd(event);
      return;
    }

    void handleCardDragEnd(event);
  }

  async function handleCardDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);

    // Resolve the drop target. `over` can be a card, a column's card-drop
    // droppable (`column-drop-<id>`), or the column sortable itself.
    let targetColumnId: string | null = null;
    let overCardId: string | null = null;

    if (overId.startsWith("column-drop-")) {
      targetColumnId = overId.replace("column-drop-", "");
    } else {
      const overCard = cards.find((c) => c.id === overId);
      if (overCard) {
        targetColumnId = overCard.column_id;
        overCardId = overCard.id;
      } else if (columns.some((c) => c.id === overId)) {
        targetColumnId = overId;
      }
    }

    if (!targetColumnId) return;

    const move = computeCardMove(
      cards,
      String(active.id),
      targetColumnId,
      overCardId,
    );

    // No-op drop (card didn't change position), nothing to write.
    if (!move) return;

    const previous = cards;

    // Optimistic update: re-render instantly, then write to the DB. The store
    // computes the moved list; mirror it into local render state.
    moveCardOptimistic(String(active.id), move.columnId, move.position);
    setCards(useBoardStore.getState().cards);

    // A failed fetch rejects (throws) rather than returning { error }, so wrap
    // the call to guarantee rollback either way.
    let result: { error?: string };
    try {
      result = await moveCard(String(active.id), move.columnId, move.position);
    } catch {
      rollbackCards(previous);
      setCards(previous);
      showToast("Couldn't move card — your changes were reverted.");
      return;
    }

    if (result.error) {
      // Roll back to the last known-good position and surface a non-blocking
      // error toast, never a silent failure.
      rollbackCards(previous);
      setCards(previous);
      showToast(`Couldn't move card: ${result.error}`);
      return;
    }

    // Position re-normalization: repeated midpoint drops between the same two
    // neighbors eventually exhaust the gap. When the destination column has
    // drifted within the threshold, re-normalize to whole-integer spacing
    // (order unchanged) so future drops still have room.
    const current = useBoardStore.getState().cards;
    const targetPositions = current
      .filter((card) => card.column_id === move.columnId)
      .map((card) => card.position);
    if (detectPositionDrift(targetPositions)) {
      await renormalizeCardPositions(move.columnId);
    }

    router.refresh();
  }

  function handleColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // `over` may resolve to the column-drop droppable inside a column or even
    // a card; map it back to the owning column so column drags always target a
    // column id.
    let overColumnId: string;
    const overId = String(over.id);
    if (overId.startsWith("column-drop-")) {
      overColumnId = overId.replace("column-drop-", "");
    } else {
      const overCard = cards.find((c) => c.id === overId);
      if (overCard) {
        overColumnId = overCard.column_id;
      } else {
        overColumnId = overId;
      }
    }

    const oldIndex = columns.findIndex((c) => c.id === active.id);
    const newIndex = columns.findIndex((c) => c.id === overColumnId);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = columns;
    const reordered = arrayMove(columns, oldIndex, newIndex);
    const newPosition = calculatePositionAt(reordered, newIndex);

    // Optimistic update, roll back on failure.
    setColumns(reordered);
    reorderColumn(String(active.id), newPosition).then(async (result) => {
      if (result.error) {
        setColumns(previous);
        showToast(`Couldn't reorder column: ${result.error}`);
        return;
      }
      // Same drift guard as cards: exhaust the gap between two adjacent
      // columns and the whole board re-normalizes to integer spacing.
      const boardId = reordered[0]?.board_id;
      if (
        boardId &&
        detectPositionDrift(reordered.map((column) => column.position))
      ) {
        await renormalizeColumnPositions(boardId);
      }
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!pendingDelete) return;

    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteColumn(pendingDelete.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      setPendingDelete(null);
      router.refresh();
    });
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-start gap-4">
          <SortableContext
            items={columnIds}
            strategy={horizontalListSortingStrategy}
          >
            <div
              data-realtime={realtimeStatus}
              className="flex items-start gap-4 overflow-x-auto pb-4"
            >
              {columns.length === 0 && (
                <div className="flex h-64 w-full items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)]">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    No columns yet — create one above.
                  </p>
                </div>
              )}
              {columns.map((column) => (
                <Column
                  key={column.id}
                  column={column}
                  cards={cardsByColumn[column.id] ?? []}
                  members={members}
                  onRequestDelete={() => setPendingDelete(column)}
                  onOpenDetail={setDetailCardId}
                />
              ))}
            </div>
          </SortableContext>

          {/* Presence avatars */}
          <PresenceStack presenceList={presenceList} />

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Activity toggle button */}
          <button
            type="button"
            onClick={() => setShowActivity(!showActivity)}
            className="shrink-0 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)]"
            aria-expanded={showActivity}
            aria-controls="activity-feed-panel"
          >
            {showActivity ? "Hide Activity" : "Activity"}
          </button>
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="w-72 cursor-grabbing rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 pr-8 shadow-xl">
              <p className="text-sm text-[var(--color-text-primary)]">
                {activeCard.title}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Activity feed sidebar */}
      {showActivity && (
        <div
          id="activity-feed-panel"
          role="complementary"
          aria-label="Activity feed"
          className="fixed inset-y-0 right-0 z-40 w-80 border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
        >
          <div className="absolute left-2 top-2">
            <button
              type="button"
              onClick={() => setShowActivity(false)}
              className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              aria-label="Close activity feed"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          <div className="h-full pt-8">
            <ActivityFeed
              boardId={boardId}
              activities={initialActivities}
              members={members}
            />
          </div>
        </div>
      )}

      {toast && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-[var(--color-danger)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-danger)] shadow-xl"
        >
          {toast}
        </div>
      )}

      <DeleteColumnModal
        column={pendingDelete}
        cardCount={
          pendingDelete ? (cardsByColumn[pendingDelete.id]?.length ?? 0) : 0
        }
        deleting={isDeleting}
        error={deleteError}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />

      {detailCard && (
        <CardDetailModal
          card={detailCard}
          members={members}
          labelSuggestions={labelSuggestions}
          checklistItems={checklistItemsByCard[detailCard.id] ?? []}
          comments={commentsByCard[detailCard.id] ?? []}
          currentUserId={currentUserId}
          onClose={() => setDetailCardId(null)}
        />
      )}
    </>
  );
}
