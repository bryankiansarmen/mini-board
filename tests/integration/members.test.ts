import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { changeMemberRole, removeMember } from "@/lib/members/service";

// Integration tests run against the local Supabase instance (supabase start),
// using the service-role key. Real Postgres, real RLS. The service-role client
// is constructed inline here (not via @/lib/supabase/service) because that
// factory is restricted to Route Handlers by the import-boundary lint rule.

const password = "correct-horse-battery-staple";

let service: SupabaseClient;
let memberClient: SupabaseClient;
let outsiderClient: SupabaseClient;
let ownerId: string;
let adminId: string;
let memberId: string;
let targetId: string;
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
  adminId = await createUser("admin");
  memberId = await createUser("member");
  targetId = await createUser("target");
  outsiderId = await createUser("outsider");

  const { data: workspace, error: workspaceError } = await service
    .from("workspaces")
    .insert({ name: `Int Members WS ${stamp}`, owner_id: ownerId })
    .select("id")
    .single();
  if (workspaceError || !workspace) {
    throw new Error(`failed to create test workspace: ${workspaceError?.message}`);
  }
  workspaceId = workspace.id;

  // Owners must also be members (see createWorkspace action).
  await service.from("workspace_members").insert([
    { workspace_id: workspaceId, user_id: ownerId, role: "member" },
    { workspace_id: workspaceId, user_id: adminId, role: "admin" },
    { workspace_id: workspaceId, user_id: memberId, role: "member" },
    { workspace_id: workspaceId, user_id: targetId, role: "member" },
  ]);

  memberClient = await userClient(`int-member-${stamp}@example.com`);
  outsiderClient = await userClient(`int-outsider-${stamp}@example.com`);
});

afterAll(async () => {
  if (service && workspaceId) {
    // Deleting the workspace cascades to workspace_members + invite codes.
    await service.from("workspaces").delete().eq("id", workspaceId);
  }
  for (const id of [ownerId, adminId, memberId, targetId, outsiderId]) {
    if (id) {
      await service.auth.admin.deleteUser(id);
    }
  }
});

describe("removeMember", () => {
  it("lets an owner remove a plain member", async () => {
    const result = await removeMember(service, {
      workspaceId,
      targetUserId: memberId,
      callerId: ownerId,
    });
    expect(result).toEqual({ ok: true, removed: true });

    const { data: membership } = await service
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", memberId)
      .maybeSingle();
    expect(membership).toBeNull();
  });

  it("lets an admin remove a plain member", async () => {
    // Re-add the member removed above so the workspace state is consistent.
    await service.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: memberId,
      role: "member",
    });

    const result = await removeMember(service, {
      workspaceId,
      targetUserId: memberId,
      callerId: adminId,
    });
    expect(result).toEqual({ ok: true, removed: true });
  });

  it("rejects a plain member (not Owner/Admin)", async () => {
    await service.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: memberId,
      role: "member",
    });

    const result = await removeMember(service, {
      workspaceId,
      targetUserId: memberId,
      callerId: memberId,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
  });

  it("returns 409 for the workspace's sole Owner (last-owner invariant)", async () => {
    const result = await removeMember(service, {
      workspaceId,
      targetUserId: ownerId,
      callerId: adminId,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.error).toContain("Owner");
  });

  it("returns 404 for a user who is not a member", async () => {
    const result = await removeMember(service, {
      workspaceId,
      targetUserId: outsiderId,
      callerId: ownerId,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });
});

describe("changeMemberRole", () => {
  it("promotes a member to admin", async () => {
    const result = await changeMemberRole(service, {
      workspaceId,
      targetUserId: targetId,
      callerId: ownerId,
      role: "admin",
    });
    expect(result).toEqual({ ok: true, userId: targetId, role: "admin" });

    const { data: membership } = await service
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", targetId)
      .maybeSingle();
    expect(membership?.role).toBe("admin");
  });

  it("demotes an admin back to member", async () => {
    const result = await changeMemberRole(service, {
      workspaceId,
      targetUserId: targetId,
      callerId: ownerId,
      role: "member",
    });
    expect(result).toEqual({ ok: true, userId: targetId, role: "member" });
  });

  it("rejects a role outside admin/member with 400", async () => {
    const result = await changeMemberRole(service, {
      workspaceId,
      targetUserId: targetId,
      callerId: ownerId,
      role: "superadmin",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("rejects a plain member caller with 403", async () => {
    const result = await changeMemberRole(service, {
      workspaceId,
      targetUserId: targetId,
      callerId: memberId,
      role: "admin",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
  });

  it("returns 404 for a user who is not a member", async () => {
    const result = await changeMemberRole(service, {
      workspaceId,
      targetUserId: outsiderId,
      callerId: ownerId,
      role: "admin",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });
});

describe("workspace_members: direct RLS checks", () => {
  it("returns member list to a workspace member", async () => {
    const { data, error } = await memberClient
      .from("workspace_members")
      .select("user_id, role")
      .eq("workspace_id", workspaceId);

    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("returns zero rows to a non-member (RLS negative test)", async () => {
    const { data, error } = await outsiderClient
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("denies an outsider from directly inserting a member row (RLS negative test)", async () => {
    const { error } = await outsiderClient
      .from("workspace_members")
      .insert({
        workspace_id: workspaceId,
        user_id: outsiderId,
        role: "admin",
      });

    expect(error).not.toBeNull();
  });

  it("denies a plain member from directly escalating role to admin (RLS negative test)", async () => {
    const { error, data } = await memberClient
      .from("workspace_members")
      .update({ role: "admin" })
      .eq("workspace_id", workspaceId)
      .eq("user_id", memberId)
      .select("role");

    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    } else {
      expect(data ?? []).toHaveLength(0);
    }

    const { data: membership } = await service
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", memberId)
      .single();
    expect(membership?.role).toBe("member");
  });

  it("denies a plain member from directly removing another member (RLS negative test)", async () => {
    const { error, data } = await memberClient
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", targetId)
      .select("user_id");

    if (error) {
      expect(error.message.toLowerCase()).toContain("row-level security");
    } else {
      expect(data ?? []).toHaveLength(0);
    }

    const { data: stillMember } = await service
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", targetId)
      .maybeSingle();
    expect(stillMember).not.toBeNull();
  });
});