export default function WorkspaceBoardsLoading() {
  return (
    <main className="flex min-h-full flex-1 flex-col" aria-label="Loading boards">
      {/* Top accent loading bar */}
      <div className="h-1 w-full overflow-hidden bg-[var(--color-surface-raised)]">
        <div className="h-full w-1/3 animate-[pulse_1s_infinite] bg-[var(--color-accent)]" />
      </div>

      <header className="border-b border-[var(--color-border)] px-6 py-4">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 animate-pulse rounded bg-[var(--color-surface-raised)]" />
            <div className="h-4 w-20 animate-pulse rounded bg-[var(--color-surface-raised)]" />
          </div>
          <div className="mt-2 h-6 w-44 animate-pulse rounded bg-[var(--color-surface-raised)]" />
        </div>
      </header>

      <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <div className="mb-8 rounded-lg border border-[var(--color-border)] p-5">
          <div className="mb-3 h-5 w-32 animate-pulse rounded bg-[var(--color-surface-raised)]" />
          <div className="h-10 w-full animate-pulse rounded bg-[var(--color-surface-raised)]" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading board cards">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--color-surface-raised)]" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
