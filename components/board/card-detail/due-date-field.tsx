"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCardDetails } from "@/lib/cards/actions";
import { formatDueDate, isOverdue } from "@/lib/cards/dates";
import type { CardRow } from "@/types";
import { SaveIndicator } from "@/components/board/card-detail/save-indicator";

export function DueDateField({ card }: { card: CardRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(card.due_date ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEditing() {
    setValue(card.due_date ?? "");
    setError(null);
    setEditing(true);
  }

  function save() {
    const next = value || null;
    if (next === card.due_date) {
      setEditing(false);
      setError(null);
      return;
    }
    startTransition(async () => {
      const result = await updateCardDetails(card.id, { due_date: next });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setError(null);
      router.refresh();
    });
  }

  function clear() {
    if (!card.due_date) return;
    startTransition(async () => {
      const result = await updateCardDetails(card.id, { due_date: null });
      if (result.error) {
        setError(result.error);
        return;
      }
      setValue("");
      setEditing(false);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
        Due date
      </p>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="date"
            value={value}
            aria-label="Due date"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setValue(card.due_date ?? "");
                setError(null);
                event.currentTarget.blur();
              }
            }}
            onBlur={save}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
          {card.due_date && (
            <button
              type="button"
              onClick={clear}
              className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              Clear
            </button>
          )}
        </div>
      ) : card.due_date ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startEditing}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] ${
              isOverdue(card.due_date)
                ? "bg-[var(--color-warning)] text-white hover:opacity-90"
                : "bg-[var(--color-surface-raised)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
            }`}
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
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
            {formatDueDate(card.due_date)}
            {isOverdue(card.due_date) && <span>(Overdue)</span>}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="rounded-md border border-dashed border-[var(--color-border)] px-2.5 py-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          Set due date
        </button>
      )}
      <div className="mt-1">
        <SaveIndicator pending={pending} error={error} />
      </div>
    </div>
  );
}