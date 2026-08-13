import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/logout-button";
import { logout } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Workspaces | MiniBoard",
};

export default async function WorkspacesPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Workspaces
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Signed in as {user.email}
          </p>
        </div>
        <form action={logout}>
          <LogoutButton />
        </form>
      </header>

      <section className="flex flex-1 items-center justify-center px-6">
        <p className="max-w-md text-center text-sm text-zinc-500 dark:text-zinc-400">
          Workspace creation is the next milestone. You&apos;re logged in and
          the session survives reloads — that&apos;s what this page verifies.
        </p>
      </section>
    </main>
  );
}