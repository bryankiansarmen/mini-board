"use client";

import { useActionState } from "react";
import { createColumn, type ColumnFormState } from "@/lib/columns/actions";

const initialState: ColumnFormState = {};

export function CreateColumnForm({ boardId }: { boardId: string }) {
  const [state, formAction, pending] = useActionState(
    createColumn.bind(null, boardId),
    initialState,
  );

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="w-full max-w-64 flex-1 space-y-1">
        <label
          htmlFor="column-title"
          className="block text-sm font-medium text-[var(--color-text-secondary)]"
        >
          Column title
        </label>
        <input
          id="column-title"
          name="title"
          type="text"
          required
          maxLength={80}
          placeholder="e.g. To Do"
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create column"}
      </button>

      {state.error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
