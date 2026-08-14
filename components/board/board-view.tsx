"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Column } from "@/components/board/column";
import { DeleteColumnModal } from "@/components/board/delete-column-modal";
import { deleteColumn, reorderColumn } from "@/lib/columns/actions";
import { calculatePositionAt } from "@/lib/columns/position";
import type { ColumnRow } from "@/types";

export function BoardView({ columns: initialColumns }: { columns: ColumnRow[] }) {
  const router = useRouter();
  // Local state for optimistic column reordering. The server render (from
  // props) is the source of truth after any mutation, so when the props
  // change we resync during render (the React-recommended pattern — no effect).
  const [columns, setColumns] = useState(initialColumns);
  const [prevInitial, setPrevInitial] = useState(initialColumns);
  const [pendingDelete, setPendingDelete] = useState<ColumnRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  if (initialColumns !== prevInitial) {
    setPrevInitial(initialColumns);
    setColumns(initialColumns);
  }

  // distance: 5 keeps plain clicks and double-clicks working on the header
  // (rename, delete) while still starting a drag once the pointer actually
  // moves.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = columns.findIndex((c) => c.id === active.id);
    const newIndex = columns.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = columns;
    const reordered = arrayMove(columns, oldIndex, newIndex);
    const newPosition = calculatePositionAt(reordered, newIndex);

    // Optimistic update, roll back on failure.
    setColumns(reordered);
    reorderColumn(String(active.id), newPosition).then((result) => {
      if (result.error) {
        setColumns(previous);
        return;
      }
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!pendingDelete) return;

    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteColumn(pendingDelete.id);
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={columns.map((c) => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex items-start gap-4 overflow-x-auto pb-4">
            {columns.length === 0 && (
              <div className="flex h-64 w-full items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700">
                <p className="text-sm text-zinc-400 dark:text-zinc-500">
                  No columns yet — create one above.
                </p>
              </div>
            )}
            {columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                cardCount={0}
                onRequestDelete={() => setPendingDelete(column)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <DeleteColumnModal
        column={pendingDelete}
        cardCount={0}
        deleting={isDeleting}
        error={deleteError}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
