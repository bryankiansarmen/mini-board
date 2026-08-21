"use client";

import { useActionState } from "react";
import { createBoard, type BoardFormState } from "@/lib/boards/actions";

const initialState: BoardFormState = {};

export function CreateBoardForm({ workspaceId }: { workspaceId: string }) {
  const [state, formAction, pending] = useActionState(
    createBoard.bind(null, workspaceId),
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <label
          htmlFor="board-title"
          className="block text-sm font-medium text-[var(--color-text-secondary)]"
        >
          Board title
        </label>
        <input
          id="board-title"
          name="title"
          type="text"
          required
          maxLength={80}
          placeholder="e.g. Product Launch"
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create board"}
      </button>
    </form>
  );
}
