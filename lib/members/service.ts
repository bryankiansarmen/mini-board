import type { SupabaseClient } from "@supabase/supabase-js";

export type RemoveMemberResult =
  | { ok: true; removed: true }
  | { ok: false; status: number; error: string };

export type ChangeMemberRoleResult =
  | { ok: true; userId: string; role: "admin" | "member" }
  | { ok: false; status: number; error: string };

const VALID_ROLES = new Set(["admin", "member"]);

// Removes a member from a workspace. The caller must be an Owner or Admin.
// Enforces the last-owner invariant: the workspace's Owner cannot be removed
// (409). Kept out of the Route Handler so integration tests can exercise it
// without a Next.js request context.
export async function removeMember(
  service: SupabaseClient,
  input: { workspaceId: string; targetUserId: string; callerId: string },
): Promise<RemoveMemberResult> {
  const { workspaceId, targetUserId, callerId } = input;

  const { data: isAdmin, error: adminError } = await service.rpc(
    "is_workspace_admin",
    { ws_id: workspaceId, uid: callerId },
  );

  if (adminError) {
    return { ok: false, status: 500, error: "Failed to check permissions." };
  }

  if (!isAdmin) {
    return {
      ok: false,
      status: 403,
      error: "You must be an Owner or Admin to manage members.",
    };
  }

  // Last-owner invariant: the workspace's Owner cannot be removed.
  const { data: workspace, error: workspaceError } = await service
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError || !workspace) {
    return { ok: false, status: 404, error: "Workspace not found." };
  }

  if (workspace.owner_id === targetUserId) {
    return {
      ok: false,
      status: 409,
      error: "The workspace Owner cannot be removed.",
    };
  }

  // Target must currently be a member.
  const { data: target, error: targetError } = await service
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetError) {
    return { ok: false, status: 500, error: "Failed to check membership." };
  }

  if (!target) {
    return {
      ok: false,
      status: 404,
      error: "That user is not a member of this workspace.",
    };
  }

  const { error: deleteError } = await service
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId);

  if (deleteError) {
    return {
      ok: false,
      status: 500,
      error: deleteError.message ?? "Failed to remove the member.",
    };
  }

  return { ok: true, removed: true };
}

// Changes a member's role between admin and member. The caller must be an
// Owner or Admin. The workspace Owner's real authority comes from the
// owner_id check inside is_workspace_admin, so editing the Owner's stored
// role never actually demotes them; it is permitted rather than special-cased.
export async function changeMemberRole(
  service: SupabaseClient,
  input: {
    workspaceId: string;
    targetUserId: string;
    callerId: string;
    role: string;
  },
): Promise<ChangeMemberRoleResult> {
  const { workspaceId, targetUserId, callerId, role } = input;

  if (!VALID_ROLES.has(role)) {
    return { ok: false, status: 400, error: "Role must be 'admin' or 'member'." };
  }

  const { data: isAdmin, error: adminError } = await service.rpc(
    "is_workspace_admin",
    { ws_id: workspaceId, uid: callerId },
  );

  if (adminError) {
    return { ok: false, status: 500, error: "Failed to check permissions." };
  }

  if (!isAdmin) {
    return {
      ok: false,
      status: 403,
      error: "You must be an Owner or Admin to manage members.",
    };
  }

  const { data: target, error: targetError } = await service
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetError) {
    return { ok: false, status: 500, error: "Failed to check membership." };
  }

  if (!target) {
    return {
      ok: false,
      status: 404,
      error: "That user is not a member of this workspace.",
    };
  }

  const { error: updateError } = await service
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId);

  if (updateError) {
    return {
      ok: false,
      status: 500,
      error: updateError.message ?? "Failed to update the member's role.",
    };
  }

  return { ok: true, userId: targetUserId, role: role as "admin" | "member" };
}