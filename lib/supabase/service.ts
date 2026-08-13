import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client bypasses RLS entirely.
//
// ONLY import this factory from files matching `/app/api/**/route.ts`.
// The service-role key is server-only and must never be referenced from
// client code, Server Components, or any file outside a Route Handler.
// It is not prefixed with NEXT_PUBLIC_ and is never bundled for the browser.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
