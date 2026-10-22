import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mirrors tsconfig.json's "@shared/*" path alias, which tsx (the real dev/
// prod runtime) resolves natively but vitest does not without its own
// config. Without this, every test file that imports src/server/db.ts (most
// of this suite, including the pre-existing penalty-routes.test.ts) fails to
// even load with "Cannot find package '@shared/schema'" — this was a
// pre-existing gap, not introduced by Copilot's tests, but it blocked every
// DB-backed test in the repo from running at all, so it's fixed here.
export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  test: {
    // registerRoutes(app) runs several real async DB round-trips
    // (ensureSchema calls, etc.) during route-wiring tests' beforeAll — the
    // 10s vitest default was too tight even before Copilot added one more.
    hookTimeout: 30000,
  },
});
