"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBoard } from "@/lib/boards/actions";
import { BoardCard } from "@/components/board/board-card";
import { DeleteBoardModal } from "@/components/board/delete-board-modal";
import type { BoardRow } from "@/types";

export function BoardList({
  boards,
  canManage,
}: {
  boards: BoardRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<BoardRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startTransition] = useTransition();

  function confirmDelete() {
    if (!pendingDelete) return;

    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteBoard(pendingDelete.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      setPendingDelete(null);
      router.refresh();
    });
  }

  return (
    <>
      {boards.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <li key={board.id}>
              <BoardCard
                board={board}
                canManage={canManage}
                onRequestDelete={() => setPendingDelete(board)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
          No boards yet — create your first board above.
        </p>
      )}

      <DeleteBoardModal
        board={pendingDelete}
        deleting={isDeleting}
        error={deleteError}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
