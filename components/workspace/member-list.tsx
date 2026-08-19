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
            className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {member.email ?? "Unknown user"}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
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
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                  >
                    {busy ? "…" : "Make member"}
                  </button>
                )}
                {!owner && member.role === "member" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => changeRole(member.user_id, "admin")}
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                  >
                    {busy ? "…" : "Make admin"}
                  </button>
                )}
                {!owner && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(member.user_id)}
                    className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:border-red-500 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:border-red-500 dark:hover:text-red-300"
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
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}