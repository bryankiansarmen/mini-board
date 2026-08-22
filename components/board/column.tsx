"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { renameColumn } from "@/lib/columns/actions";
import { deleteCard } from "@/lib/cards/actions";
import { Card } from "@/components/board/card";
import { ColumnMenu } from "@/components/board/column-menu";
import { CreateCardForm } from "@/components/board/create-card-form";
import { DeleteCardModal } from "@/components/board/delete-card-modal";
import type { ColumnRow, CardRow, MemberListItem } from "@/types";

export function Column({
  column,
  columns,
  isFirst,
  isLast,
  cards,
  members,
  onRequestDelete,
  onOpenDetail,
  onMoveCard,
  onMoveColumnLeft,
  onMoveColumnRight,
}: {
  column: ColumnRow;
  columns: ColumnRow[];
  isFirst: boolean;
  isLast: boolean;
  cards: CardRow[];
  members: MemberListItem[];
  onRequestDelete: (columnId: string) => void;
  onOpenDetail: (cardId: string) => void;
  onMoveCard: (cardId: string, targetColumnId: string) => void;
  onMoveColumnLeft: () => void;
  onMoveColumnRight: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [cardToDelete, setCardToDelete] = useState<CardRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingCard, startDeleteCard] = useTransition();

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  // The card list is a drop target so cards can be dropped into empty columns
  // and between cards. `column-drop-${column.id}` distinguishes this droppable
  // from the column's own sortable id in the drag-end handler.
  const { setNodeRef: setCardDropRef, isOver } = useDroppable({
    id: `column-drop-${column.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  // While renaming, detach the drag listeners so typing in the input can't
  // accidentally start a drag or trigger the keyboard sensor.
  const handleProps = editing
    ? {}
    : { ref: setActivatorNodeRef, ...attributes, ...listeners };

  function startEditing() {
    setTitle(column.title);
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setTitle(column.title);
    setError(null);
  }

  function submitRename() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Column title is required.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", trimmed);
      const result = await renameColumn(column.id, {}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setError(null);
      router.refresh();
    });
  }

  function confirmDeleteCard() {
    if (!cardToDelete) return;

    setDeleteError(null);
    startDeleteCard(async () => {
      const result = await deleteCard(cardToDelete.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      setCardToDelete(null);
      router.refresh();
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex w-72 shrink-0 flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]"
    >
      <div className="group flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
        <div
          className="flex min-w-0 flex-1 items-center gap-2"
          onDoubleClick={!editing ? startEditing : undefined}
          {...handleProps}
        >
          {editing ? (
            <div className="flex-1 space-y-1">
              <input
                autoFocus
                value={title}
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    submitRename();
                  } else if (event.key === "Escape") {
                    cancelEditing();
                  }
                }}
                onBlur={submitRename}
                aria-label="Rename column"
                className="w-full rounded-md border border-[var(--color-accent)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
              />
              {error && (
                <p
                  role="alert"
                  className="text-xs text-[var(--color-danger)]"
                >
                  {error}
                </p>
              )}
            </div>
          ) : (
            <>
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                {column.title}
              </h3>
              <span className="shrink-0 rounded bg-[var(--color-surface-raised)] px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
                {cards.length}
              </span>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-0.5 shrink-0">
            <ColumnMenu
              columnId={column.id}
              columnTitle={column.title}
              isFirst={isFirst}
              isLast={isLast}
              onMoveLeft={onMoveColumnLeft}
              onMoveRight={onMoveColumnRight}
              onRequestDelete={onRequestDelete}
            />
            <button
              type="button"
              aria-label={`Delete ${column.title}`}
              onClick={() => onRequestDelete(column.id)}
              className="shrink-0 rounded p-1 text-[var(--color-text-secondary)] opacity-0 transition-opacity hover:text-[var(--color-danger)] focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] group-hover:opacity-100"
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
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div
        ref={setCardDropRef}
        className={`flex-1 space-y-2 p-2 transition-colors ${
          isOver
            ? "bg-[var(--color-accent-ghost)]"
            : ""
        }`}
      >
        {cards.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-md border-2 border-dashed border-[var(--color-border)]">
            <p className="px-2 text-center text-xs text-[var(--color-text-secondary)]">
              Drop cards here
            </p>
          </div>
        ) : (
          <SortableContext
            items={cards.map((card) => card.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {cards.map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  columns={columns}
                  members={members}
                  onRequestDelete={(cardId) =>
                    setCardToDelete(cards.find((c) => c.id === cardId) ?? null)
                  }
                  onOpenDetail={onOpenDetail}
                  onMoveCard={onMoveCard}
                />
              ))}
            </div>
          </SortableContext>
        )}

        <CreateCardForm columnId={column.id} />
      </div>

      {pending && !editing && (
        <p className="px-3 pb-2 text-xs text-[var(--color-text-secondary)]">
          Saving…
        </p>
      )}

      <DeleteCardModal
        card={cardToDelete}
        deleting={isDeletingCard}
        error={deleteError}
        onCancel={() => setCardToDelete(null)}
        onConfirm={confirmDeleteCard}
      />
    </div>
  );
}
