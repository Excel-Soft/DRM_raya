import { pool, isDbAvailable, isNetworkOrDnsError, markDbUnavailable } from "../db";
import { ensureServicesSchema } from "../repositories/services.repository";
import { ensureBvReportsSchema } from "../repositories/bv-reports.repository";
import {
  ensureLoanReportsSchema,
  ensureVasReportsSchema,
  ensureGmReportsSchema,
} from "../repositories/generic-report.repository";

let ensurePromise: Promise<void> | null = null;

/**
 * Patch 2 Stage 2 — additive, idempotent lifecycle/void columns on drm.penalties.
 * `db:push` is broken repo-wide (pre-existing FK mismatch), so schema changes are
 * applied at runtime here (mirrors migrations/20260603_add_penalties_table.sql).
 */
async function ensurePenaltiesSchema(client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  await client.query(
    `ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE'`,
  );
  await client.query(
    `ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES drm.users(id)`,
  );
  await client.query(
    `ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS voided_at timestamp`,
  );
  await client.query(
    `ALTER TABLE drm.penalties ADD COLUMN IF NOT EXISTS void_reason text`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_penalties_lifecycle_status ON drm.penalties (status)`,
  );
}

export async function ensureDbOnce(): Promise<void> {
  if (!isDbAvailable()) {
    console.warn("[db] skipping ensureDbOnce because database is unavailable");
    return;
  }

  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    const attempts = [0, 500, 1000];
    let lastErr: unknown;
    for (let i = 0; i < attempts.length; i++) {
      if (attempts[i] > 0) {
        await new Promise((resolve) => setTimeout(resolve, attempts[i]));
      }
      let client;
      const lockKey = "ensure_db_schema";
      try {
        client = await pool.connect();
        // await client.query("select pg_advisory_lock(hashtext($1))", [lockKey]);
        // await ensureServicesSchema();
        // await ensureBvReportsSchema();
        // await ensureLoanReportsSchema();
        // await ensureVasReportsSchema();
        // await ensureGmReportsSchema();
        await ensurePenaltiesSchema(client);
        return;
      } catch (err) {
        lastErr = err;
        console.error(`[db] ensureDbOnce attempt ${i + 1} failed`, err);
        if (isNetworkOrDnsError(err)) {
          markDbUnavailable((err as any)?.message || "db unreachable", err);
          break;
        }
      } finally {
        if (client) {
          try {
            await client.query("select pg_advisory_unlock(hashtext($1))", [lockKey]);
          } catch (unlockErr) {
            console.error("[db] ensureDbOnce unlock failed:", unlockErr);
          } finally {
            client.release();
          }
        }
      }
    }
    throw lastErr ?? new Error("ensureDbOnce failed");
  })();
  return ensurePromise;
}
