"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { updateCard } from "@/lib/cards/actions";
import { AssigneeAvatar, DueDateChip, LabelBadge } from "@/components/board/card-meta";
import type { CardRow, MemberListItem } from "@/types";

export function Card({
  card,
  members,
  onRequestDelete,
  onOpenDetail,
}: {
  card: CardRow;
  members: MemberListItem[];
  onRequestDelete: (cardId: string) => void;
  onOpenDetail: (cardId: string) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  // While renaming, detach the drag listeners so typing in the input can't
  // accidentally start a drag or trigger the keyboard sensor. Only `listeners`
  // are spread (not `attributes`): `attributes` adds role="button", and the
  // delete button is a child of this element, a role="button" wrapper around
  // a real button is invalid HTML and collides with Playwright's button role
  // locator (same lesson as the column header).
  const handleProps = editing ? {} : { ...listeners };

  const assignee = members.find(
    (member) => member.user_id === card.assignee_id,
  );

  function handleClick() {
    // A single click opens the card detail modal; a double-click renames.
    // Delay the open briefly and cancel it when a second click arrives (the
    // same pattern the board cards use for navigate-vs-rename).
    if (openTimer.current) {
      clearTimeout(openTimer.current);
    }
    openTimer.current = setTimeout(() => {
      onOpenDetail(card.id);
    }, 250);
  }

  function startEditing() {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    setTitle(card.title);
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setTitle(card.title);
    setError(null);
  }

  function submitRename() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Card title is required.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", trimmed);
      const result = await updateCard(card.id, {}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...handleProps}
      onClick={!editing ? handleClick : undefined}
      className="group relative cursor-grab rounded-md border border-zinc-200 bg-white p-2.5 pr-8 transition-colors hover:border-zinc-300 hover:bg-zinc-50 active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
      onDoubleClick={!editing ? startEditing : undefined}
    >
      {editing ? (
        <div className="space-y-1">
          <input
            autoFocus
            value={title}
            maxLength={200}
            aria-label="Rename card"
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
            className="w-full rounded-md border border-indigo-400 bg-white px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-indigo-500 dark:bg-zinc-900 dark:text-zinc-50"
          />
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="break-words text-sm text-zinc-900 dark:text-zinc-50">
            {card.title}
          </p>

          {card.labels.length > 0 ||
          card.due_date ||
          card.assignee_id ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {card.labels.slice(0, 3).map((label) => (
                <LabelBadge key={label} label={label} />
              ))}
              {card.labels.length > 3 && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  +{card.labels.length - 3}
                </span>
              )}
              {card.due_date && <DueDateChip dueDate={card.due_date} />}
              {assignee?.email && <AssigneeAvatar email={assignee.email} />}
            </div>
          ) : null}

          <button
            type="button"
            aria-label={`Delete ${card.title}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRequestDelete(card.id);
            }}
            className="absolute right-1.5 top-1.5 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-red-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
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
        </>
      )}
      {pending && !editing && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Saving…
        </p>
      )}
    </div>
  );
}