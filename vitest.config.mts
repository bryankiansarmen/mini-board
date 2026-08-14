import path from "node:path";
import { defineConfig } from "vitest/config";

// Next.js loads `.env.local` automatically, but Vitest does not. Load it into
// process.env so tests can reach the local Supabase instance. Existing env
// vars win (loadEnvFile never overrides a var that is already set).
try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {
  // .env.local missing — tests that need credentials will fail loudly on their own.
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "."),
    },
  },
  test: {
    environment: "node",
  },
});