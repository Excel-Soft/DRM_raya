import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  schemaFilter: ["drm"],
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
