"use client";

import { useActionState } from "react";
import { createCard, type CardFormState } from "@/lib/cards/actions";

const initialState: CardFormState = {};

export function CreateCardForm({ columnId }: { columnId: string }) {
  const [state, formAction, pending] = useActionState(
    createCard.bind(null, columnId),
    initialState,
  );

  return (
    <form action={formAction} className="space-y-1">
      <input
        name="title"
        type="text"
        required
        maxLength={200}
        placeholder="Card title…"
        aria-label="Card title"
        disabled={pending}
        className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {pending ? "Adding…" : "+ Add card"}
      </button>

      {state.error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
