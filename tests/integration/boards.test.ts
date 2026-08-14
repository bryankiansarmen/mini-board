import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Board CRUD is plain RLS-authorized Supabase CRUD — there is no service-layer
// function to call. So these tests exercise RLS directly through a
// user-scoped client (anon key + the user's JWT), which is what the server
// actions use. That is the only way the "member cannot delete a board"
// negative test is meaningful: it must fail at the database layer.

const password = "correct-horse-battery-staple";

let service: SupabaseClient;
let ownerClient: SupabaseClient;
let adminClient: SupabaseClient;
let memberClient: SupabaseClient;
let outsiderClient: SupabaseClient;
let ownerId: string;
let adminId: string;
let memberId: string;
let outsiderId: string;
let workspaceId: string;

async function userClient(email: string): Promise<SupabaseClient> {
  // Sign in through a throwaway client so the shared `service` client never
  // accumulates a user session. Otherwise its later .from() queries would run
  // under the last signed-in user's RLS (as the outsider here), not the
  // service role.
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

async function createBoard(
  client: SupabaseClient,
  title: string,
  position: number,
) {
  const { data, error } = await client
    .from("boards")
    .insert({ workspace_id: workspaceId, title, position })
    .select("id, title, workspace_id, position")
    .single();
  if (error) {
    throw new Error(`failed to create test board "${title}": ${error.message}`);
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
    owner: `int-board-owner-${stamp}@example.com`,
    admin: `int-board-admin-${stamp}@example.com`,
    member: `int-board-member-${stamp}@example.com`,
    outsider: `int-board-outsider-${stamp}@example.com`,
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
  adminId = await createUser(emails.admin);
  memberId = await createUser(emails.member);
  outsiderId = await createUser(emails.outsider);

  const { data: workspace, error: workspaceError } = await service
    .from("workspaces")
    .insert({ name: `Int Boards WS ${stamp}`, owner_id: ownerId })
    .select("id")
    .single();
  if (workspaceError || !workspace) {
    throw new Error(
      `failed to create test workspace: ${workspaceError?.message}`,
    );
  }
  workspaceId = workspace.id;

  // Owners must also be members (see createWorkspace action).
  await service.from("workspace_members").insert([
    { workspace_id: workspaceId, user_id: ownerId, role: "member" },
    { workspace_id: workspaceId, user_id: adminId, role: "admin" },
    { workspace_id: workspaceId, user_id: memberId, role: "member" },
  ]);

  ownerClient = await userClient(emails.owner);
  adminClient = await userClient(emails.admin);
  memberClient = await userClient(emails.member);
  outsiderClient = await userClient(emails.outsider);
});

afterAll(async () => {
  if (service && workspaceId) {
    await service.from("workspaces").delete().eq("id", workspaceId);
  }
  for (const id of [ownerId, adminId, memberId, outsiderId]) {
    if (id) {
      await service.auth.admin.deleteUser(id);
    }
  }
});

describe("boards: create", () => {
  it("lets an owner create a board", async () => {
    const board = await createBoard(ownerClient, "Owner Board", 0);
    expect(board.title).toBe("Owner Board");
    expect(board.workspace_id).toBe(workspaceId);
  });

  it("lets a plain member create a board (RLS allows insert for any member)", async () => {
    const board = await createBoard(memberClient, "Member Board", 1);
    expect(board.title).toBe("Member Board");
    expect(board.workspace_id).toBe(workspaceId);
  });

  it("denies a non-member from creating a board", async () => {
    const { error } = await outsiderClient
      .from("boards")
      .insert({ workspace_id: workspaceId, title: "Sneaky", position: 2 });
    expect(error).not.toBeNull();
  });

  it("returns boards ordered by position for any member", async () => {
    await createBoard(ownerClient, "Order C", 30);
    await createBoard(ownerClient, "Order A", 10);
    await createBoard(ownerClient, "Order B", 20);

    const { data, error } = await memberClient
      .from("boards")
      .select("title")
      .eq("workspace_id", workspaceId)
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

describe("boards: rename", () => {
  it("lets a member rename a board (RLS allows update for any member)", async () => {
    const board = await createBoard(memberClient, "Rename Me", 40);
    const { data, error } = await memberClient
      .from("boards")
      .update({ title: "Renamed" })
      .eq("id", board.id)
      .select("title")
      .single();

    expect(error).toBeNull();
    expect(data?.title).toBe("Renamed");
  });

  it("lets the owner rename a board", async () => {
    const board = await createBoard(ownerClient, "Owner Rename", 41);
    const { data, error } = await ownerClient
      .from("boards")
      .update({ title: "Owner Renamed" })
      .eq("id", board.id)
      .select("title")
      .single();

    expect(error).toBeNull();
    expect(data?.title).toBe("Owner Renamed");
  });
});

describe("boards: delete", () => {
  it("lets an admin delete a board", async () => {
    const board = await createBoard(adminClient, "Admin Delete", 50);
    const { error } = await adminClient
      .from("boards")
      .delete()
      .eq("id", board.id);
    expect(error).toBeNull();

    const { data: stillThere } = await service
      .from("boards")
      .select("id")
      .eq("id", board.id)
      .maybeSingle();
    expect(stillThere).toBeNull();
  });

  it("lets the owner delete a board", async () => {
    const board = await createBoard(ownerClient, "Owner Delete", 51);
    const { error } = await ownerClient
      .from("boards")
      .delete()
      .eq("id", board.id);
    expect(error).toBeNull();

    const { data: stillThere } = await service
      .from("boards")
      .select("id")
      .eq("id", board.id)
      .maybeSingle();
    expect(stillThere).toBeNull();
  });

  it("DENIES a plain member from deleting a board (RLS negative test)", async () => {
    // Member role must be denied board delete by RLS, not just the UI.
    const board = await createBoard(ownerClient, "Protected Board", 52);

    const { error, data } = await memberClient
      .from("boards")
      .delete()
      .eq("id", board.id)
      .select("id");

    // RLS filters the row out of the DELETE entirely: either the error is the
    // RLS violation, or PostgREST silently affects zero rows. Either way the
    // board must still exist.
    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    } else {
      expect(data ?? []).toHaveLength(0);
    }

    const { data: stillThere } = await service
      .from("boards")
      .select("id, title")
      .eq("id", board.id)
      .maybeSingle();
    expect(stillThere?.title).toBe("Protected Board");
  });
});

describe("boards: non-member visibility", () => {
  it("returns zero boards to a non-member", async () => {
    const { data, error } = await outsiderClient
      .from("boards")
      .select("id")
      .eq("workspace_id", workspaceId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
