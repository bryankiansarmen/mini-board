import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateColumnForm } from "@/components/board/create-column-form";
import { BoardView } from "@/components/board/board-view";
import type { ColumnRow, CardRow } from "@/types";

export const metadata: Metadata = {
  title: "Board | MiniBoard",
};

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const [boardResult, columnsResult] = await Promise.all([
    supabase
      .from("boards")
      .select("id, title, workspace_id")
      .eq("id", boardId)
      .maybeSingle(),
    supabase
      .from("columns")
      .select("*")
      .eq("board_id", boardId)
      .order("position", { ascending: true }),
  ]);

  const board = boardResult.data;

  if (!board) {
    notFound();
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", board.workspace_id)
    .maybeSingle();

  if (!workspace) {
    notFound();
  }

  const columns = (columnsResult.data ?? []) as ColumnRow[];

  // Fetch cards for all columns in one query (avoids an N+1 per column).
  // RLS scopes rows to boards the caller is a member of.
  const { data: cardsData } =
    columns.length > 0
      ? await supabase
          .from("cards")
          .select("*")
          .in(
            "column_id",
            columns.map((column) => column.id),
          )
          .order("position", { ascending: true })
      : { data: [] };

  const cards = (cardsData ?? []) as CardRow[];

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex items-center justify-between">
            <Link
              href={`/workspaces/${workspace.id}/boards`}
              className="text-sm text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              ← {workspace.name} / Boards
            </Link>
            <Link
              href={`/workspaces/${workspace.id}/members`}
              className="text-sm text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              Members
            </Link>
          </div>
          <h1 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {board.title}
          </h1>
        </div>
      </header>

      <section className="flex-1 px-6 py-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-6 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Add a column
            </h2>
            <CreateColumnForm boardId={board.id} />
          </div>

          <BoardView columns={columns} cards={cards} />
        </div>
      </section>
    </main>
  );
}
