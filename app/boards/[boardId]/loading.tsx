export default function BoardLoading() {
  return (
    <main className="flex min-h-full flex-1 flex-col" aria-label="Loading board">
      {/* Top accent loading bar */}
      <div className="h-1 w-full overflow-hidden bg-[var(--color-surface-raised)]">
        <div className="h-full w-1/3 animate-[pulse_1s_infinite] bg-[var(--color-accent)]" />
      </div>

      <header className="border-b border-[var(--color-border)] px-6 py-4">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="h-4 w-40 animate-pulse rounded bg-[var(--color-surface-raised)]" />
            <div className="h-4 w-20 animate-pulse rounded bg-[var(--color-surface-raised)]" />
          </div>
          <div className="mt-2 h-6 w-48 animate-pulse rounded bg-[var(--color-surface-raised)]" />
        </div>
      </header>

      <section className="flex-1 px-6 py-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-6 rounded-lg border border-[var(--color-border)] p-5">
            <div className="mb-3 h-5 w-32 animate-pulse rounded bg-[var(--color-surface-raised)]" />
            <div className="h-10 w-full animate-pulse rounded bg-[var(--color-surface-raised)]" />
          </div>

          <div className="flex items-start gap-4 overflow-x-auto pb-4" aria-label="Loading columns">
            {[1, 2, 3].map((colIndex) => (
              <div
                key={colIndex}
                className="w-72 flex-shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="h-5 w-28 animate-pulse rounded bg-[var(--color-surface)]" />
                  <div className="h-5 w-6 animate-pulse rounded bg-[var(--color-surface)]" />
                </div>
                <div className="space-y-3">
                  {[1, 2].map((cardIndex) => (
                    <div
                      key={cardIndex}
                      className="h-16 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                    >
                      <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--color-surface-raised)]" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
