"use client";

import { useEffect, useRef } from "react";
import FocusTrap from "focus-trap-react";
import type { CardRow } from "@/types";

export function DeleteCardModal({
  card,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  card: CardRow | null;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (card) {
      cancelRef.current?.focus();
    }
  }, [card]);

  useEffect(() => {
    if (!card) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [card, onCancel]);

  if (!card) return null;

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true, returnFocusOnDeactivate: true }}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: "var(--color-overlay)" }}
        onClick={onCancel}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-card-title"
          className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <h2
            id="delete-card-title"
            className="text-base font-semibold text-[var(--color-text-primary)]"
          >
            Delete card?
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Are you sure you want to delete{" "}
            <span className="font-medium text-[var(--color-text-primary)]">
              {card.title}
            </span>
            ?{" "}
            <span className="block">This action cannot be undone.</span>
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
              {deleting ? "Deleting…" : "Delete card"}
            </button>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
