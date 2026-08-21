"use client";

import { useEffect, useState } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { reconcileActivities } from "@/lib/realtime/reconcile";
import {
  formatActivityMessage,
  formatRelativeTime,
} from "@/lib/activity/format";
import type { ActivityLogRow, MemberListItem } from "@/types";

// Activity feed panel: subscribes to activity_log INSERT events scoped to the
// board, renders a newest-first list with formatted messages and relative
// timestamps. The channel authenticates with the user's JWT before subscribing
// (same pattern as useBoardRealtime) so RLS delivers rows correctly.

export function ActivityFeed({
  boardId,
  activities: initialActivities,
  members,
}: {
  boardId: string;
  activities: ActivityLogRow[];
  members: MemberListItem[];
}) {
  const [activities, setActivities] = useState(initialActivities);

  // Resync from props when the server round-trip delivers fresh data.
  const [prevInitial, setPrevInitial] = useState(initialActivities);
  if (initialActivities !== prevInitial) {
    setPrevInitial(initialActivities);
    setActivities(initialActivities);
  }

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await supabase.realtime.setAuth(token);
      }

      if (cancelled) return;

      channel = supabase.channel(`activity-${boardId}`);

      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_log",
          filter: `board_id=eq.${boardId}`,
        },
        (payload: RealtimePostgresChangesPayload<ActivityLogRow>) => {
          setActivities((prev) => reconcileActivities(prev, payload));
        },
      );

      channel.subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [boardId]);

  // Build a lookup map from user_id to email for actor display.
  const memberEmails = new Map<string, string>();
  for (const m of members) {
    memberEmails.set(m.user_id, m.email ?? "Unknown");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Activity
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2" role="log" aria-label="Activity feed">
        {activities.length === 0 && (
          <p className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
            No activity yet.
          </p>
        )}
        <ul className="space-y-3">
          {activities.map((activity) => {
            const actorEmail = memberEmails.get(activity.actor_id) ?? "Unknown";
            return (
              <li
                key={activity.id}
                className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400"
              >
                <span
                  title={actorEmail}
                  aria-label={actorEmail}
                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white dark:bg-indigo-500"
                >
                  {actorEmail[0]?.toUpperCase() ?? "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="leading-relaxed">
                    {formatActivityMessage(activity, actorEmail)}
                  </p>
                  <time
                    dateTime={activity.created_at}
                    className="text-[10px] text-zinc-400 dark:text-zinc-500"
                  >
                    {formatRelativeTime(activity.created_at)}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
