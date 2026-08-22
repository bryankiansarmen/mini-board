export default function RootLoading() {
  return (
    <div className="flex min-h-full flex-1 flex-col" aria-label="Loading page">
      {/* Top accent loading bar */}
      <div className="h-1 w-full overflow-hidden bg-[var(--color-surface-raised)]">
        <div className="h-full w-1/3 animate-[pulse_1s_infinite] bg-[var(--color-accent)]" />
      </div>

      <header className="border-b border-[var(--color-border)] px-6 py-4">
        <div className="mx-auto w-full max-w-4xl flex items-center justify-between">
          <div className="h-6 w-32 animate-pulse rounded bg-[var(--color-surface-raised)]" />
          <div className="h-8 w-20 animate-pulse rounded bg-[var(--color-surface-raised)]" />
        </div>
      </header>

      <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <div className="space-y-4">
          <div className="h-24 w-full animate-pulse rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)]" />
          <div className="h-24 w-full animate-pulse rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)]" />
        </div>
      </section>
    </div>
  );
}
