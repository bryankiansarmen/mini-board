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
          className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs tracking-widest text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {invite.code}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
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
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-indigo-400 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
    >
      {loading ? "Generating…" : "Invite"}
    </button>
  );
}