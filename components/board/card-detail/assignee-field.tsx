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
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
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
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
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
          className="inline-flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-raised)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          <AssigneeAvatar email={assignee.email ?? "?"} />
          <span className="truncate">{assignee.email ?? "Unknown user"}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-dashed border-[var(--color-border)] px-2.5 py-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
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