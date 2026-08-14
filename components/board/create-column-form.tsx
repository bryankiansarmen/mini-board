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
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
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
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        {pending ? "Creating…" : "Create column"}
      </button>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
