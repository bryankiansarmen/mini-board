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
let ownerId: string;
let adminId: string;
let memberId: string;
let targetId: string;
let outsiderId: string;
let workspaceId: string;

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