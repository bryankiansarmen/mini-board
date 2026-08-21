"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { PresenceState } from "@/types";

// Board-scoped presence tracking via Broadcast channel. Each client tracks its
// own presence (userId + email + join timestamp) and receives sync events when
// other clients join or leave. The list is sorted by join time so the earliest
// avatar appears leftmost in the stack.
export function useBoardPresence({
  boardId,
  currentUserId,
  currentUserEmail,
}: {
  boardId: string;
  currentUserId: string;
  currentUserEmail: string;
}): PresenceState[] {
  const [presenceList, setPresenceList] = useState<PresenceState[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    void (async () => {
      // Ensure the Realtime socket is authenticated with the current user's
      // JWT BEFORE subscribing, same auth-first pattern as useBoardRealtime.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await supabase.realtime.setAuth(token);
      }

      if (cancelled) return;

      channel = supabase.channel(`presence-board-${boardId}`, {
        config: { presence: { key: currentUserId } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState();
          const list: PresenceState[] = [];

          for (const userId in state) {
            const presences = state[userId] as Record<string, unknown>[] | undefined;
            if (presences && presences[0]) {
              const first = presences[0] as Record<string, unknown>;
              list.push({
                userId: first.userId as string,
                userEmail: first.userEmail as string,
                joinedAt: first.joinedAt as number,
              });
            }
          }

          // Sort by join time (earliest first) so the avatar stack is stable.
          list.sort((a, b) => a.joinedAt - b.joinedAt);
          setPresenceList(list);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({
              userId: currentUserId,
              userEmail: currentUserEmail,
              joinedAt: Date.now(),
            });
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [boardId, currentUserId, currentUserEmail]);

  return presenceList;
}
