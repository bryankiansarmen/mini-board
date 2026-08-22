import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { acceptInviteCode, createInviteCode } from "@/lib/invites/service";

// Integration tests run against the local Supabase instance (supabase start),
// using the service-role key. Real Postgres, real RLS. The service-role client
// is constructed inline here (not via @/lib/supabase/service) because that
// factory is restricted to Route Handlers by the import-boundary lint rule.

const password = "correct-horse-battery-staple";

let service: SupabaseClient;
let memberClient: SupabaseClient;
let outsiderClient: SupabaseClient;
let ownerId: string;
let memberId: string;
let joinerId: string;
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

async function makeCode(): Promise<string> {
  const result = await createInviteCode(service, {
    workspaceId,
    userId: ownerId,
  });
  if (!result.ok) {
    throw new Error(`failed to create invite code in setup: ${result.error}`);
  }
  return result.code;
}

beforeAll(async () => {
  service = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const stamp = Date.now();
  const createUser = async (prefix: string) => {
    const { data, error } = await service.auth.admin.createUser({
      email: `int-${prefix}-${stamp}@example.com`,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`failed to create test user ${prefix}: ${error?.message}`);
    }
    return data.user.id;
  };

  ownerId = await createUser("owner");
  memberId = await createUser("member");
  joinerId = await createUser("joiner");
  outsiderId = await createUser("outsider");

  const { data: workspace, error: workspaceError } = await service
    .from("workspaces")
    .insert({ name: `Int Workspace ${stamp}`, owner_id: ownerId })
    .select("id")
    .single();
  if (workspaceError || !workspace) {
    throw new Error(`failed to create test workspace: ${workspaceError?.message}`);
  }
  workspaceId = workspace.id;

  // Owners must also be members (see createWorkspace action). Add an extra
  // plain member for the non-admin rejection test.
  await service.from("workspace_members").insert([
    { workspace_id: workspaceId, user_id: ownerId, role: "member" },
    { workspace_id: workspaceId, user_id: memberId, role: "member" },
  ]);

  memberClient = await userClient(`int-member-${stamp}@example.com`);
  outsiderClient = await userClient(`int-outsider-${stamp}@example.com`);
});

afterAll(async () => {
  if (service && workspaceId) {
    // Deleting the workspace cascades to workspace_members + invite codes.
    await service.from("workspaces").delete().eq("id", workspaceId);
  }
  for (const id of [ownerId, memberId, joinerId, outsiderId]) {
    if (id) {
      await service.auth.admin.deleteUser(id);
    }
  }
});

describe("createInviteCode", () => {
  it("generates a code for the owner with a future expiry", async () => {
    const result = await createInviteCode(service, {
      workspaceId,
      userId: ownerId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a plain member (not Owner/Admin)", async () => {
    const result = await createInviteCode(service, {
      workspaceId,
      userId: memberId,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
  });

  it("returns 404 for a nonexistent workspace", async () => {
    const result = await createInviteCode(service, {
      workspaceId: "00000000-0000-0000-0000-000000000000",
      userId: ownerId,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });
});

describe("acceptInviteCode", () => {
  it("adds the caller as a member on the success path", async () => {
    const code = await makeCode();
    const result = await acceptInviteCode(service, { code, userId: joinerId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workspaceId).toBe(workspaceId);
    expect(result.workspaceName).toContain("Int Workspace");

    const { data: membership } = await service
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", joinerId)
      .maybeSingle();
    expect(membership?.role).toBe("member");
  });

  it("returns 410 for an expired code", async () => {
    const code = await makeCode();
    await service
      .from("workspace_invite_codes")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("code", code);

    const result = await acceptInviteCode(service, {
      code,
      userId: outsiderId,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(410);
  });

  it("returns 404 for an unknown code", async () => {
    const result = await acceptInviteCode(service, {
      code: "ZZZZ-ZZZZ",
      userId: outsiderId,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });

  it("returns 409 when the caller is already a member", async () => {
    const code = await makeCode();
    const result = await acceptInviteCode(service, {
      code,
      userId: joinerId,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
  });
});

describe("workspace_invite_codes: direct RLS checks", () => {
  it("returns invite codes to a workspace member", async () => {
    await makeCode();
    const { data, error } = await memberClient
      .from("workspace_invite_codes")
      .select("code")
      .eq("workspace_id", workspaceId);

    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("returns zero rows to a non-member (RLS negative test)", async () => {
    const { data, error } = await outsiderClient
      .from("workspace_invite_codes")
      .select("code")
      .eq("workspace_id", workspaceId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("denies direct client insert on workspace_invite_codes (RLS negative test)", async () => {
    const { error } = await memberClient
      .from("workspace_invite_codes")
      .insert({
        workspace_id: workspaceId,
        code: "TEST-CODE",
        created_by: memberId,
      });

    expect(error).not.toBeNull();
  });

  it("denies direct client delete on workspace_invite_codes (RLS negative test)", async () => {
    const code = await makeCode();
    const { error, data } = await memberClient
      .from("workspace_invite_codes")
      .delete()
      .eq("code", code)
      .select("id");

    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    } else {
      expect(data ?? []).toHaveLength(0);
    }

    const { data: stillThere } = await service
      .from("workspace_invite_codes")
      .select("code")
      .eq("code", code)
      .maybeSingle();
    expect(stillThere).not.toBeNull();
  });
});