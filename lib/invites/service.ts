import type { SupabaseClient } from "@supabase/supabase-js";
import { generateInviteCode } from "./code";

const MAX_CODE_COLLISION_RETRIES = 5;

// Postgres unique-violation error code.
const PG_UNIQUE_VIOLATION = "23505";

export type CreateInviteCodeResult =
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; status: number; error: string };

export type AcceptInviteCodeResult =
  | { ok: true; workspaceId: string; workspaceName: string }
  | { ok: false; status: number; error: string };

// Generates a shareable invite code for a workspace. The caller must be an
// Owner or Admin (is_workspace_admin). Code generation is collision-checked:
// a unique-violation on insert retries with a fresh code, bounded by
// MAX_CODE_COLLISION_RETRIES before giving up.
export async function createInviteCode(
  service: SupabaseClient,
  input: { workspaceId: string; userId: string },
): Promise<CreateInviteCodeResult> {
  const { workspaceId, userId } = input;

  const { data: workspace, error: workspaceError } = await service
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError || !workspace) {
    return { ok: false, status: 404, error: "Workspace not found." };
  }

  const { data: isAdmin, error: adminError } = await service.rpc(
    "is_workspace_admin",
    { ws_id: workspaceId, uid: userId },
  );

  if (adminError) {
    return { ok: false, status: 500, error: "Failed to check permissions." };
  }

  if (!isAdmin) {
    return {
      ok: false,
      status: 403,
      error: "You must be an Owner or Admin to invite members.",
    };
  }

  for (let attempt = 0; attempt < MAX_CODE_COLLISION_RETRIES; attempt++) {
    const code = generateInviteCode();
    const { data, error } = await service
      .from("workspace_invite_codes")
      .insert({ workspace_id: workspaceId, code, created_by: userId })
      .select("code, expires_at")
      .single();

    if (!error && data) {
      return { ok: true, code: data.code, expiresAt: data.expires_at };
    }

    if (error?.code !== PG_UNIQUE_VIOLATION) {
      return {
        ok: false,
        status: 500,
        error: error?.message ?? "Failed to create invite code.",
      };
    }
  }

  return {
    ok: false,
    status: 500,
    error: "Could not generate a unique invite code.",
  };
}

// Redeems an invite code, adding the caller to the workspace as a member.
// Validate-then-insert happens inside this single call so a client that dies
// mid-flow cannot end up "accepted but not a member".
export async function acceptInviteCode(
  service: SupabaseClient,
  input: { code: string; userId: string },
): Promise<AcceptInviteCodeResult> {
  const { code, userId } = input;

  const { data: invite, error: inviteError } = await service
    .from("workspace_invite_codes")
    .select("workspace_id, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (inviteError || !invite) {
    return { ok: false, status: 404, error: "Invalid or unknown invite code." };
  }

  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return { ok: false, status: 410, error: "This invite code has expired." };
  }

  const { data: existing, error: existingError } = await service
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    return { ok: false, status: 500, error: "Failed to check membership." };
  }

  if (existing) {
    return {
      ok: false,
      status: 409,
      error: "You are already a member of this workspace.",
    };
  }

  const { error: memberError } = await service
    .from("workspace_members")
    .insert({ workspace_id: invite.workspace_id, user_id: userId, role: "member" });

  if (memberError) {
    if (memberError.code === PG_UNIQUE_VIOLATION) {
      // Raced with another concurrent accept — treat as already-a-member.
      return {
        ok: false,
        status: 409,
        error: "You are already a member of this workspace.",
      };
    }
    return {
      ok: false,
      status: 500,
      error: memberError.message ?? "Failed to join the workspace.",
    };
  }

  const { data: workspace } = await service
    .from("workspaces")
    .select("name")
    .eq("id", invite.workspace_id)
    .single();

  return {
    ok: true,
    workspaceId: invite.workspace_id,
    workspaceName: workspace?.name ?? "",
  };
}