import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateColumnForm } from "@/components/board/create-column-form";
import { BoardView } from "@/components/board/board-view";
import type {
  ColumnRow,
  CardRow,
  ChecklistItemRow,
  CommentRow,
  MemberListItem,
  ActivityLogRow,
} from "@/types";

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

  const columns = (columnsResult.data ?? []) as ColumnRow[];

  // Fetch the workspace, the workspace's members (for the assignee picker),
  // and all cards in one parallel batch once the board is known. RLS scopes
  // every row to boards the caller is a member of.
  const [workspaceResult, membersResult, cardsResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name")
      .eq("id", board.workspace_id)
      .maybeSingle(),
    supabase.rpc("get_workspace_member_emails", { ws_id: board.workspace_id }),
    columns.length > 0
      ? supabase
          .from("cards")
          .select("*")
          .in(
            "column_id",
            columns.map((column) => column.id),
          )
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const workspace = workspaceResult.data;

  if (!workspace) {
    notFound();
  }

  const members = (membersResult.data ?? []) as MemberListItem[];
  const cards = (cardsResult.data ?? []) as CardRow[];

  // Checklist items for the board's cards, grouped by card so the detail modal
  // can look up a card's list directly. Fetched only when the board has cards
  // (an empty `.in()` filter would be invalid).
  const checklistItems = await (async () => {
    if (cards.length === 0) return [] as ChecklistItemRow[];
    const { data } = await supabase
      .from("checklist_items")
      .select("*")
      .in(
        "card_id",
        cards.map((card) => card.id),
      )
      .order("position", { ascending: true });
    return (data ?? []) as ChecklistItemRow[];
  })();

  const checklistItemsByCard = checklistItems.reduce<
    Record<string, ChecklistItemRow[]>
  >((acc, item) => {
    if (!acc[item.card_id]) {
      acc[item.card_id] = [];
    }
    acc[item.card_id].push(item);
    return acc;
  }, {});

  // Comments for the board's cards, grouped by card so the detail modal can
  // look up a card's thread directly. Oldest-first so the thread reads
  // top-to-bottom chronologically. Fetched only when the board has cards.
  const comments = await (async () => {
    if (cards.length === 0) return [] as CommentRow[];
    const { data } = await supabase
      .from("comments")
      .select("*")
      .in(
        "card_id",
        cards.map((card) => card.id),
      )
      .order("created_at", { ascending: true });
    return (data ?? []) as CommentRow[];
  })();

  const commentsByCard = comments.reduce<Record<string, CommentRow[]>>(
    (acc, comment) => {
      if (!acc[comment.card_id]) {
        acc[comment.card_id] = [];
      }
      acc[comment.card_id].push(comment);
      return acc;
    },
    {},
  );

  // Activity log for the board, newest-first. RLS scopes every row to boards
  // the caller is a member of. Fetched in parallel with comments for efficiency.
  const activitiesResult = await supabase
    .from("activity_log")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })
    .limit(50);
  const activities = (activitiesResult.data ?? []) as ActivityLogRow[];

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

          <BoardView
            boardId={board.id}
            columns={columns}
            cards={cards}
            members={members}
            checklistItemsByCard={checklistItemsByCard}
            commentsByCard={commentsByCard}
            activities={activities}
            currentUserId={user.id}
          />
        </div>
      </section>
    </main>
  );
}
