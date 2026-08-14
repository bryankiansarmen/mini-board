import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/logout-button";
import { logout } from "@/lib/auth/actions";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";
import { JoinWorkspaceForm } from "@/components/workspace/join-workspace-form";
import { InviteButton } from "@/components/workspace/invite-button";
import type { WorkspaceRow } from "@/types";

export const metadata: Metadata = {
  title: "Workspaces | MiniBoard",
};

export const dynamic = "force-dynamic";

export default async function WorkspacesPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const [workspacesResult, membershipsResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, owner_id, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id),
  ]);

  const workspaces = workspacesResult.data ?? [];
  const adminWorkspaceIds = new Set(
    (membershipsResult.data ?? [])
      .filter((membership) => membership.role === "admin")
      .map((membership) => membership.workspace_id),
  );

  const canManage = (workspace: WorkspaceRow) =>
    workspace.owner_id === user.id || adminWorkspaceIds.has(workspace.id);

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Workspaces
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Signed in as {user.email}
          </p>
        </div>
        <form action={logout}>
          <LogoutButton />
        </form>
      </header>

      <section className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Create a workspace
            </h2>
            <CreateWorkspaceForm />
          </div>

          <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Join a workspace
            </h2>
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              Enter an invite code shared by a workspace Owner or Admin.
            </p>
            <JoinWorkspaceForm />
          </div>
        </div>

        <h2 className="mb-3 mt-8 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Your workspaces
        </h2>

        {workspaces.length > 0 ? (
          <ul className="space-y-2">
            {workspaces.map((workspace: WorkspaceRow) => (
              <li key={workspace.id}>
                <div className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <Link
                    href={`/workspaces/${workspace.id}/boards`}
                    className="flex-1 text-sm text-zinc-900 transition-colors hover:text-indigo-600 dark:text-zinc-50 dark:hover:text-indigo-400"
                  >
                    <span className="font-medium">{workspace.name}</span>
                    <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                      {workspace.owner_id === user.id ? "Owner" : "Member"}
                    </span>
                  </Link>
                  <Link
                    href={`/workspaces/${workspace.id}/members`}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-indigo-400 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                  >
                    Members
                  </Link>
                  {canManage(workspace) && (
                    <InviteButton
                      workspaceId={workspace.id}
                      workspaceName={workspace.name}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No workspaces yet. Create your first one above.
          </p>
        )}
      </section>
    </main>
  );
}