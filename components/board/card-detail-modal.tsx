"use client";

import { useEffect, useRef } from "react";
import type {
  CardRow,
  ChecklistItemRow,
  CommentRow,
  MemberListItem,
} from "@/types";
import { TitleField } from "@/components/board/card-detail/title-field";
import { DescriptionField } from "@/components/board/card-detail/description-field";
import { DueDateField } from "@/components/board/card-detail/due-date-field";
import { AssigneeField } from "@/components/board/card-detail/assignee-field";
import { LabelsField } from "@/components/board/card-detail/labels-field";
import { ChecklistField } from "@/components/board/card-detail/checklist-field";
import { CommentsField } from "@/components/board/card-detail/comments-field";

// Card detail modal: each field saves independently with its own inline
// indicator, so an edit never blocks the rest of the modal. Rendered only
// while a card is open (conditional mount), so field state resets on every
// open and always reflects fresh server props.
export function CardDetailModal({
  card,
  members,
  labelSuggestions,
  checklistItems,
  comments,
  currentUserId,
  onClose,
}: {
  card: CardRow;
  members: MemberListItem[];
  labelSuggestions: string[];
  checklistItems: ChecklistItemRow[];
  comments: CommentRow[];
  currentUserId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Card details"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="mt-12 w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 shadow-xl focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
      >
        <TitleField card={card} />

        <div className="mt-4 space-y-5">
          <DescriptionField card={card} />
          <div className="grid gap-5 sm:grid-cols-2">
            <DueDateField card={card} />
            <AssigneeField card={card} members={members} />
          </div>
          <LabelsField card={card} suggestions={labelSuggestions} />
          <ChecklistField cardId={card.id} items={checklistItems} />
          <CommentsField
            cardId={card.id}
            comments={comments}
            currentUserId={currentUserId}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}