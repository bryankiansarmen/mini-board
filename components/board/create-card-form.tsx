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
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Adding…" : "+ Add card"}
      </button>

      {state.error && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
