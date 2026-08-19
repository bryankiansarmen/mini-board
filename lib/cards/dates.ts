// Due-date helpers shared by the card list chips and the card detail modal.
// Cards store due dates as a PostgreSQL `date` (no timezone), so these treat a
// date as a calendar day in the user's local timezone: comparing ISO date
// strings lexicographically is correct for YYYY-MM-DD values.

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// A card is overdue when its due date is strictly before today's local date.
export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return dueDate < todayIso();
}

// Formats a YYYY-MM-DD date as "Mar 5", appending the year when it differs
// from the current year ("Dec 31 2027"). Deterministic en-US output so the
// rendering is stable across server and client locales.
export function formatDueDate(dueDate: string): string {
  const date = new Date(`${dueDate}T00:00:00`);
  const base = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const year = date.getFullYear();
  return year === new Date().getFullYear() ? base : `${base} ${year}`;
}
