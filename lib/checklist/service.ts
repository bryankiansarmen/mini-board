import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistItemRow } from "@/types";

// Checklist item operations, extracted out of the server actions so integration
// tests can exercise them against real RLS without a Next.js request context
// (same pattern as lib/cards/service.ts). Checklist items are appended to the
// end of the card's list with whole-integer positions (no fractional reordering
// in the MVP), so the append position is computed here, not in the UI.

export const MAX_CHECKLIST_CONTENT_LENGTH = 200;

export type ChecklistResult =
  | { ok: true; item: ChecklistItemRow; boardId: string }
  | { ok: false; error: string };

// Resolves the board a checklist item belongs to (via card -> column), so the
// server action can revalidate the board route. RLS scopes every read here:
// an outsider sees zero rows and fails the card lookup first.
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

export async function createChecklistItem(
  supabase: SupabaseClient,
  input: { cardId: string; content: string },
): Promise<ChecklistResult> {
  const { cardId, content } = input;

  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, error: "Checklist item is required." };
  }
  if (trimmed.length > MAX_CHECKLIST_CONTENT_LENGTH) {
    return {
      ok: false,
      error: `Checklist item must be ${MAX_CHECKLIST_CONTENT_LENGTH} characters or fewer.`,
    };
  }

  const resolved = await resolveBoardId(supabase, cardId);
  if (!resolved.ok) {
    return resolved;
  }

  // Append after the current last item so ordering is deterministic.
  const { data: lastItem } = await supabase
    .from("checklist_items")
    .select("position")
    .eq("card_id", cardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (lastItem?.position ?? -1) + 1;

  const { data: item, error } = await supabase
    .from("checklist_items")
    .insert({ card_id: cardId, content: trimmed, position })
    .select("*")
    .single();

  if (error || !item) {
    return {
      ok: false,
      error: error?.message ?? "Failed to add checklist item.",
    };
  }

  return { ok: true, item, boardId: resolved.boardId };
}

export async function toggleChecklistItem(
  supabase: SupabaseClient,
  input: { itemId: string; isComplete: boolean },
): Promise<ChecklistResult> {
  const { itemId, isComplete } = input;

  const { data: item, error } = await supabase
    .from("checklist_items")
    .update({ is_complete: isComplete })
    .eq("id", itemId)
    .select("*")
    .single();

  if (error || !item) {
    return {
      ok: false,
      error: error?.message ?? "Checklist item not found.",
    };
  }

  const resolved = await resolveBoardId(supabase, item.card_id);
  if (!resolved.ok) {
    return resolved;
  }

  return { ok: true, item, boardId: resolved.boardId };
}

export async function deleteChecklistItem(
  supabase: SupabaseClient,
  input: { itemId: string },
): Promise<ChecklistResult> {
  const { itemId } = input;

  // Read the item first (RLS-scoped) so we can return the board id for
  // revalidation and surface "not found" distinctly from the delete.
  const { data: existing } = await supabase
    .from("checklist_items")
    .select("id, card_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!existing) {
    return { ok: false, error: "Checklist item not found." };
  }

  const resolved = await resolveBoardId(supabase, existing.card_id);
  if (!resolved.ok) {
    return resolved;
  }

  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    return {
      ok: false,
      error: error?.message ?? "Failed to delete checklist item.",
    };
  }

  return { ok: true, item: existing as ChecklistItemRow, boardId: resolved.boardId };
}
