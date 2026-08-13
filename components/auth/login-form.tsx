"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, loginWithGoogle, type AuthFormState } from "@/lib/auth/actions";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

const initialState: AuthFormState = {};

export function LoginForm({ oauthError }: { oauthError?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [googleState, googleAction] = useActionState(loginWithGoogle, initialState);

  const error = state.error ?? googleState.error ?? oauthError;

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Log in
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Welcome back to MiniBoard.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase text-zinc-400">
          <span className="bg-zinc-50 px-2 dark:bg-zinc-950">or</span>
        </div>
      </div>

      <form action={googleAction}>
        <GoogleSignInButton />
      </form>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        No account yet?{" "}
        <Link
          href="/signup"
          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}