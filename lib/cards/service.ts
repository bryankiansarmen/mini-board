import type { SupabaseClient } from "@supabase/supabase-js";

// Card detail field updates, extracted out of the server action so integration
// tests can exercise them against real RLS without a Next.js request context.
// Mirrors the pattern in lib/members/service.ts and lib/invites/service.ts.

export type CardDetailUpdates = {
  title?: string;
  description?: string | null;
  due_date?: string | null;
  assignee_id?: string | null;
  labels?: string[];
};

export type UpdateCardDetailsResult =
  | { ok: true; boardId: string }
  | { ok: false; error: string };

const MAX_LABELS = 20;
const MAX_LABEL_LENGTH = 30;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// A date is valid only when its components actually form a real calendar day
// (month 13 or Feb 30 must be rejected, not just the YYYY-MM-DD shape).
function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeLabels(raw: string[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const rawLabel of raw) {
    const label = rawLabel.trim().slice(0, MAX_LABEL_LENGTH);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
    if (labels.length >= MAX_LABELS) break;
  }
  return labels;
}

// Updates one or more of a card's detail fields. The caller must be a workspace
// member of the card's board (RLS scopes every read/write here). The assignee
// is validated to be a workspace member because the DB only references
// auth.users, not workspace membership, so RLS alone cannot enforce it.
export async function updateCardDetails(
  supabase: SupabaseClient,
  input: { cardId: string; updates: CardDetailUpdates },
): Promise<UpdateCardDetailsResult> {
  const { cardId, updates } = input;

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

  const { data: board } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", column.board_id)
    .maybeSingle();
  if (!board) {
    return { ok: false, error: "Board not found." };
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) {
    const title = updates.title.trim();
    if (!title) {
      return { ok: false, error: "Card title is required." };
    }
    if (title.length > 200) {
      return {
        ok: false,
        error: "Card title must be 200 characters or fewer.",
      };
    }
    payload.title = title;
  }

  if (updates.description !== undefined) {
    const description =
      updates.description === null ? null : updates.description.trim() || null;
    payload.description = description;
  }

  if (updates.due_date !== undefined) {
    const dueDate = updates.due_date === null ? null : updates.due_date;
    if (dueDate !== null && !isValidDate(dueDate)) {
      return { ok: false, error: "Due date must be a valid date." };
    }
    payload.due_date = dueDate;
  }

  if (updates.assignee_id !== undefined) {
    const assigneeId =
      updates.assignee_id === null ? null : updates.assignee_id;
    if (assigneeId !== null) {
      const { data: member } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", board.workspace_id)
        .eq("user_id", assigneeId)
        .maybeSingle();
      if (!member) {
        return {
          ok: false,
          error: "Assignee must be a member of this workspace.",
        };
      }
    }
    payload.assignee_id = assigneeId;
  }

  if (updates.labels !== undefined) {
    payload.labels = normalizeLabels(updates.labels);
  }

  const { error: updateError } = await supabase
    .from("cards")
    .update(payload)
    .eq("id", cardId);

  if (updateError) {
    return {
      ok: false,
      error: updateError.message ?? "Failed to update card.",
    };
  }

  return { ok: true, boardId: column.board_id };
}