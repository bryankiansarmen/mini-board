"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BoardFormState = {
  error?: string;
};

// Board CRUD is plain RLS-authorized Supabase CRUD,
// so server actions with the session-scoped client are the right tool no
// service-role, no Route Handler. RLS enforces "members create, only
// Owner/Admin deletes" at the database layer.

export async function createBoard(
  workspaceId: string,
  _prevState: BoardFormState,
  formData: FormData,
): Promise<BoardFormState> {
  const title = String(formData.get("title") ?? "").trim();

  if (!title) {
    return { error: "Board title is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to create a board." };
  }

  // Append new boards after the current last one so ordering is deterministic
  // (position is a float; fractional inserts come later with reordering).
  const { data: lastBoard } = await supabase
    .from("boards")
    .select("position")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (lastBoard?.position ?? -1) + 1;

  const { error: insertError } = await supabase
    .from("boards")
    .insert({ workspace_id: workspaceId, title, position });

  if (insertError) {
    return { error: insertError.message ?? "Failed to create board." };
  }

  revalidatePath(`/workspaces/${workspaceId}/boards`);
  return {};
}

export async function renameBoard(
  boardId: string,
  _prevState: BoardFormState,
  formData: FormData,
): Promise<BoardFormState> {
  const title = String(formData.get("title") ?? "").trim();

  if (!title) {
    return { error: "Board title is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to rename a board." };
  }

  const { data: board } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .maybeSingle();

  if (!board) {
    return { error: "Board not found." };
  }

  const { error: updateError } = await supabase
    .from("boards")
    .update({ title })
    .eq("id", boardId);

  if (updateError) {
    return { error: updateError.message ?? "Failed to rename board." };
  }

  revalidatePath(`/workspaces/${board.workspace_id}/boards`);
  return {};
}

export async function deleteBoard(
  boardId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to delete a board." };
  }

  const { data: board } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .maybeSingle();

  if (!board) {
    return { error: "Board not found." };
  }

  const { error: deleteError } = await supabase
    .from("boards")
    .delete()
    .eq("id", boardId);

  if (deleteError) {
    return { error: deleteError.message ?? "Failed to delete board." };
  }

  revalidatePath(`/workspaces/${board.workspace_id}/boards`);
  return {};
}
