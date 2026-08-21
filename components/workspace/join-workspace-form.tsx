"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinWorkspaceForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || pending) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 410) {
          setError("This invite code has expired.");
        } else if (res.status === 409) {
          setError("You are already a member of this workspace.");
        } else if (res.status === 404) {
          setError("Invalid or unknown invite code.");
        } else {
          setError(body?.error ?? "Failed to join the workspace.");
        }
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label
          htmlFor="invite-code"
          className="block text-sm font-medium text-[var(--color-text-secondary)]"
        >
          Invite code
        </label>
        <input
          id="invite-code"
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          type="text"
          autoComplete="off"
          placeholder="e.g. 7F3K-9QXR"
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join workspace"}
      </button>
    </form>
  );
}