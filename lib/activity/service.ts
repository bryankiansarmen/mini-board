import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityLogRow } from "@/types";

// Activity log operations, extracted for integration testing against real RLS
// without a Next.js request context. Activity is append-only: every action
// inserts a row; no UPDATE or DELETE is ever performed.

export type ActivityAction =
  | "card_created"
  | "card_moved"
  | "card_deleted"
  | "column_created"
  | "column_deleted";

export type ActivityMetadata = {
  card_created: { cardTitle: string; columnTitle: string };
  card_moved: { cardTitle: string; fromColumn: string; toColumn: string };
  card_deleted: { cardTitle: string; columnTitle: string };
  column_created: { columnTitle: string };
  column_deleted: { columnTitle: string; cardCount: number };
};

export type ActivityResult =
  | { ok: true; activity: ActivityLogRow }
  | { ok: false; error: string };

// Inserts an activity log entry. The caller must be authenticated; RLS enforces
// actor_id = auth.uid() and workspace membership on the board. Best-effort: if
// the insert fails, the primary user action should not be blocked.
export async function createActivity<T extends ActivityAction>(
  supabase: SupabaseClient,
  input: {
    boardId: string;
    action: T;
    metadata: ActivityMetadata[T];
    actorId: string;
  },
): Promise<ActivityResult> {
  const { boardId, action, metadata, actorId } = input;

  const { data: activity, error } = await supabase
    .from("activity_log")
    .insert({
      board_id: boardId,
      actor_id: actorId,
      action,
      metadata,
    })
    .select("*")
    .single();

  if (error || !activity) {
    return {
      ok: false,
      error: error?.message ?? "Failed to log activity.",
    };
  }

  return { ok: true, activity };
}
