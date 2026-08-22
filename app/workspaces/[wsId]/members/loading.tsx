export default function WorkspaceMembersLoading() {
  return (
    <main className="flex min-h-full flex-1 flex-col" aria-label="Loading workspace members">
      {/* Top accent loading bar */}
      <div className="h-1 w-full overflow-hidden bg-[var(--color-surface-raised)]">
        <div className="h-full w-1/3 animate-[pulse_1s_infinite] bg-[var(--color-accent)]" />
      </div>

      <header className="border-b border-[var(--color-border)] px-6 py-4">
        <div className="mx-auto w-full max-w-2xl">
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-surface-raised)]" />
          <div className="mt-2 h-6 w-28 animate-pulse rounded bg-[var(--color-surface-raised)]" />
        </div>
      </header>

      <section className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="space-y-3" aria-label="Loading member list">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex h-14 items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4"
            >
              <div className="h-4 w-48 animate-pulse rounded bg-[var(--color-surface-raised)]" />
              <div className="h-6 w-20 animate-pulse rounded bg-[var(--color-surface-raised)]" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
