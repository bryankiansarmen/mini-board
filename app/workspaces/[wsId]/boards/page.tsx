import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateBoardForm } from "@/components/board/create-board-form";
import { BoardList } from "@/components/board/board-list";
import type { BoardRow } from "@/types";

export const metadata: Metadata = {
  title: "Boards | MiniBoard",
};

export const dynamic = "force-dynamic";

export default async function BoardsPage({
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

  const [workspaceResult, membershipResult, boardsResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, owner_id")
      .eq("id", wsId)
      .maybeSingle(),
    supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", wsId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("boards")
      .select("*")
      .eq("workspace_id", wsId)
      .order("position", { ascending: true }),
  ]);

  const workspace = workspaceResult.data;

  if (!workspace) {
    notFound();
  }

  const canManage =
    workspace.owner_id === user.id || membershipResult.data?.role === "admin";
  const boards = (boardsResult.data ?? []) as BoardRow[];

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex items-center justify-between">
            <Link
              href="/workspaces"
              className="text-sm text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              ← Workspaces
            </Link>
            <Link
              href={`/workspaces/${wsId}/members`}
              className="text-sm text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              Members
            </Link>
          </div>
          <h1 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {workspace.name}
          </h1>
        </div>
      </header>

      <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <div className="mb-8 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Create a board
          </h2>
          <CreateBoardForm workspaceId={workspace.id} />
        </div>

        <BoardList boards={boards} canManage={canManage} />
      </section>
    </main>
  );
}
