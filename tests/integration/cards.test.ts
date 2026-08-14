import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Card CRUD is plain RLS-authorized Supabase CRUD — exercised through
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
let columnId: string;

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

async function createCard(
  client: SupabaseClient,
  title: string,
  position: number,
) {
  const { data, error } = await client
    .from("cards")
    .insert({ column_id: columnId, title, position })
    .select("id, title, position")
    .single();
  if (error) {
    throw new Error(`failed to create test card "${title}": ${error.message}`);
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
    owner: `int-card-owner-${stamp}@example.com`,
    member: `int-card-member-${stamp}@example.com`,
    outsider: `int-card-outsider-${stamp}@example.com`,
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
    .insert({ name: `Int Cards WS ${stamp}`, owner_id: ownerId })
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
      title: "Int Cards Board",
      position: 0,
    })
    .select("id")
    .single();
  if (boardError || !board) {
    throw new Error(`failed to create test board: ${boardError?.message}`);
  }
  boardId = board.id;

  const { data: column, error: columnError } = await service
    .from("columns")
    .insert({
      board_id: boardId,
      title: "Int Cards Col",
      position: 0,
    })
    .select("id")
    .single();
  if (columnError || !column) {
    throw new Error(`failed to create test column: ${columnError?.message}`);
  }
  columnId = column.id;

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

describe("cards: create", () => {
  it("lets an owner create a card in the correct column", async () => {
    const card = await createCard(ownerClient, "Owner Card", 0);
    expect(card.title).toBe("Owner Card");
    expect(card.position).toBe(0);
  });

  it("lets a plain member create a card (RLS allows any workspace member)", async () => {
    const card = await createCard(memberClient, "Member Card", 1);
    expect(card.title).toBe("Member Card");
  });

  it("denies a non-member from creating a card", async () => {
    const { error } = await outsiderClient
      .from("cards")
      .insert({ column_id: columnId, title: "Sneaky", position: 2 });
    expect(error).not.toBeNull();
  });

  it("returns cards ordered by position for any member", async () => {
    await createCard(ownerClient, "Order C", 30);
    await createCard(ownerClient, "Order A", 10);
    await createCard(ownerClient, "Order B", 20);

    const { data, error } = await memberClient
      .from("cards")
      .select("title")
      .eq("column_id", columnId)
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

describe("cards: update", () => {
  it("lets a member rename a card (RLS allows update for any member)", async () => {
    const card = await createCard(memberClient, "Rename Me", 40);
    const { data, error } = await memberClient
      .from("cards")
      .update({ title: "Renamed" })
      .eq("id", card.id)
      .select("title")
      .single();

    expect(error).toBeNull();
    expect(data?.title).toBe("Renamed");
  });

  it("denies a non-member from renaming a card", async () => {
    const card = await createCard(ownerClient, "Secure Card", 41);
    const { error } = await outsiderClient
      .from("cards")
      .update({ title: "Hacked" })
      .eq("id", card.id);

    // RLS filters the row out of the UPDATE: either the error is the RLS
    // violation, or PostgREST silently updates zero rows. Either way the
    // title must be unchanged.
    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    }

    const { data: stillThere } = await service
      .from("cards")
      .select("title")
      .eq("id", card.id)
      .maybeSingle();
    expect(stillThere?.title).toBe("Secure Card");
  });
});

describe("cards: delete", () => {
  it("lets a member delete a card", async () => {
    const card = await createCard(memberClient, "Delete Me", 50);
    const { error } = await memberClient
      .from("cards")
      .delete()
      .eq("id", card.id);
    expect(error).toBeNull();

    const { data: stillThere } = await service
      .from("cards")
      .select("id")
      .eq("id", card.id)
      .maybeSingle();
    expect(stillThere).toBeNull();
  });

  it("DENIES a non-member from deleting a card (RLS negative test)", async () => {
    const card = await createCard(ownerClient, "Protected Card", 51);

    const { error, data } = await outsiderClient
      .from("cards")
      .delete()
      .eq("id", card.id)
      .select("id");

    // RLS either rejects with a violation or silently affects zero rows;
    // either way the card must still exist.
    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    } else {
      expect(data ?? []).toHaveLength(0);
    }

    const { data: stillThere } = await service
      .from("cards")
      .select("id, title")
      .eq("id", card.id)
      .maybeSingle();
    expect(stillThere?.title).toBe("Protected Card");
  });
});

describe("cards: non-member visibility", () => {
  it("returns zero cards to a non-member", async () => {
    const { data, error } = await outsiderClient
      .from("cards")
      .select("id")
      .eq("column_id", columnId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});

describe("cards: cascade", () => {
  it("deletes all cards in a column when the column is deleted", async () => {
    const a = await createCard(ownerClient, "Cascade A", 60);
    const b = await createCard(ownerClient, "Cascade B", 61);

    const { error } = await service
      .from("columns")
      .delete()
      .eq("id", columnId);
    expect(error).toBeNull();

    const { data: leftovers } = await service
      .from("cards")
      .select("id")
      .in("id", [a.id, b.id]);
    expect(leftovers ?? []).toHaveLength(0);
  });
});
