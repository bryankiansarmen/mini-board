"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createComment as createCommentService,
  deleteComment as deleteCommentService,
} from "@/lib/comments/service";

// Comment add/delete is plain RLS-authorized Supabase CRUD; the business logic
// (validation, author_id enforcement, board resolution) lives in the service so
// integration tests can exercise it without a Next.js request context. Each
// action is a thin wrapper: auth guard -> service -> revalidatePath.

export async function createComment(
  cardId: string,
  body: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to add a comment." };
  }

  const result = await createCommentService(supabase, {
    cardId,
    body,
    authorId: user.id,
  });
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath(`/boards/${result.boardId}`);
  return {};
}

export async function deleteComment(
  commentId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to delete a comment." };
  }

  const result = await deleteCommentService(supabase, { commentId });
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath(`/boards/${result.boardId}`);
  return {};
}