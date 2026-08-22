export default function WorkspacesLoading() {
  return (
    <main className="flex min-h-full flex-1 flex-col" aria-label="Loading workspaces">
      {/* Top accent loading bar */}
      <div className="h-1 w-full overflow-hidden bg-[var(--color-surface-raised)]">
        <div className="h-full w-1/3 animate-[pulse_1s_infinite] bg-[var(--color-accent)]" />
      </div>

      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
        <div className="space-y-2">
          <div className="h-6 w-36 animate-pulse rounded bg-[var(--color-surface-raised)]" />
          <div className="h-4 w-48 animate-pulse rounded bg-[var(--color-surface-raised)]" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded bg-[var(--color-surface-raised)]" />
      </header>

      <section className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="h-44 rounded-lg border border-[var(--color-border)] p-5">
            <div className="mb-4 h-5 w-36 animate-pulse rounded bg-[var(--color-surface-raised)]" />
            <div className="h-10 w-full animate-pulse rounded bg-[var(--color-surface-raised)]" />
          </div>
          <div className="h-44 rounded-lg border border-[var(--color-border)] p-5">
            <div className="mb-2 h-5 w-32 animate-pulse rounded bg-[var(--color-surface-raised)]" />
            <div className="mb-4 h-4 w-48 animate-pulse rounded bg-[var(--color-surface-raised)]" />
            <div className="h-10 w-full animate-pulse rounded bg-[var(--color-surface-raised)]" />
          </div>
        </div>

        <div className="mb-3 mt-8 h-5 w-32 animate-pulse rounded bg-[var(--color-surface-raised)]" />

        <ul className="space-y-2" aria-label="Loading workspaces list">
          {[1, 2, 3].map((i) => (
            <li key={i}>
              <div className="flex h-14 items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4">
                <div className="h-5 w-40 animate-pulse rounded bg-[var(--color-surface-raised)]" />
                <div className="h-7 w-20 animate-pulse rounded bg-[var(--color-surface-raised)]" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
