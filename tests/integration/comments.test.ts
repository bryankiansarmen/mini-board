import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createComment,
  deleteComment,
} from "@/lib/comments/service";

// Comment add/delete is plain RLS-authorized Supabase CRUD, exercised through
// the service with user-scoped clients (anon key + the user's JWT), exactly
// like the server actions. The negative tests (outsider, non-author) must fail
// at the database layer, not a UI filter.

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
    owner: `int-comments-owner-${stamp}@example.com`,
    member: `int-comments-member-${stamp}@example.com`,
    outsider: `int-comments-outsider-${stamp}@example.com`,
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
    .insert({ name: `Int Comments WS ${stamp}`, owner_id: ownerId })
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
      title: "Int Comments Board",
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
      title: "Int Comments Col",
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
      title: "Int Comments Card",
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

describe("comments: create", () => {
  it("lets a member create a comment with their author_id", async () => {
    const result = await createComment(memberClient, {
      cardId,
      body: "First comment",
      authorId: memberId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.comment.body).toBe("First comment");
    expect(result.comment.author_id).toBe(memberId);
    expect(result.comment.card_id).toBe(cardId);
  });

  it("lets the owner create a comment too", async () => {
    const result = await createComment(ownerClient, {
      cardId,
      body: "Owner comment",
      authorId: ownerId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.comment.author_id).toBe(ownerId);
  });

  it("trims the body and rejects empty input", async () => {
    const trimmed = await createComment(memberClient, {
      cardId,
      body: "   padded   ",
      authorId: memberId,
    });
    expect(trimmed.ok && trimmed.comment.body).toBe("padded");

    const empty = await createComment(memberClient, {
      cardId,
      body: "   ",
      authorId: memberId,
    });
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.error).toContain("cannot be empty");
    }
  });

  it("rejects a body over 2000 characters", async () => {
    const result = await createComment(memberClient, {
      cardId,
      body: "x".repeat(2001),
      authorId: memberId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("2000 characters or fewer");
    }
  });

  it("denies a non-member from creating a comment (RLS negative test)", async () => {
    const { error } = await outsiderClient.from("comments").insert({
      card_id: cardId,
      author_id: outsiderId,
      body: "Sneaky",
    });
    expect(error).not.toBeNull();
  });
});

describe("comments: delete", () => {
  it("lets the author delete their own comment", async () => {
    const created = await createComment(memberClient, {
      cardId,
      body: "Delete me",
      authorId: memberId,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await deleteComment(memberClient, {
      commentId: created.comment.id,
    });
    expect(result.ok).toBe(true);

    const { data: stillThere } = await service
      .from("comments")
      .select("id")
      .eq("id", created.comment.id)
      .maybeSingle();
    expect(stillThere).toBeNull();
  });

  it("DENIES a different member from deleting someone else's comment (RLS negative test)", async () => {
    const created = await createComment(ownerClient, {
      cardId,
      body: "Owner's protected comment",
      authorId: ownerId,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await deleteComment(memberClient, {
      commentId: created.comment.id,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("own comment");
    }

    const { data: stillThere } = await service
      .from("comments")
      .select("id")
      .eq("id", created.comment.id)
      .maybeSingle();
    expect(stillThere?.id).toBe(created.comment.id);
  });

  it("DENIES a non-member from deleting a comment (RLS negative test)", async () => {
    const created = await createComment(ownerClient, {
      cardId,
      body: "Protected delete",
      authorId: ownerId,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await deleteComment(outsiderClient, {
      commentId: created.comment.id,
    });
    expect(result.ok).toBe(false);

    const { data: stillThere } = await service
      .from("comments")
      .select("id")
      .eq("id", created.comment.id)
      .maybeSingle();
    expect(stillThere?.id).toBe(created.comment.id);
  });
});

describe("comments: visibility + cascade", () => {
  it("returns zero rows to a non-member", async () => {
    const { data, error } = await outsiderClient
      .from("comments")
      .select("id")
      .eq("card_id", cardId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("cascades comments away when the card is deleted", async () => {
    const created = await createComment(ownerClient, {
      cardId,
      body: "Cascade me",
      authorId: ownerId,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await service.from("cards").delete().eq("id", cardId);

    const { data: stillThere } = await service
      .from("comments")
      .select("id")
      .eq("id", created.comment.id)
      .maybeSingle();
    expect(stillThere).toBeNull();
  });
});