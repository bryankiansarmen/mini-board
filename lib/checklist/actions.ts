"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createChecklistItem as createChecklistItemService,
  toggleChecklistItem as toggleChecklistItemService,
  deleteChecklistItem as deleteChecklistItemService,
} from "@/lib/checklist/service";

// Checklist item CRUD is plain RLS-authorized Supabase CRUD; the business logic
// (validation, append position, board resolution) lives in the service so
// integration tests can exercise it without a Next.js request context. Each
// action is a thin wrapper: auth guard -> service -> revalidatePath.

export async function createChecklistItem(
  cardId: string,
  content: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to add a checklist item." };
  }

  const result = await createChecklistItemService(supabase, { cardId, content });
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath(`/boards/${result.boardId}`);
  return {};
}

export async function toggleChecklistItem(
  itemId: string,
  isComplete: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to update a checklist item." };
  }

  const result = await toggleChecklistItemService(supabase, {
    itemId,
    isComplete,
  });
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath(`/boards/${result.boardId}`);
  return {};
}

export async function deleteChecklistItem(
  itemId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to delete a checklist item." };
  }

  const result = await deleteChecklistItemService(supabase, { itemId });
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath(`/boards/${result.boardId}`);
  return {};
}
