"use client";

import { formatDueDate, isOverdue } from "@/lib/cards/dates";

// Small display-only pieces shared by the card list item and the card detail
// modal. Color is never the sole signal for overdue: the chip also changes
// text and keeps a calendar icon.

export function initialsFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? email).trim();
  if (!local) return "?";
  return local[0]!.toUpperCase();
}

export function LabelBadge({ label }: { label: string }) {
  return (
    <span className="inline-block max-w-[8rem] truncate rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {label}
    </span>
  );
}

export function DueDateChip({ dueDate }: { dueDate: string }) {
  const overdue = isOverdue(dueDate);
  return (
    <span
      aria-label={`Due ${formatDueDate(dueDate)}`}
      title={overdue ? "Overdue" : undefined}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
        overdue
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
      {formatDueDate(dueDate)}
    </span>
  );
}

export function AssigneeAvatar({ email }: { email: string }) {
  return (
    <span
      title={email}
      aria-label={email}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white dark:bg-indigo-500"
    >
      {initialsFromEmail(email)}
    </span>
  );
}