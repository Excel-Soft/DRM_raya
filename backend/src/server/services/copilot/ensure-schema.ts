// Boot-time idempotent DDL for Copilot's own tables — same pattern the rest of
// this repo uses for newer features (db:push is unreliable here; see
// docs/copilot/PROGRESS.md). Reads the additive migration file and applies it
// inside a transaction so a partial failure never leaves a half-created schema.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../../db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let ensured = false;

function resolveCopilotMigrationPath(): string {
  // Production runs the esbuild bundle from backend/dist/index.js, so
  // import.meta.url no longer points at src/server/services/copilot/.
  // Prefer cwd (PM2 cwd = backend/) then fall back to source-relative layout.
  const candidates = [
    path.resolve(process.cwd(), "migrations/20261022_copilot_core.sql"),
    path.resolve(__dirname, "../migrations/20261022_copilot_core.sql"),
    path.resolve(__dirname, "../../../../migrations/20261022_copilot_core.sql"),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `[copilot] migration file not found. Tried:\n${candidates.map((p) => `  - ${p}`).join("\n")}`,
    );
  }
  return found;
}

export async function ensureCopilotSchema(): Promise<void> {
  if (ensured) return;
  const sqlPath = resolveCopilotMigrationPath();
  const sql = readFileSync(sqlPath, "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    ensured = true;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[copilot] ensureCopilotSchema failed", err);
    throw err;
  } finally {
    client.release();
  }
}
