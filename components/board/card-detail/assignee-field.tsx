"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCardDetails } from "@/lib/cards/actions";
import type { CardRow, MemberListItem } from "@/types";
import { AssigneeAvatar } from "@/components/board/card-meta";
import { SaveIndicator } from "@/components/board/card-detail/save-indicator";

export function AssigneeField({
  card,
  members,
}: {
  card: CardRow;
  members: MemberListItem[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(card.assignee_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const assignee = members.find(
    (member) => member.user_id === card.assignee_id,
  );

  function save(next: string) {
    if (next === (card.assignee_id ?? "")) {
      setEditing(false);
      setError(null);
      return;
    }
    startTransition(async () => {
      const result = await updateCardDetails(card.id, {
        assignee_id: next || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        Assignee
      </p>
      {editing ? (
        <select
          autoFocus
          value={value}
          aria-label="Assignee"
          onChange={(event) => {
            setValue(event.target.value);
            save(event.target.value);
          }}
          onBlur={() => {
            if (!pending) setEditing(false);
          }}
          className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.email ?? "Unknown user"}
            </option>
          ))}
        </select>
      ) : assignee ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-sm text-zinc-700 transition-colors hover:border-zinc-200 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <AssigneeAvatar email={assignee.email ?? "?"} />
          <span className="truncate">{assignee.email ?? "Unknown user"}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-dashed border-zinc-300 px-2.5 py-1 text-sm text-zinc-400 transition-colors hover:border-indigo-400 hover:text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:hover:border-indigo-500 dark:hover:text-zinc-400"
        >
          Assign
        </button>
      )}
      <div className="mt-1">
        <SaveIndicator pending={pending} error={error} />
      </div>
    </div>
  );
}