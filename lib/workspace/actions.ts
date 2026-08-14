"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type WorkspaceFormState = {
  error?: string;
};

export async function createWorkspace(
  _prevState: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "Workspace name is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to create a workspace." };
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({ name, owner_id: user.id })
    .select("id")
    .single();

  if (workspaceError || !workspace) {
    return { error: workspaceError?.message ?? "Failed to create workspace." };
  }

  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: "member",
    });

  if (memberError) {
    // Keep the schema consistent: a workspace must always have its owner as a
    // member, otherwise the SELECT policy hides it from them. Best-effort
    // cleanup of the orphaned workspace.
    await supabase.from("workspaces").delete().eq("id", workspace.id);
    return { error: memberError.message };
  }

  revalidatePath("/workspaces");
  return {};
}