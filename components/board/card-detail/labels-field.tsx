"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCardDetails } from "@/lib/cards/actions";
import type { CardRow } from "@/types";
import { SaveIndicator } from "@/components/board/card-detail/save-indicator";

export function LabelsField({
  card,
  suggestions,
}: {
  card: CardRow;
  suggestions: string[];
}) {
  const router = useRouter();
  const [labels, setLabels] = useState(card.labels);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: string[]) {
    if (
      next.length === card.labels.length &&
      next.every((label, index) => label === card.labels[index])
    ) {
      return;
    }
    startTransition(async () => {
      const result = await updateCardDetails(card.id, { labels: next });
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  function addLabel() {
    const trimmed = input.trim();
    setInput("");
    setAdding(false);
    if (!trimmed) return;
    if (labels.some((label) => label.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    const next = [...labels, trimmed];
    setLabels(next);
    save(next);
  }

  function removeLabel(label: string) {
    const next = labels.filter((existing) => existing !== label);
    setLabels(next);
    save(next);
  }

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
        Labels
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {labels.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 rounded bg-[var(--color-surface-raised)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-text-primary)]"
          >
            {label}
            <button
              type="button"
              aria-label={`Remove label ${label}`}
              onClick={() => removeLabel(label)}
              className="rounded p-0.5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-danger)] focus-visible:outline-2 focus-visible:outline-[var(--color-danger)]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
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
          </span>
        ))}

        {adding ? (
          <span className="inline-flex items-center gap-1">
            <input
              autoFocus
              value={input}
              list={`label-suggestions-${card.id}`}
              aria-label="Add label"
              placeholder="Label…"
              maxLength={30}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addLabel();
                } else if (event.key === "Escape") {
                  setInput("");
                  setAdding(false);
                }
              }}
              onBlur={addLabel}
              className="w-32 rounded-md border border-[var(--color-accent)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            />
            <datalist id={`label-suggestions-${card.id}`}>
              {suggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded border border-dashed border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            + Label
          </button>
        )}
      </div>
      <div className="mt-1">
        <SaveIndicator pending={pending} error={error} />
      </div>
    </div>
  );
}