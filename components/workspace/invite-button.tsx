"use client";

import { useState } from "react";

type Invite = {
  code: string;
  expiresAt: string;
};

export function InviteButton({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "Failed to generate an invite code.");
        return;
      }
      setInvite({ code: body.code, expiresAt: body.expiresAt });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. non-secure context); the code remains
      // visible on screen for manual copying.
    }
  }

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (invite) {
    return (
      <span className="flex items-center gap-2 text-sm">
        <code
          data-testid="invite-code"
          className="rounded bg-[var(--color-surface-raised)] px-2 py-1 font-mono text-xs tracking-widest text-[var(--color-text-primary)]"
        >
          {invite.code}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <span className="text-xs text-[var(--color-text-secondary)]">
          expires {new Date(invite.expiresAt).toLocaleDateString()}
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Invite ${workspaceName}`}
      onClick={generate}
      disabled={loading}
      className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Generating…" : "Invite"}
    </button>
  );
}