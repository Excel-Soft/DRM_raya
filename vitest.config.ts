import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "shared/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    // DB-backed tests share a single Postgres pool; run serially to keep
    // connection usage low and avoid cross-test interference.
    fileParallelism: false,
  },
});
