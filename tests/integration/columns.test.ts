import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Column CRUD is plain RLS-authorized Supabase CRUD — exercised through
// user-scoped clients (anon key + the user's JWT), exactly like the server
// actions. The negative tests (outsider) must fail at the database layer.

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
  // Sign in through a throwaway client so the shared `service` client never
  // accumulates a user session (see boards.test.ts).
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

async function createColumn(
  client: SupabaseClient,
  title: string,
  position: number,
) {
  const { data, error } = await client
    .from("columns")
    .insert({ board_id: boardId, title, position })
    .select("id, title, position")
    .single();
  if (error) {
    throw new Error(`failed to create test column "${title}": ${error.message}`);
  }
  return data;
}

beforeAll(async () => {
  service = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const stamp = Date.now();
  const emails = {
    owner: `int-col-owner-${stamp}@example.com`,
    member: `int-col-member-${stamp}@example.com`,
    outsider: `int-col-outsider-${stamp}@example.com`,
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
    .insert({ name: `Int Cols WS ${stamp}`, owner_id: ownerId })
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
      title: "Int Cols Board",
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

describe("columns: create", () => {
  it("lets an owner create a column", async () => {
    const column = await createColumn(ownerClient, "Owner Col", 0);
    expect(column.title).toBe("Owner Col");
  });

  it("lets a plain member create a column (RLS allows any workspace member)", async () => {
    const column = await createColumn(memberClient, "Member Col", 1);
    expect(column.title).toBe("Member Col");
  });

  it("denies a non-member from creating a column", async () => {
    const { error } = await outsiderClient
      .from("columns")
      .insert({ board_id: boardId, title: "Sneaky", position: 2 });
    expect(error).not.toBeNull();
  });

  it("returns columns ordered by position for any member", async () => {
    await createColumn(ownerClient, "Order C", 30);
    await createColumn(ownerClient, "Order A", 10);
    await createColumn(ownerClient, "Order B", 20);

    const { data, error } = await memberClient
      .from("columns")
      .select("title")
      .eq("board_id", boardId)
      .order("position", { ascending: true });

    expect(error).toBeNull();
    const titles = (data ?? []).map((row) => row.title);
    expect(titles.filter((t) => t.startsWith("Order"))).toEqual([
      "Order A",
      "Order B",
      "Order C",
    ]);
  });
});

describe("columns: rename", () => {
  it("lets a member rename a column (RLS allows update for any member)", async () => {
    const column = await createColumn(memberClient, "Rename Me", 40);
    const { data, error } = await memberClient
      .from("columns")
      .update({ title: "Renamed" })
      .eq("id", column.id)
      .select("title")
      .single();

    expect(error).toBeNull();
    expect(data?.title).toBe("Renamed");
  });

  it("denies a non-member from renaming a column", async () => {
    const column = await createColumn(ownerClient, "Secure Col", 41);
    const { error } = await outsiderClient
      .from("columns")
      .update({ title: "Hacked" })
      .eq("id", column.id);

    // RLS filters the row out of the UPDATE: either the error is the RLS
    // violation, or PostgREST silently updates zero rows. Either way the
    // title must be unchanged.
    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    }

    const { data: stillThere } = await service
      .from("columns")
      .select("title")
      .eq("id", column.id)
      .maybeSingle();
    expect(stillThere?.title).toBe("Secure Col");
  });
});

describe("columns: delete", () => {
  it("lets a member delete a column", async () => {
    const column = await createColumn(memberClient, "Delete Me", 50);
    const { error } = await memberClient
      .from("columns")
      .delete()
      .eq("id", column.id);
    expect(error).toBeNull();

    const { data: stillThere } = await service
      .from("columns")
      .select("id")
      .eq("id", column.id)
      .maybeSingle();
    expect(stillThere).toBeNull();
  });

  it("DENIES a non-member from deleting a column (RLS negative test)", async () => {
    const column = await createColumn(ownerClient, "Protected Col", 51);

    const { error, data } = await outsiderClient
      .from("columns")
      .delete()
      .eq("id", column.id)
      .select("id");

    // RLS either rejects with a violation or silently affects zero rows;
    // either way the column must still exist.
    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    } else {
      expect(data ?? []).toHaveLength(0);
    }

    const { data: stillThere } = await service
      .from("columns")
      .select("id, title")
      .eq("id", column.id)
      .maybeSingle();
    expect(stillThere?.title).toBe("Protected Col");
  });
});

describe("columns: reorder (fractional position)", () => {
  it("persists a fractional position after a simulated drag", async () => {
    const a = await createColumn(ownerClient, "Drag A", 100);
    const b = await createColumn(ownerClient, "Drag B", 200);

    // Simulate dragging A between B and the next neighbor: position = midpoint.
    const midpoint = (a.position + b.position) / 2;
    const { error } = await ownerClient
      .from("columns")
      .update({ position: midpoint })
      .eq("id", a.id);
    expect(error).toBeNull();

    const { data: updated, error: readError } = await ownerClient
      .from("columns")
      .select("position")
      .eq("id", a.id)
      .single();
    expect(readError).toBeNull();
    expect(updated?.position).toBe(150);
  });

  it("reorders columns by position after consecutive drags without ties", async () => {
    const _a = await createColumn(ownerClient, "Swap A", 1000);
    const b = await createColumn(ownerClient, "Swap B", 1001);
    const c = await createColumn(ownerClient, "Swap C", 1002);

    // Move C to the front, then B to the front: fractional halving.
    await ownerClient
      .from("columns")
      .update({ position: -1 })
      .eq("id", c.id);
    await ownerClient
      .from("columns")
      .update({ position: -1.5 })
      .eq("id", b.id);

    const { data } = await ownerClient
      .from("columns")
      .select("title, position")
      .eq("board_id", boardId)
      .gte("position", -10)
      .order("position", { ascending: true });

    const rows = data ?? [];
    const titles = rows.filter((r) => r.title.startsWith("Swap")).map((r) => r.title);
    expect(titles).toEqual(["Swap B", "Swap C", "Swap A"]);
  });
});

describe("columns: non-member visibility", () => {
  it("returns zero columns to a non-member", async () => {
    const { data, error } = await outsiderClient
      .from("columns")
      .select("id")
      .eq("board_id", boardId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
