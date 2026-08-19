"use client";

// Field-level save feedback for the card detail modal: an inline spinner or
// error next to the affected field. Never blocks the rest of the modal.
export function SaveIndicator({
  pending,
  error,
}: {
  pending: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <p role="alert" className="text-xs text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }
  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-zinc-400 border-t-transparent dark:border-zinc-500 dark:border-t-transparent" />
        Saving…
      </span>
    );
  }
  return null;
}