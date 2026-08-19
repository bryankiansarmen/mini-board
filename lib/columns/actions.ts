"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  detectPositionDrift,
  renormalizePositions,
} from "@/lib/shared/normalize";

export type ColumnFormState = {
  error?: string;
};

// Column CRUD is plain RLS-authorized Supabase CRUD; no service-role, no
// Route Handler. RLS scopes every operation through the board's workspace
// membership: any workspace member can create/update/delete a column.

export async function createColumn(
  boardId: string,
  _prevState: ColumnFormState,
  formData: FormData,
): Promise<ColumnFormState> {
  const title = String(formData.get("title") ?? "").trim();

  if (!title) {
    return { error: "Column title is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to create a column." };
  }

  // Append new columns after the current last one so ordering is deterministic.
  const { data: lastColumn } = await supabase
    .from("columns")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (lastColumn?.position ?? -1) + 1;

  const { error: insertError } = await supabase
    .from("columns")
    .insert({ board_id: boardId, title, position });

  if (insertError) {
    return { error: insertError.message ?? "Failed to create column." };
  }

  revalidatePath(`/boards/${boardId}`);
  return {};
}

export async function renameColumn(
  columnId: string,
  _prevState: ColumnFormState,
  formData: FormData,
): Promise<ColumnFormState> {
  const title = String(formData.get("title") ?? "").trim();

  if (!title) {
    return { error: "Column title is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to rename a column." };
  }

  const { data: column } = await supabase
    .from("columns")
    .select("board_id")
    .eq("id", columnId)
    .maybeSingle();

  if (!column) {
    return { error: "Column not found." };
  }

  const { error: updateError } = await supabase
    .from("columns")
    .update({ title })
    .eq("id", columnId);

  if (updateError) {
    return { error: updateError.message ?? "Failed to rename column." };
  }

  revalidatePath(`/boards/${column.board_id}`);
  return {};
}

export async function deleteColumn(
  columnId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to delete a column." };
  }

  const { data: column } = await supabase
    .from("columns")
    .select("board_id")
    .eq("id", columnId)
    .maybeSingle();

  if (!column) {
    return { error: "Column not found." };
  }

  const { error: deleteError } = await supabase
    .from("columns")
    .delete()
    .eq("id", columnId);

  if (deleteError) {
    return { error: deleteError.message ?? "Failed to delete column." };
  }

  revalidatePath(`/boards/${column.board_id}`);
  return {};
}

export async function reorderColumn(
  columnId: string,
  newPosition: number,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to reorder a column." };
  }

  const { data: column } = await supabase
    .from("columns")
    .select("board_id")
    .eq("id", columnId)
    .maybeSingle();

  if (!column) {
    return { error: "Column not found." };
  }

  const { error: updateError } = await supabase
    .from("columns")
    .update({ position: newPosition })
    .eq("id", columnId);

  if (updateError) {
    return { error: updateError.message ?? "Failed to reorder column." };
  }

  revalidatePath(`/boards/${column.board_id}`);
  return {};
}

// Re-normalizes a board's column positions to whole-integer spacing when
// adjacent positions have drifted within DRIFT_THRESHOLD. Same semantics as
// renormalizeCardPositions; no-op when the board is already within bounds.
export async function renormalizeColumnPositions(
  boardId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to re-normalize column positions." };
  }

  const { data: columns } = await supabase
    .from("columns")
    .select("id, position")
    .eq("board_id", boardId)
    .order("position", { ascending: true });

  const positions = (columns ?? []).map((column) => column.position);
  if (!detectPositionDrift(positions)) {
    return {};
  }

  const normalized = renormalizePositions(columns ?? []);
  const results = await Promise.all(
    normalized.map(({ id, position }) =>
      supabase.from("columns").update({ position }).eq("id", id),
    ),
  );

  const failed = results.find((result) => result.error);
  if (failed) {
    return { error: failed.error?.message ?? "Failed to re-normalize columns." };
  }

  revalidatePath(`/boards/${boardId}`);
  return {};
}
