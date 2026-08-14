"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CardFormState = {
  error?: string;
};

// Card CRUD is plain RLS-authorized Supabase CRUD — no service-role, no
// Route Handler. RLS scopes every operation through columns -> boards ->
// workspace membership: any workspace member can create/update/delete a card.

export async function createCard(
  columnId: string,
  _prevState: CardFormState,
  formData: FormData,
): Promise<CardFormState> {
  const title = String(formData.get("title") ?? "").trim();

  if (!title) {
    return { error: "Card title is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to create a card." };
  }

  const { data: column } = await supabase
    .from("columns")
    .select("board_id")
    .eq("id", columnId)
    .maybeSingle();

  if (!column) {
    return { error: "Column not found." };
  }

  // Append new cards after the current last one so ordering is deterministic.
  const { data: lastCard } = await supabase
    .from("cards")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (lastCard?.position ?? -1) + 1;

  const { error: insertError } = await supabase
    .from("cards")
    .insert({ column_id: columnId, title, position });

  if (insertError) {
    return { error: insertError.message ?? "Failed to create card." };
  }

  revalidatePath(`/boards/${column.board_id}`);
  return {};
}

export async function updateCard(
  cardId: string,
  _prevState: CardFormState,
  formData: FormData,
): Promise<CardFormState> {
  const title = String(formData.get("title") ?? "").trim();

  if (!title) {
    return { error: "Card title is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to rename a card." };
  }

  const { data: card } = await supabase
    .from("cards")
    .select("column_id")
    .eq("id", cardId)
    .maybeSingle();

  if (!card) {
    return { error: "Card not found." };
  }

  const { data: column } = await supabase
    .from("columns")
    .select("board_id")
    .eq("id", card.column_id)
    .maybeSingle();

  if (!column) {
    return { error: "Column not found." };
  }

  const { error: updateError } = await supabase
    .from("cards")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", cardId);

  if (updateError) {
    return { error: updateError.message ?? "Failed to rename card." };
  }

  revalidatePath(`/boards/${column.board_id}`);
  return {};
}

export async function deleteCard(
  cardId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to delete a card." };
  }

  const { data: card } = await supabase
    .from("cards")
    .select("column_id")
    .eq("id", cardId)
    .maybeSingle();

  if (!card) {
    return { error: "Card not found." };
  }

  const { data: column } = await supabase
    .from("columns")
    .select("board_id")
    .eq("id", card.column_id)
    .maybeSingle();

  if (!column) {
    return { error: "Column not found." };
  }

  const { error: deleteError } = await supabase
    .from("cards")
    .delete()
    .eq("id", cardId);

  if (deleteError) {
    return { error: deleteError.message ?? "Failed to delete card." };
  }

  revalidatePath(`/boards/${column.board_id}`);
  return {};
}
