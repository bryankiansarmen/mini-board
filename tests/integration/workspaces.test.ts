import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const password = "correct-horse-battery-staple";

let service: SupabaseClient;
let ownerClient: SupabaseClient;
let memberClient: SupabaseClient;
let outsiderClient: SupabaseClient;
let ownerId: string;
let memberId: string;
let outsiderId: string;
let workspaceId: string;

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
    owner: `int-ws-owner-${stamp}@example.com`,
    member: `int-ws-member-${stamp}@example.com`,
    outsider: `int-ws-outsider-${stamp}@example.com`,
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
    .insert({ name: `Int WS RLS ${stamp}`, owner_id: ownerId })
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

describe("workspaces: visibility", () => {
  it("returns workspace to workspace members", async () => {
    const { data, error } = await memberClient
      .from("workspaces")
      .select("id, name")
      .eq("id", workspaceId)
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(workspaceId);
  });

  it("returns zero rows to a non-member (RLS negative test)", async () => {
    const { data, error } = await outsiderClient
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});

describe("workspaces: insert", () => {
  it("allows user to create a workspace where they are owner", async () => {
    const { data, error } = await outsiderClient
      .from("workspaces")
      .insert({ name: "Outsider Own WS", owner_id: outsiderId })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeDefined();

    // Clean up created workspace
    if (data?.id) {
      await service.from("workspaces").delete().eq("id", data.id);
    }
  });

  it("denies creating a workspace claiming someone else as owner (RLS negative test)", async () => {
    const { error } = await outsiderClient
      .from("workspaces")
      .insert({ name: "Impostor WS", owner_id: ownerId });

    expect(error).not.toBeNull();
  });
});

describe("workspaces: update", () => {
  it("allows owner to update workspace name", async () => {
    const { data, error } = await ownerClient
      .from("workspaces")
      .update({ name: "Updated WS Name" })
      .eq("id", workspaceId)
      .select("name")
      .single();

    expect(error).toBeNull();
    expect(data?.name).toBe("Updated WS Name");
  });

  it("denies non-owner member from updating workspace name (RLS negative test)", async () => {
    const { error, data } = await memberClient
      .from("workspaces")
      .update({ name: "Hacked by Member" })
      .eq("id", workspaceId)
      .select("id");

    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    } else {
      expect(data ?? []).toHaveLength(0);
    }

    const { data: current } = await service
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .single();
    expect(current?.name).not.toBe("Hacked by Member");
  });

  it("denies outsider from updating workspace name (RLS negative test)", async () => {
    const { error, data } = await outsiderClient
      .from("workspaces")
      .update({ name: "Hacked by Outsider" })
      .eq("id", workspaceId)
      .select("id");

    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    } else {
      expect(data ?? []).toHaveLength(0);
    }

    const { data: current } = await service
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .single();
    expect(current?.name).not.toBe("Hacked by Outsider");
  });
});

describe("workspaces: delete", () => {
  it("denies non-owner member from deleting workspace (RLS negative test)", async () => {
    const { error, data } = await memberClient
      .from("workspaces")
      .delete()
      .eq("id", workspaceId)
      .select("id");

    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    } else {
      expect(data ?? []).toHaveLength(0);
    }

    const { data: stillThere } = await service
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .maybeSingle();
    expect(stillThere).not.toBeNull();
  });

  it("denies outsider from deleting workspace (RLS negative test)", async () => {
    const { error, data } = await outsiderClient
      .from("workspaces")
      .delete()
      .eq("id", workspaceId)
      .select("id");

    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    } else {
      expect(data ?? []).toHaveLength(0);
    }

    const { data: stillThere } = await service
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .maybeSingle();
    expect(stillThere).not.toBeNull();
  });
});
