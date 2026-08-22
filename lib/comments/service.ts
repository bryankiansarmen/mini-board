import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommentRow } from "@/types";

// Comment operations, extracted out of the server actions so integration tests
// can exercise them against real RLS without a Next.js request context (same
// pattern as lib/checklist/service.ts). Comments are append-only and immutable:
// a member creates a comment and may delete only their own; there is no edit
// path.

export const MAX_COMMENT_LENGTH = 2000;

export type CommentResult =
  | { ok: true; comment: CommentRow; boardId: string }
  | { ok: false; error: string };

// Resolves the board a comment belongs to (via card -> column), so the server
// action can revalidate the board route. RLS scopes every read here: an
// outsider sees zero rows and fails the card lookup first.
async function resolveBoardId(
  supabase: SupabaseClient,
  cardId: string,
): Promise<{ ok: true; boardId: string } | { ok: false; error: string }> {
  const { data: card } = await supabase
    .from("cards")
    .select("column_id")
    .eq("id", cardId)
    .maybeSingle();
  if (!card) {
    return { ok: false, error: "Card not found." };
  }

  const { data: column } = await supabase
    .from("columns")
    .select("board_id")
    .eq("id", card.column_id)
    .maybeSingle();
  if (!column) {
    return { ok: false, error: "Column not found." };
  }

  return { ok: true, boardId: column.board_id };
}

export async function createComment(
  supabase: SupabaseClient,
  input: { cardId: string; body: string; authorId: string },
): Promise<CommentResult> {
  const { cardId, body, authorId } = input;

  const trimmed = body.trim();
  if (!trimmed) {
    return { ok: false, error: "Comment cannot be empty." };
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return {
      ok: false,
      error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.`,
    };
  }

  const resolved = await resolveBoardId(supabase, cardId);
  if (!resolved.ok) {
    return resolved;
  }

  // RLS enforces author_id = auth.uid() and membership in the card's board, so
  // the insert is denied unless the caller writes their own comment.
  const { data: comment, error } = await supabase
    .from("comments")
    .insert({ card_id: cardId, author_id: authorId, body: trimmed })
    .select("*")
    .single();

  if (error || !comment) {
    return {
      ok: false,
      error: error?.message ?? "Failed to add comment.",
    };
  }

  return { ok: true, comment, boardId: resolved.boardId };
}

export async function deleteComment(
  supabase: SupabaseClient,
  input: { commentId: string },
): Promise<CommentResult> {
  const { commentId } = input;

  // Read the comment first (RLS-scoped) so we can return the board id for
  // revalidation and surface "not found" distinctly from the delete.
  const { data: existing } = await supabase
    .from("comments")
    .select("id, card_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!existing) {
    return { ok: false, error: "Comment not found." };
  }

  const resolved = await resolveBoardId(supabase, existing.card_id);
  if (!resolved.ok) {
    return resolved;
  }

  // RLS filters the delete to rows where author_id = auth.uid(); selecting the
  // deleted rows lets us distinguish a successful own-comment delete from an
  // RLS-silenced attempt on someone else's comment.
  const { data: deleted, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .select("id");

  if (error) {
    return {
      ok: false,
      error: error.message ?? "Failed to delete comment.",
    };
  }
  if (!deleted || deleted.length === 0) {
    return { ok: false, error: "You can only delete your own comment." };
  }

  return { ok: true, comment: existing as CommentRow, boardId: resolved.boardId };
}
