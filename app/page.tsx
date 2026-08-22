import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "MiniBoard - Real-time Collaborative Kanban Board",
  description:
    "Lightweight, fast, real-time team task management with live multi-client sync and drag-and-drop boards.",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--color-bg)]">
      {/* Header / Navbar */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold text-[var(--color-text-primary)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-accent)] text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="7" height="18" x="3" y="3" rx="1" />
                <rect width="7" height="11" x="14" y="3" rx="1" />
              </svg>
            </span>
            <span>MiniBoard</span>
          </Link>

          <nav className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <Link
                href="/workspaces"
                className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              >
                Workspaces
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-raised)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-accent)]">
            <span className="h-2 w-2 rounded-full bg-[var(--color-success)] animate-pulse" />
            Sub-second Live Real-time Sync
          </div>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-[var(--color-text-primary)] sm:text-5xl sm:leading-tight">
            Real-time task boards built for fast teams
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
            Organize work, track progress, and collaborate live. Drag-and-drop
            card movement syncs instantaneously across every client browser session.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {user ? (
              <Link
                href="/workspaces"
                className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-accent)] px-6 text-base font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
              >
                Open Workspaces
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--color-accent)] px-6 text-base font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  Get Started Free
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-6 text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-raised)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Board Visual Preview Card */}
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
            {/* Mock Board Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 bg-[var(--color-surface-raised)]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                  Product Launch Board
                </span>
                <span className="rounded bg-[var(--color-accent-ghost)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                  Live
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white ring-2 ring-[var(--color-surface)]">
                    AL
                  </div>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white ring-2 ring-[var(--color-surface)]">
                    KS
                  </div>
                </div>
              </div>
            </div>

            {/* Mock Columns Grid */}
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
              {/* To Do */}
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
                    To Do
                  </span>
                  <span className="rounded-full bg-[var(--color-surface-raised)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                    2
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xs">
                    <span className="inline-block rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      Design
                    </span>
                    <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                      Update landing page copy & layout
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                      <span className="flex items-center gap-1">
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
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        2/2
                      </span>
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-400">
                        Tomorrow
                      </span>
                    </div>
                  </div>

                  <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xs">
                    <span className="inline-block rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                      Feature
                    </span>
                    <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                      Add keyboard navigation shortcuts
                    </p>
                  </div>
                </div>
              </div>

              {/* In Progress */}
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
                    In Progress
                  </span>
                  <span className="rounded-full bg-[var(--color-surface-raised)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                    1
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="rounded-md border-2 border-[var(--color-accent)] bg-[var(--color-surface)] p-3 shadow-xs">
                    <span className="inline-block rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                      Sync
                    </span>
                    <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                      Real-time presence indicator avatars
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                      <span className="flex items-center gap-1">
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
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        3 comments
                      </span>
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                        KS
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Done */}
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-success)] uppercase tracking-wider">
                    Done
                  </span>
                  <span className="rounded-full bg-[var(--color-surface-raised)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                    2
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xs opacity-80">
                    <span className="inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-success)]">
                      Auth
                    </span>
                    <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                      Row Level Security authorization rules
                    </p>
                  </div>
                  <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xs opacity-80">
                    <span className="inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-success)]">
                      Database
                    </span>
                    <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                      Postgres schema migrations & RLS policies
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)] py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-center text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Everything you need for seamless board management
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-sm text-[var(--color-text-secondary)]">
              Built with modern performance standards and strict security bounds.
            </p>

            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-accent-ghost)] text-[var(--color-accent)]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <h3 className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">
                  Sub-Second Sync
                </h3>
                <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  Postgres changes broadcast instantly to connected clients so everyone stays on the exact same page.
                </p>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-accent-ghost)] text-[var(--color-accent)]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="5 9 2 12 5 15" />
                    <polyline points="9 5 12 2 15 5" />
                    <polyline points="15 19 12 22 9 19" />
                    <polyline points="19 9 22 12 19 15" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <line x1="12" y1="2" x2="12" y2="22" />
                  </svg>
                </div>
                <h3 className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">
                  Optimistic DnD
                </h3>
                <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  Drag and drop cards or columns with zero delay. Automatic position re-normalization handles edge cases.
                </p>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-accent-ghost)] text-[var(--color-accent)]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h3 className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">
                  RLS Authorization
                </h3>
                <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  Workspace membership authorization is enforced directly at the database layer via PostgreSQL RLS policies.
                </p>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-accent-ghost)] text-[var(--color-accent)]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <h3 className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">
                  Card Detail Depth
                </h3>
                <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  Assignees, labels, due dates, interactive checklist items, comment threads, and per-board activity logs.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-8 text-center text-xs text-[var(--color-text-secondary)]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--color-text-primary)]">
              MiniBoard
            </span>
            <span>- Real-time collaborative task management</span>
          </div>
          <div>
            Built with Next.js 16, Supabase, Tailwind CSS & Zustand
          </div>
        </div>
      </footer>
    </div>
  );
}
