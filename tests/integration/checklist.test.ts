import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
} from "@/lib/checklist/service";

// Checklist item CRUD is plain RLS-authorized Supabase CRUD, exercised through
// the service with user-scoped clients (anon key + the user's JWT), exactly
// like the server actions. The negative tests (outsider) must fail at the
// database layer, not a UI filter.

const password = "correct-horse-battery-staple";

let service: SupabaseClient;
let ownerClient: SupabaseClient;
let memberClient: SupabaseClient;
let outsiderClient: SupabaseClient;
let ownerId: string;
let memberId: string;
let outsiderId: string;
let workspaceId: string;
let cardId: string;

async function userClient(email: string): Promise<SupabaseClient> {
  const authClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    throw new Error(`failed to sign in ${email}: ${error?.message}`);
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      },
    },
  );
}

beforeAll(async () => {
  service = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const stamp = Date.now();
  const emails = {
    owner: `int-checklist-owner-${stamp}@example.com`,
    member: `int-checklist-member-${stamp}@example.com`,
    outsider: `int-checklist-outsider-${stamp}@example.com`,
  };

  const createUser = async (email: string) => {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`failed to create user ${email}: ${error?.message}`);
    }
    return data.user.id;
  };

  ownerId = await createUser(emails.owner);
  memberId = await createUser(emails.member);
  outsiderId = await createUser(emails.outsider);

  const { data: workspace, error: workspaceError } = await service
    .from("workspaces")
    .insert({ name: `Int Checklist WS ${stamp}`, owner_id: ownerId })
    .select("id")
    .single();
  if (workspaceError || !workspace) {
    throw new Error(
      `failed to create test workspace: ${workspaceError?.message}`,
    );
  }
  workspaceId = workspace.id;

  await service.from("workspace_members").insert([
    { workspace_id: workspaceId, user_id: ownerId, role: "member" },
    { workspace_id: workspaceId, user_id: memberId, role: "member" },
  ]);

  const { data: board, error: boardError } = await service
    .from("boards")
    .insert({
      workspace_id: workspaceId,
      title: "Int Checklist Board",
      position: 0,
    })
    .select("id")
    .single();
  if (boardError || !board) {
    throw new Error(`failed to create test board: ${boardError?.message}`);
  }

  const { data: column, error: columnError } = await service
    .from("columns")
    .insert({
      board_id: board.id,
      title: "Int Checklist Col",
      position: 0,
    })
    .select("id")
    .single();
  if (columnError || !column) {
    throw new Error(`failed to create test column: ${columnError?.message}`);
  }

  const { data: card, error: cardError } = await service
    .from("cards")
    .insert({
      column_id: column.id,
      title: "Int Checklist Card",
      position: 0,
    })
    .select("id")
    .single();
  if (cardError || !card) {
    throw new Error(`failed to create test card: ${cardError?.message}`);
  }
  cardId = card.id;

  ownerClient = await userClient(emails.owner);
  memberClient = await userClient(emails.member);
  outsiderClient = await userClient(emails.outsider);
});

afterAll(async () => {
  if (service && workspaceId) {
    await service.from("workspaces").delete().eq("id", workspaceId);
  }
  for (const id of [ownerId, memberId, outsiderId]) {
    if (id) {
      await service.auth.admin.deleteUser(id);
    }
  }
});

describe("checklist items: create", () => {
  it("lets a member append an item at position 0 for an empty card", async () => {
    const result = await createChecklistItem(memberClient, {
      cardId,
      content: "First item",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.item.content).toBe("First item");
    expect(result.item.position).toBe(0);
    expect(result.item.is_complete).toBe(false);
  });

  it("appends subsequent items at the next whole-integer position", async () => {
    const first = await createChecklistItem(ownerClient, {
      cardId,
      content: "Second item",
    });
    expect(first.ok && first.item.position).toBe(1);
    const second = await createChecklistItem(ownerClient, {
      cardId,
      content: "Third item",
    });
    expect(second.ok && second.item.position).toBe(2);
  });

  it("trims content and rejects empty input", async () => {
    const trimmed = await createChecklistItem(memberClient, {
      cardId,
      content: "   padded   ",
    });
    expect(trimmed.ok && trimmed.item.content).toBe("padded");

    const empty = await createChecklistItem(memberClient, {
      cardId,
      content: "   ",
    });
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.error).toContain("required");
    }
  });

  it("rejects content over 200 characters", async () => {
    const result = await createChecklistItem(memberClient, {
      cardId,
      content: "x".repeat(201),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("200 characters or fewer");
    }
  });

  it("denies a non-member from creating an item (RLS negative test)", async () => {
    const { error } = await outsiderClient
      .from("checklist_items")
      .insert({ card_id: cardId, content: "Sneaky", position: 0 });
    expect(error).not.toBeNull();
  });
});

describe("checklist items: toggle", () => {
  it("lets a member mark an item complete and unmark it", async () => {
    const created = await createChecklistItem(memberClient, {
      cardId,
      content: "Toggle me",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const completed = await toggleChecklistItem(memberClient, {
      itemId: created.item.id,
      isComplete: true,
    });
    expect(completed.ok && completed.item.is_complete).toBe(true);

    const reopened = await toggleChecklistItem(memberClient, {
      itemId: created.item.id,
      isComplete: false,
    });
    expect(reopened.ok && reopened.item.is_complete).toBe(false);
  });

  it("denies a non-member from toggling an item (RLS negative test)", async () => {
    const created = await createChecklistItem(ownerClient, {
      cardId,
      content: "Protected toggle",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const { error } = await outsiderClient
      .from("checklist_items")
      .update({ is_complete: true })
      .eq("id", created.item.id);

    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    }

    const { data: stillThere } = await service
      .from("checklist_items")
      .select("is_complete")
      .eq("id", created.item.id)
      .maybeSingle();
    expect(stillThere?.is_complete).toBe(false);
  });
});

describe("checklist items: delete", () => {
  it("lets a member delete an item", async () => {
    const created = await createChecklistItem(memberClient, {
      cardId,
      content: "Delete me",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await deleteChecklistItem(memberClient, {
      itemId: created.item.id,
    });
    expect(result.ok).toBe(true);

    const { data: stillThere } = await service
      .from("checklist_items")
      .select("id")
      .eq("id", created.item.id)
      .maybeSingle();
    expect(stillThere).toBeNull();
  });

  it("DENIES a non-member from deleting an item (RLS negative test)", async () => {
    const created = await createChecklistItem(ownerClient, {
      cardId,
      content: "Protected delete",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const { error, data } = await outsiderClient
      .from("checklist_items")
      .delete()
      .eq("id", created.item.id)
      .select("id");

    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    } else {
      expect(data ?? []).toHaveLength(0);
    }

    const { data: stillThere } = await service
      .from("checklist_items")
      .select("id")
      .eq("id", created.item.id)
      .maybeSingle();
    expect(stillThere?.id).toBe(created.item.id);
  });
});

describe("checklist items: visibility + cascade", () => {
  it("returns zero rows to a non-member", async () => {
    const { data, error } = await outsiderClient
      .from("checklist_items")
      .select("id")
      .eq("card_id", cardId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("cascades checklist items away when the card is deleted", async () => {
    const created = await createChecklistItem(ownerClient, {
      cardId,
      content: "Cascade me",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await service.from("cards").delete().eq("id", cardId);

    const { data: stillThere } = await service
      .from("checklist_items")
      .select("id")
      .eq("id", created.item.id)
      .maybeSingle();
    expect(stillThere).toBeNull();
  });
});