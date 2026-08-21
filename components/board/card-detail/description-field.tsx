"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCardDetails } from "@/lib/cards/actions";
import type { CardRow } from "@/types";
import { SaveIndicator } from "@/components/board/card-detail/save-indicator";

export function DescriptionField({ card }: { card: CardRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(card.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEditing() {
    setValue(card.description ?? "");
    setError(null);
    setEditing(true);
  }

  function save() {
    const next = value.trim() || null;
    if (next === card.description) {
      setEditing(false);
      setError(null);
      return;
    }
    startTransition(async () => {
      const result = await updateCardDetails(card.id, { description: next });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setError(null);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Description
        </p>
        <textarea
          autoFocus
          value={value}
          rows={Math.min(10, Math.max(3, Math.ceil(value.length / 80)))}
          aria-label="Card description"
          placeholder="Add a description…"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setValue(card.description ?? "");
              setError(null);
              event.currentTarget.blur();
            }
          }}
          onBlur={save}
          className="w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        />
        <div className="mt-1">
          <SaveIndicator pending={pending} error={error} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
        Description
      </p>
      {card.description ? (
        <button
          type="button"
          onClick={startEditing}
          className="block w-full whitespace-pre-wrap rounded-md border border-transparent px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-raised)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          {card.description}
        </button>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="block w-full rounded-md border border-dashed border-[var(--color-border)] px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          Add a description…
        </button>
      )}
      <SaveIndicator pending={pending} error={error} />
    </div>
  );
}