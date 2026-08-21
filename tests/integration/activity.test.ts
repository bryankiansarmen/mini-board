import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createActivity } from "@/lib/activity/service";

// Activity log is append-only: every action inserts a row; no UPDATE or DELETE
// is ever performed. RLS enforces actor_id = auth.uid() and workspace
// membership on the board. Integration tests exercise the service against real
// RLS with user-scoped clients (same pattern as comments/checklist tests).

const password = "correct-horse-battery-staple";

let service: SupabaseClient;
let ownerClient: SupabaseClient;
let memberClient: SupabaseClient;
let outsiderClient: SupabaseClient;
let ownerId: string;
let memberId: string;
let outsiderId: string;
let workspaceId: string;
let boardId: string;

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
    owner: `int-activity-owner-${stamp}@example.com`,
    member: `int-activity-member-${stamp}@example.com`,
    outsider: `int-activity-outsider-${stamp}@example.com`,
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
    .insert({ name: `Int Activity WS ${stamp}`, owner_id: ownerId })
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
      title: "Int Activity Board",
      position: 0,
    })
    .select("id")
    .single();
  if (boardError || !board) {
    throw new Error(`failed to create test board: ${boardError?.message}`);
  }
  boardId = board.id;

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

describe("activity: create", () => {
  it("lets a member insert activity with their actor_id", async () => {
    const result = await createActivity(memberClient, {
      boardId,
      action: "card_created",
      metadata: { cardTitle: "Test card", columnTitle: "To Do" },
      actorId: memberId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.activity.action).toBe("card_created");
    expect(result.activity.actor_id).toBe(memberId);
    expect(result.activity.board_id).toBe(boardId);
    expect(result.activity.metadata).toMatchObject({
      cardTitle: "Test card",
      columnTitle: "To Do",
    });
  });

  it("lets the owner insert activity too", async () => {
    const result = await createActivity(ownerClient, {
      boardId,
      action: "card_moved",
      metadata: {
        cardTitle: "Moved card",
        fromColumn: "To Do",
        toColumn: "Done",
      },
      actorId: ownerId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.activity.actor_id).toBe(ownerId);
    expect(result.activity.metadata).toMatchObject({
      cardTitle: "Moved card",
      fromColumn: "To Do",
      toColumn: "Done",
    });
  });

  it("stores metadata as JSONB", async () => {
    const result = await createActivity(ownerClient, {
      boardId,
      action: "column_deleted",
      metadata: { columnTitle: "Archived", cardCount: 3 },
      actorId: ownerId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.activity.metadata).toBe("object");
    expect(result.activity.metadata).toMatchObject({
      columnTitle: "Archived",
      cardCount: 3,
    });
  });

  it("denies a non-member from inserting activity (RLS negative test)", async () => {
    const result = await createActivity(outsiderClient, {
      boardId,
      action: "card_created",
      metadata: { cardTitle: "Sneaky", columnTitle: "To Do" },
      actorId: outsiderId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeDefined();
    }
  });
});

describe("activity: visibility", () => {
  it("returns activity rows to workspace members", async () => {
    const { data, error } = await ownerClient
      .from("activity_log")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: false });
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("returns zero rows to a non-member", async () => {
    const { data, error } = await outsiderClient
      .from("activity_log")
      .select("id")
      .eq("board_id", boardId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});

describe("activity: immutability", () => {
  it("denies UPDATE on activity rows (no update policy)", async () => {
    const created = await createActivity(ownerClient, {
      boardId,
      action: "card_created",
      metadata: { cardTitle: "Immutable", columnTitle: "To Do" },
      actorId: ownerId,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const { error } = await ownerClient
      .from("activity_log")
      .update({ action: "hacked" })
      .eq("id", created.activity.id);
    expect(error).not.toBeNull();
  });

  it("denies DELETE on activity rows (no delete policy)", async () => {
    const created = await createActivity(ownerClient, {
      boardId,
      action: "card_deleted",
      metadata: { cardTitle: "Delete me", columnTitle: "To Do" },
      actorId: ownerId,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const { error } = await ownerClient
      .from("activity_log")
      .delete()
      .eq("id", created.activity.id);
    expect(error).not.toBeNull();
  });
});

describe("activity: cascade", () => {
  it("cascades activity away when the board is deleted", async () => {
    // Create a temporary board for this test
    const { data: tempBoard } = await service
      .from("boards")
      .insert({
        workspace_id: workspaceId,
        title: "Temp Cascade Board",
        position: 99,
      })
      .select("id")
      .single();
    if (!tempBoard) return;

    const created = await createActivity(ownerClient, {
      boardId: tempBoard.id,
      action: "column_created",
      metadata: { columnTitle: "Temp col" },
      actorId: ownerId,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Delete the board; activity should cascade
    await service.from("boards").delete().eq("id", tempBoard.id);

    const { data: stillThere } = await service
      .from("activity_log")
      .select("id")
      .eq("id", created.activity.id)
      .maybeSingle();
    expect(stillThere).toBeNull();
  });
});
