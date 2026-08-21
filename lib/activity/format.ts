import type { ActivityLogRow } from "@/types";
import type { ActivityAction, ActivityMetadata } from "@/lib/activity/service";

// Formats a human-readable activity message for display in the feed. The actor
// email is resolved by the caller from the workspace members list (no DB join
// needed; same pattern as the assignee field).

export function formatActivityMessage(
  activity: ActivityLogRow,
  actorEmail: string,
): string {
  const meta = activity.metadata as Record<string, unknown>;
  const actor = actorEmail || "Someone";

  switch (activity.action as ActivityAction) {
    case "card_created": {
      const m = meta as ActivityMetadata["card_created"];
      return `${actor} created "${m.cardTitle}" in ${m.columnTitle}`;
    }
    case "card_moved": {
      const m = meta as ActivityMetadata["card_moved"];
      return `${actor} moved "${m.cardTitle}" from ${m.fromColumn} to ${m.toColumn}`;
    }
    case "card_deleted": {
      const m = meta as ActivityMetadata["card_deleted"];
      return `${actor} deleted "${m.cardTitle}" from ${m.columnTitle}`;
    }
    case "column_created": {
      const m = meta as ActivityMetadata["column_created"];
      return `${actor} created column "${m.columnTitle}"`;
    }
    case "column_deleted": {
      const m = meta as ActivityMetadata["column_deleted"];
      return `${actor} deleted column "${m.columnTitle}" (${m.cardCount} card${m.cardCount === 1 ? "" : "s"})`;
    }
    default:
      return `${actor} performed an action`;
  }
}

// Returns a relative time string (e.g., "2m ago", "1h ago") for display in the
// activity feed. Falls back to the absolute date for entries older than 7 days.
export function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
