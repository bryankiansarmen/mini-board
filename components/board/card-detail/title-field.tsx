"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCardDetails } from "@/lib/cards/actions";
import type { CardRow } from "@/types";
import { SaveIndicator } from "@/components/board/card-detail/save-indicator";

// Always-editable title: saves on Enter or blur, cancels with Escape. The
// input doubles as the dialog's accessible name via the modal's aria-labelledby.
export function TitleField({ card }: { card: CardRow }) {
  const router = useRouter();
  const [title, setTitle] = useState(card.title);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Card title is required.");
      return;
    }
    if (trimmed === card.title) return;

    startTransition(async () => {
      const result = await updateCardDetails(card.id, { title: trimmed });
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <div>
      <input
        id="card-detail-title"
        value={title}
        maxLength={200}
        aria-label="Card title"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          } else if (event.key === "Escape") {
            setTitle(card.title);
            setError(null);
            event.currentTarget.blur();
          }
        }}
        onBlur={save}
        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-zinc-900 transition-colors hover:border-zinc-200 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-zinc-50 dark:hover:border-zinc-700 dark:focus:bg-zinc-900"
      />
      <SaveIndicator pending={pending} error={error} />
    </div>
  );
}