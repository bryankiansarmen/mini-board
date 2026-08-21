"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MemberListItem } from "@/types";

export type { MemberListItem };

export function MemberList({
  workspaceId,
  members,
  canManage,
  ownerId,
}: {
  workspaceId: string;
  members: MemberListItem[];
  canManage: boolean;
  ownerId: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(userId: string) {
    if (pendingId) return;
    setPendingId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/members/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "Failed to remove the member.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  async function changeRole(userId: string, role: "admin" | "member") {
    if (pendingId) return;
    setPendingId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/members/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, role }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "Failed to update the member's role.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const owner = member.user_id === ownerId;
        const busy = pendingId === member.user_id;

        return (
          <div
            key={member.user_id}
            className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                {member.email ?? "Unknown user"}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {owner ? "Owner" : member.role === "admin" ? "Admin" : "Member"}
              </p>
            </div>

            {canManage && (
              <div className="flex shrink-0 items-center gap-2">
                {!owner && member.role === "admin" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => changeRole(member.user_id, "member")}
                    className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? "…" : "Make member"}
                  </button>
                )}
                {!owner && member.role === "member" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => changeRole(member.user_id, "admin")}
                    className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? "…" : "Make admin"}
                  </button>
                )}
                {!owner && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(member.user_id)}
                    className="rounded-md border border-[var(--color-danger-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? "…" : "Remove"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}