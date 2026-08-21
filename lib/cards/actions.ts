"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  detectPositionDrift,
  renormalizePositions,
} from "@/lib/shared/normalize";
import {
  updateCardDetails as updateCardDetailsService,
  type CardDetailUpdates,
} from "@/lib/cards/service";
import { createActivity } from "@/lib/activity/service";

export type CardFormState = {
  error?: string;
};

// Card CRUD is plain RLS-authorized Supabase CRUD; no service-role, no
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

  // Log activity (best-effort: failure doesn't block the user action).
  const { data: columnMeta } = await supabase
    .from("columns")
    .select("title")
    .eq("id", columnId)
    .maybeSingle();
  void createActivity(supabase, {
    boardId: column.board_id,
    action: "card_created",
    metadata: { cardTitle: title, columnTitle: columnMeta?.title ?? "Unknown" },
    actorId: user.id,
  });

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

// Updates the card detail fields (title, description, due date, assignee,
// labels). Thin wrapper around the service so the business logic is testable
// in integration without a Next.js request context.
export async function updateCardDetails(
  cardId: string,
  updates: CardDetailUpdates,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to update a card." };
  }

  const result = await updateCardDetailsService(supabase, { cardId, updates });
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath(`/boards/${result.boardId}`);
  return {};
}

export async function moveCard(
  cardId: string,
  toColumnId: string,
  newPosition: number,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to move a card." };
  }

  const { data: card } = await supabase
    .from("cards")
    .select("column_id, title")
    .eq("id", cardId)
    .maybeSingle();

  if (!card) {
    return { error: "Card not found." };
  }

  const { data: sourceColumn } = await supabase
    .from("columns")
    .select("board_id, title")
    .eq("id", card.column_id)
    .maybeSingle();

  if (!sourceColumn) {
    return { error: "Column not found." };
  }

  const { data: targetColumn } = await supabase
    .from("columns")
    .select("board_id, title")
    .eq("id", toColumnId)
    .maybeSingle();

  if (!targetColumn) {
    return { error: "Target column not found." };
  }

  if (targetColumn.board_id !== sourceColumn.board_id) {
    return { error: "Cannot move a card across boards." };
  }

  const { error: updateError } = await supabase
    .from("cards")
    .update({
      column_id: toColumnId,
      position: newPosition,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId);

  if (updateError) {
    return { error: updateError.message ?? "Failed to move card." };
  }

  // Log activity (best-effort: failure doesn't block the user action).
  void createActivity(supabase, {
    boardId: sourceColumn.board_id,
    action: "card_moved",
    metadata: {
      cardTitle: card.title,
      fromColumn: sourceColumn.title,
      toColumn: targetColumn.title,
    },
    actorId: user.id,
  });

  revalidatePath(`/boards/${sourceColumn.board_id}`);
  return {};
}

// Re-normalizes a column's card positions to whole-integer spacing when its
// adjacent positions have drifted within DRIFT_THRESHOLD (repeated midpoint
// drops between the same two neighbors exhaust the gap). No-op when the
// column is already within bounds; idempotent and safe to call defensively.
export async function renormalizeCardPositions(
  columnId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to re-normalize card positions." };
  }

  const { data: column } = await supabase
    .from("columns")
    .select("board_id")
    .eq("id", columnId)
    .maybeSingle();

  if (!column) {
    return { error: "Column not found." };
  }

  const { data: cards } = await supabase
    .from("cards")
    .select("id, position")
    .eq("column_id", columnId)
    .order("position", { ascending: true });

  const positions = (cards ?? []).map((card) => card.position);
  if (!detectPositionDrift(positions)) {
    return {};
  }

  // Renormalize preserves relative order, then write every card's new whole-
  // integer position. RLS scopes each update through the column's board.
  const normalized = renormalizePositions(cards ?? []);
  const results = await Promise.all(
    normalized.map(({ id, position }) =>
      supabase
        .from("cards")
        .update({ position, updated_at: new Date().toISOString() })
        .eq("id", id),
    ),
  );

  const failed = results.find((result) => result.error);
  if (failed) {
    return { error: failed.error?.message ?? "Failed to re-normalize cards." };
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
    .select("column_id, title")
    .eq("id", cardId)
    .maybeSingle();

  if (!card) {
    return { error: "Card not found." };
  }

  const { data: column } = await supabase
    .from("columns")
    .select("board_id, title")
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

  // Log activity (best-effort: failure doesn't block the user action).
  void createActivity(supabase, {
    boardId: column.board_id,
    action: "card_deleted",
    metadata: { cardTitle: card.title, columnTitle: column.title },
    actorId: user.id,
  });

  revalidatePath(`/boards/${column.board_id}`);
  return {};
}
