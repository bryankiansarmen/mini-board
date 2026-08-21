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
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Workspaces
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Signed in as {user.email}
          </p>
        </div>
        <form action={logout}>
          <LogoutButton />
        </form>
      </header>

      <section className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--color-border)] p-5">
            <h2 className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">
              Create a workspace
            </h2>
            <CreateWorkspaceForm />
          </div>

          <div className="rounded-lg border border-[var(--color-border)] p-5">
            <h2 className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">
              Join a workspace
            </h2>
            <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
              Enter an invite code shared by a workspace Owner or Admin.
            </p>
            <JoinWorkspaceForm />
          </div>
        </div>

        <h2 className="mb-3 mt-8 text-base font-semibold text-[var(--color-text-primary)]">
          Your workspaces
        </h2>

        {workspaces.length > 0 ? (
          <ul className="space-y-2">
            {workspaces.map((workspace: WorkspaceRow) => (
              <li key={workspace.id}>
                <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                  <Link
                    href={`/workspaces/${workspace.id}/boards`}
                    className="flex-1 text-sm text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-accent)]"
                  >
                    <span className="font-medium">{workspace.name}</span>
                    <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                      {workspace.owner_id === user.id ? "Owner" : "Member"}
                    </span>
                  </Link>
                  <Link
                    href={`/workspaces/${workspace.id}/members`}
                    className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-1"
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
          <p className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
            No workspaces yet. Create your first one above.
          </p>
        )}
      </section>
    </main>
  );
}