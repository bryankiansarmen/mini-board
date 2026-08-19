import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  detectPositionDrift,
  renormalizePositions,
} from "@/lib/shared/normalize";
import { updateCardDetails } from "@/lib/cards/service";

// Card CRUD is plain RLS-authorized Supabase CRUD, exercised through
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
let column2Id: string;

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

  // A second column on the same board, used by the moveCard tests so the
  // target column is always scoped to the same board (mirrors the guard in
  // the moveCard server action).
  const { data: column2, error: column2Error } = await service
    .from("columns")
    .insert({
      board_id: boardId,
      title: "Int Cards Col 2",
      position: 1,
    })
    .select("id")
    .single();
  if (column2Error || !column2) {
    throw new Error(`failed to create second test column: ${column2Error?.message}`);
  }
  column2Id = column2.id;

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

describe("cards: move", () => {
  it("lets a member move a card into another column on the same board", async () => {
    const card = await createCard(memberClient, "Move Me", 60);

    const { data, error } = await memberClient
      .from("cards")
      .update({
        column_id: column2Id,
        position: 0.5,
        updated_at: new Date().toISOString(),
      })
      .eq("id", card.id)
      .select("column_id, position")
      .single();

    expect(error).toBeNull();
    expect(data?.column_id).toBe(column2Id);
    expect(data?.position).toBe(0.5);
  });

  it("denies a non-member from moving a card (RLS negative test)", async () => {
    const card = await createCard(ownerClient, "Secure Move", 61);

    const { error, data } = await outsiderClient
      .from("cards")
      .update({
        column_id: column2Id,
        position: 0.75,
        updated_at: new Date().toISOString(),
      })
      .eq("id", card.id)
      .select("column_id");

    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    } else {
      expect(data ?? []).toHaveLength(0);
    }

    // The card must still be in its original column.
    const { data: stillThere } = await service
      .from("cards")
      .select("column_id")
      .eq("id", card.id)
      .maybeSingle();
    expect(stillThere?.column_id).toBe(columnId);
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

describe("cards: position re-normalization", () => {
  it("re-normalizes a column to whole-integer spacing after drift without reordering", async () => {
    // Dedicated column so the shared columnId fixture (used by other tests)
    // doesn't pollute the drift computation.
    const { data: renormColumn, error: columnError } = await ownerClient
      .from("columns")
      .insert({ board_id: boardId, title: "ReNorm Col", position: 3 })
      .select("id")
      .single();
    expect(columnError).toBeNull();
    const renormColumnId = renormColumn!.id;

    const insertCard = async (title: string, position: number) => {
      const { data, error } = await ownerClient
        .from("cards")
        .insert({
          column_id: renormColumnId,
          title,
          position,
        })
        .select("id, title, position")
        .single();
      if (error) throw new Error(`insert failed for ${title}: ${error.message}`);
      return data;
    };

    // Anchor two neighbors, then insert 25 cards at successive midpoints
    const first = await insertCard("ReNorm First", 0);
    const last = await insertCard("ReNorm Last", 1);
    const middleTitles: string[] = [];
    let prev = first!.position;
    const next = last!.position;
    for (let i = 0; i < 25; i++) {
      const position = (prev + next) / 2;
      const card = await insertCard(`ReNorm Mid ${i}`, position);
      middleTitles.push(card!.title);
      prev = position;
    }

    const { data: before } = await ownerClient
      .from("cards")
      .select("id, title, position")
      .eq("column_id", renormColumnId)
      .order("position", { ascending: true });

    const expectedOrder = ["ReNorm First", ...middleTitles, "ReNorm Last"];
    expect((before ?? []).map((card) => card.title)).toEqual(expectedOrder);
    expect(
      detectPositionDrift((before ?? []).map((card) => card.position)),
    ).toBe(true);

    // Replicate the renormalizeCardPositions server action through the
    // user-scoped client (the integration suite never imports server actions,
    // which need a Next.js request context).
    const normalized = renormalizePositions(before ?? []);
    const results = await Promise.all(
      normalized.map(({ id, position }) =>
        memberClient
          .from("cards")
          .update({ position, updated_at: new Date().toISOString() })
          .eq("id", id),
      ),
    );
    expect(results.every((result) => result.error === null)).toBe(true);

    const { data: after } = await ownerClient
      .from("cards")
      .select("title, position")
      .eq("column_id", renormColumnId)
      .order("position", { ascending: true });

    // Whole-integer spacing and the exact same relative order no card moved.
    expect((after ?? []).map((card) => card.title)).toEqual(expectedOrder);
    expect((after ?? []).map((card) => card.position)).toEqual(
      (after ?? []).map((_, i) => i),
    );
    // Every gap is now comfortably above the drift threshold.
    const gaps = (after ?? [])
      .slice(1)
      .map((card, i) => card.position - (after ?? [])[i]!.position);
    expect(Math.min(...gaps)).toBeGreaterThan(0.0001);
  });
});

describe("cards: detail fields", () => {
  it("lets a member set and then clear the description", async () => {
    const card = await createCard(memberClient, "Detail Desc", 70);

    const set = await updateCardDetails(memberClient, {
      cardId: card.id,
      updates: { description: "  Build the thing  " },
    });
    expect(set.ok).toBe(true);

    const { data: withDesc } = await service
      .from("cards")
      .select("description")
      .eq("id", card.id)
      .maybeSingle();
    expect(withDesc?.description).toBe("Build the thing");

    const clear = await updateCardDetails(memberClient, {
      cardId: card.id,
      updates: { description: null },
    });
    expect(clear.ok).toBe(true);

    const { data: cleared } = await service
      .from("cards")
      .select("description")
      .eq("id", card.id)
      .maybeSingle();
    expect(cleared?.description).toBeNull();
  });

  it("lets a member set and clear the due date and rejects an invalid one", async () => {
    const card = await createCard(memberClient, "Detail Due", 71);

    const set = await updateCardDetails(memberClient, {
      cardId: card.id,
      updates: { due_date: "2026-09-30" },
    });
    expect(set.ok).toBe(true);

    const { data: withDue } = await service
      .from("cards")
      .select("due_date")
      .eq("id", card.id)
      .maybeSingle();
    expect(withDue?.due_date).toBe("2026-09-30");

    const invalid = await updateCardDetails(memberClient, {
      cardId: card.id,
      updates: { due_date: "2026-13-45" },
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error).toBe("Due date must be a valid date.");
    }

    const clear = await updateCardDetails(memberClient, {
      cardId: card.id,
      updates: { due_date: null },
    });
    expect(clear.ok).toBe(true);

    const { data: cleared } = await service
      .from("cards")
      .select("due_date")
      .eq("id", card.id)
      .maybeSingle();
    expect(cleared?.due_date).toBeNull();
  });

  it("lets a member assign a workspace member and unassign them", async () => {
    const card = await createCard(memberClient, "Detail Assign", 72);

    const assign = await updateCardDetails(memberClient, {
      cardId: card.id,
      updates: { assignee_id: memberId },
    });
    expect(assign.ok).toBe(true);

    const { data: withAssignee } = await service
      .from("cards")
      .select("assignee_id")
      .eq("id", card.id)
      .maybeSingle();
    expect(withAssignee?.assignee_id).toBe(memberId);

    const unassign = await updateCardDetails(memberClient, {
      cardId: card.id,
      updates: { assignee_id: null },
    });
    expect(unassign.ok).toBe(true);

    const { data: unassigned } = await service
      .from("cards")
      .select("assignee_id")
      .eq("id", card.id)
      .maybeSingle();
    expect(unassigned?.assignee_id).toBeNull();
  });

  it("rejects assigning a user who is not a workspace member", async () => {
    const card = await createCard(memberClient, "Detail Bad Assign", 73);

    const result = await updateCardDetails(memberClient, {
      cardId: card.id,
      updates: { assignee_id: outsiderId },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Assignee must be a member of this workspace.");
    }

    const { data: unchanged } = await service
      .from("cards")
      .select("assignee_id")
      .eq("id", card.id)
      .maybeSingle();
    expect(unchanged?.assignee_id).toBeNull();
  });

  it("normalizes labels: trims, drops empties, dedupes case-insensitively", async () => {
    const card = await createCard(memberClient, "Detail Labels", 74);

    const result = await updateCardDetails(memberClient, {
      cardId: card.id,
      updates: {
        labels: ["  Frontend  ", "frontend", "", "  ", "Bug", "BUG"],
      },
    });
    expect(result.ok).toBe(true);

    const { data: withLabels } = await service
      .from("cards")
      .select("labels")
      .eq("id", card.id)
      .maybeSingle();
    expect(withLabels?.labels).toEqual(["Frontend", "Bug"]);
  });

  it("rejects a blank title", async () => {
    const card = await createCard(memberClient, "Detail Title", 75);

    const result = await updateCardDetails(memberClient, {
      cardId: card.id,
      updates: { title: "   " },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Card title is required.");
    }

    const { data: unchanged } = await service
      .from("cards")
      .select("title")
      .eq("id", card.id)
      .maybeSingle();
    expect(unchanged?.title).toBe("Detail Title");
  });

  it("denies a non-member from updating card details (RLS negative test)", async () => {
    const card = await createCard(ownerClient, "Detail Secure", 76);

    const result = await updateCardDetails(outsiderClient, {
      cardId: card.id,
      updates: { description: "Hacked" },
    });
    // RLS filters the card read to zero rows, so the outsider can never reach
    // the workspace membership check.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Card not found.");
    }

    const { data: stillThere } = await service
      .from("cards")
      .select("description")
      .eq("id", card.id)
      .maybeSingle();
    expect(stillThere?.description).toBeNull();
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
