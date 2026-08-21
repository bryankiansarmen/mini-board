"use client";

import { initialsFromEmail } from "@/components/board/card-meta";
import type { PresenceState } from "@/types";

// Stacked avatar circles showing who is currently viewing the board.
// Max 5 visible, overflow as "+N". Fade in/out via CSS transition on opacity.
// top-right of board header, no layout jump (space reserved).
export function PresenceStack({
  presenceList,
}: {
  presenceList: PresenceState[];
}) {
  const visible = presenceList.slice(0, 5);
  const overflow = Math.max(0, presenceList.length - 5);

  return (
    <div
      className="flex items-center"
      role="list"
      aria-label="Active users on this board"
    >
      {visible.map((presence, index) => (
        <div
          key={presence.userId}
          className="transition-opacity duration-200 ease-in-out"
          style={{
            marginLeft: index > 0 ? "-8px" : "0",
            zIndex: visible.length - index,
          }}
          role="listitem"
        >
          <span
            title={presence.userEmail}
            aria-label={presence.userEmail}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white ring-2 ring-white dark:bg-indigo-500 dark:ring-zinc-900"
          >
            {initialsFromEmail(presence.userEmail)}
          </span>
        </div>
      ))}

      {overflow > 0 && (
        <div
          className="ml-2 text-sm font-medium text-zinc-600 dark:text-zinc-400"
          aria-label={`${overflow} more users`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
