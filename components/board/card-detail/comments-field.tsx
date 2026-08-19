"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { createComment, deleteComment } from "@/lib/comments/actions";
import { reconcileComments } from "@/lib/realtime/reconcile";
import { MAX_COMMENT_LENGTH } from "@/lib/comments/service";
import type { CommentRow } from "@/types";

const COUNTDOWN_THRESHOLD = 200;

// Comment thread for a single card, shown inside the card detail modal. Members
// append comments; only the author can delete their own (enforced by RLS, and
// surfaced here as a delete button rendered only on the caller's comments).
// Comments sync to other clients viewing the same card via a card-scoped
// Postgres Changes subscription (auth'd with the session JWT before
// subscribing, like the checklist and board realtime hooks). Local state
// resyncs from fresh server props during render.
export function CommentsField({
  cardId,
  comments: initialComments,
  currentUserId,
}: {
  cardId: string;
  comments: CommentRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [prevInitial, setPrevInitial] = useState(initialComments);

  // Server props are the source of truth after any refresh; resync during
  // render so a new comment or delete is confirmed by server data rather than
  // only the optimistic local update.
  if (initialComments !== prevInitial) {
    setPrevInitial(initialComments);
    setComments(initialComments);
  }

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();

  // Card-scoped Realtime subscription: comments made by other clients viewing
  // the same card appear here without a refresh. Auth the socket with the
  // session JWT before subscribing (see the board realtime hook for the
  // empty-access-token failure mode this prevents).
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await supabase.realtime.setAuth(token);
      }
      if (cancelled) return;

      channel = supabase.channel(`comments-${cardId}`);
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "comments",
            filter: `card_id=eq.${cardId}`,
          },
          (payload: RealtimePostgresChangesPayload<CommentRow>) => {
            setComments((prev) => reconcileComments(prev, payload));
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [cardId]);

  const showCountdown =
    input.length > MAX_COMMENT_LENGTH - COUNTDOWN_THRESHOLD;

  function addComment() {
    const trimmed = input.trim();
    if (!trimmed || saving) return;
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setError(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.`);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createComment(cardId, trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setInput("");
      // The realtime echo also appends this comment; clearing the input here
      // makes the create feel instant rather than waiting for the round-trip.
      router.refresh();
    });
  }

  function removeComment(comment: CommentRow) {
    setError(null);
    setPendingCommentId(comment.id);
    startTransition(async () => {
      const result = await deleteComment(comment.id);
      if (result.error) {
        setError(result.error);
        setPendingCommentId(null);
        return;
      }
      // The realtime echo also drops the comment; removing it here keeps the
      // UI in sync without waiting for the round-trip.
      setComments((prev) =>
        prev.filter((existing) => existing.id !== comment.id),
      );
      setPendingCommentId(null);
      router.refresh();
    });
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        Comments
      </p>

      <div className="space-y-2">
        {comments.map((comment) => {
          const isOwn = comment.author_id === currentUserId;
          return (
            <div
              key={comment.id}
              className="group rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-900 dark:text-zinc-50">
                  {comment.body}
                </p>
                {isOwn && (
                  <button
                    type="button"
                    aria-label="Delete comment"
                    onClick={() => removeComment(comment)}
                    disabled={pendingCommentId === comment.id}
                    className="shrink-0 rounded p-0.5 text-zinc-400 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 group-hover:opacity-100 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-red-400"
                  >
                    {pendingCommentId === comment.id ? (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-zinc-400 border-t-transparent dark:border-zinc-500 dark:border-t-transparent" />
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
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
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 space-y-2">
        <textarea
          value={input}
          maxLength={MAX_COMMENT_LENGTH + 1}
          aria-label="Add comment"
          placeholder="Write a comment…"
          rows={3}
          disabled={saving}
          onChange={(event) => {
            setInput(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            // Enter alone starts a new line; Cmd/Ctrl+Enter submits, matching
            // chat-app conventions for multi-line input.
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              addComment();
            }
          }}
          className="w-full resize-none rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Cmd/Ctrl+Enter to submit
          </span>
          <div className="flex items-center gap-2">
            {showCountdown && (
              <span
                className={`text-xs tabular-nums ${
                  input.length > MAX_COMMENT_LENGTH
                    ? "text-red-600 dark:text-red-400"
                    : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {input.length}/{MAX_COMMENT_LENGTH}
              </span>
            )}
            <button
              type="button"
              onClick={addComment}
              disabled={saving || !input.trim()}
              className="shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900"
            >
              Comment
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}