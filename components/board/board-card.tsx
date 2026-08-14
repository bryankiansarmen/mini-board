"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameBoard } from "@/lib/boards/actions";
import type { BoardRow } from "@/types";

export function BoardCard({
  board,
  canManage,
  onRequestDelete,
}: {
  board: BoardRow;
  canManage: boolean;
  onRequestDelete: (boardId: string) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(board.title);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEditing() {
    setTitle(board.title);
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setTitle(board.title);
    setError(null);
  }

  function submitRename() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Board title is required.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", trimmed);
      const result = await renameBoard(board.id, {}, formData);
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
      className="group relative rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
      onDoubleClick={canManage ? startEditing : undefined}
    >
      {editing ? (
        <div className="space-y-2">
          <input
            autoFocus
            value={title}
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitRename();
              } else if (event.key === "Escape") {
                cancelEditing();
              }
            }}
            onBlur={submitRename}
            aria-label="Rename board"
            className="w-full rounded-md border border-indigo-400 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-indigo-500 dark:bg-zinc-900 dark:text-zinc-50"
          />
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p
            className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-50"
            title={board.title}
          >
            {board.title}
          </p>
          {canManage && (
            <button
              type="button"
              aria-label={`Delete ${board.title}`}
              onClick={() => onRequestDelete(board.id)}
              className="shrink-0 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-red-400"
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
          )}
        </div>
      )}

      {pending && !editing && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Saving…
        </p>
      )}
    </div>
  );
}
