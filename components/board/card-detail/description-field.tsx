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
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
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
          className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <div className="mt-1">
          <SaveIndicator pending={pending} error={error} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        Description
      </p>
      {card.description ? (
        <button
          type="button"
          onClick={startEditing}
          className="block w-full whitespace-pre-wrap rounded-md border border-transparent px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:border-zinc-200 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {card.description}
        </button>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="block w-full rounded-md border border-dashed border-zinc-300 px-3 py-2 text-left text-sm text-zinc-400 transition-colors hover:border-indigo-400 hover:text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:hover:border-indigo-500 dark:hover:text-zinc-400"
        >
          Add a description…
        </button>
      )}
      <SaveIndicator pending={pending} error={error} />
    </div>
  );
}