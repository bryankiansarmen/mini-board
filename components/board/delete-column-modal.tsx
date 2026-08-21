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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-overlay)" }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-column-title"
        className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="delete-column-title"
          className="text-base font-semibold text-[var(--color-text-primary)]"
        >
          Delete column?
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Are you sure you want to delete{" "}
          <span className="font-medium text-[var(--color-text-primary)]">
            {column.title}
          </span>
          ?
          {cardCount > 0 && (
            <span className="mt-1 block text-[var(--color-danger)]">
              This will also delete {cardCount} card
              {cardCount !== 1 ? "s" : ""} inside it.
            </span>
          )}
          <span className="mt-1 block">This action cannot be undone.</span>
        </p>

        {error && (
          <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="rounded-md bg-[var(--color-danger)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--color-danger)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete column"}
          </button>
        </div>
      </div>
    </div>
  );
}
