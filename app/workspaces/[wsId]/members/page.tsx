import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberList } from "@/components/workspace/member-list";
import type { MemberListItem } from "@/types";

export const metadata: Metadata = {
  title: "Members | MiniBoard",
};

export const dynamic = "force-dynamic";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ wsId: string }>;
}) {
  const { wsId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const [workspaceResult, membershipResult, membersResult] = await Promise.all([
    supabase.from("workspaces").select("id, name, owner_id").eq("id", wsId).maybeSingle(),
    supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", wsId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.rpc("get_workspace_member_emails", { ws_id: wsId }),
  ]);

  const workspace = workspaceResult.data;
  const myRole = membershipResult.data?.role ?? "member";

  if (!workspace) {
    notFound();
  }

  const canManage = workspace.owner_id === user.id || myRole === "admin";
  const members = (membersResult.data ?? []) as MemberListItem[];

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="mx-auto w-full max-w-2xl">
          <Link
            href={`/workspaces/${wsId}/boards`}
            className="text-sm text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            ← {workspace.name}
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Members
          </h1>
        </div>
      </header>

      <section className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {members.length > 0 ? (
          <MemberList
            workspaceId={workspace.id}
            members={members}
            canManage={canManage}
            ownerId={workspace.owner_id}
          />
        ) : (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No members yet.
          </p>
        )}
      </section>
    </main>
  );
}