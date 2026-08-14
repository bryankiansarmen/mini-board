"use client";

import { useEffect, useRef } from "react";
import type { ColumnRow } from "@/types";

export function DeleteColumnModal({
  column,
  cardCount,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  column: ColumnRow | null;
  cardCount: number;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (column) {
      cancelRef.current?.focus();
    }
  }, [column]);

  useEffect(() => {
    if (!column) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [column, onCancel]);

  if (!column) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-column-title"
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="delete-column-title"
          className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Delete column?
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Are you sure you want to delete{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            {column.title}
          </span>
          ?
          {cardCount > 0 && (
            <span className="mt-1 block text-red-600 dark:text-red-400">
              This will also delete {cardCount} card
              {cardCount !== 1 ? "s" : ""} inside it.
            </span>
          )}
          <span className="mt-1 block">This action cannot be undone.</span>
        </p>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500 dark:hover:bg-red-400"
          >
            {deleting ? "Deleting…" : "Delete column"}
          </button>
        </div>
      </div>
    </div>
  );
}
