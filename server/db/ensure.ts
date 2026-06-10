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

/**
 * Patch 2 Stage 3 — additive, idempotent salary-lock/override columns on
 * drm.attendance_edit_requests (mirrors shared/schema.ts). `db:push` is broken
 * repo-wide (pre-existing FK mismatch), so schema changes are applied at runtime
 * here. The table itself already exists; this only adds the two new columns.
 */
async function ensureAttendanceEditSchema(client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  await client.query(
    `ALTER TABLE drm.attendance_edit_requests ADD COLUMN IF NOT EXISTS salary_locked boolean NOT NULL DEFAULT false`,
  );
  await client.query(
    `ALTER TABLE drm.attendance_edit_requests ADD COLUMN IF NOT EXISTS override_reason text`,
  );
}

/**
 * Patch 2 Stage 4 — additive, idempotent salary payroll columns/indexes.
 * `db:push` is broken repo-wide (pre-existing FK mismatch), so schema changes are
 * applied at runtime here (mirrors shared/schema.ts). EXTENDS the existing tables
 * with spec columns — no renames of the live period_month/period_year/run_id/user_id.
 */
async function ensureSalarySchema(client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  // --- salary_runs: lifecycle actors + remarks + soft-delete ---
  await client.query(
    `ALTER TABLE drm.salary_runs ADD COLUMN IF NOT EXISTS generated_by uuid REFERENCES drm.users(id)`,
  );
  await client.query(
    `ALTER TABLE drm.salary_runs ADD COLUMN IF NOT EXISTS generated_at timestamp`,
  );
  await client.query(
    `ALTER TABLE drm.salary_runs ADD COLUMN IF NOT EXISTS finalized_by uuid REFERENCES drm.users(id)`,
  );
  await client.query(
    `ALTER TABLE drm.salary_runs ADD COLUMN IF NOT EXISTS finalized_at timestamp`,
  );
  await client.query(
    `ALTER TABLE drm.salary_runs ADD COLUMN IF NOT EXISTS remarks text`,
  );
  await client.query(
    `ALTER TABLE drm.salary_runs ADD COLUMN IF NOT EXISTS deleted_at timestamp`,
  );

  // --- salary_run_items: full payroll component/deduction breakdown ---
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS basic_salary numeric(12,2) NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS leave_days integer NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS unpaid_leave_days integer NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS unpaid_leave_deduction numeric(12,2) NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS late_minutes integer NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS late_deduction numeric(12,2) NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS overtime_minutes integer NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS penalty_amount numeric(12,2) NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS loan_deduction numeric(12,2) NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS bonus_amount numeric(12,2) NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS allowance_amount numeric(12,2) NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS total_deductions numeric(12,2) NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS payable_salary numeric(12,2) NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'UNPAID'`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS remarks text`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS calculation_snapshot jsonb`,
  );

  // --- indexes (reporting + the dup-employee-per-run guard) ---
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_salary_run_items_run_user ON drm.salary_run_items (run_id, user_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_salary_run_items_payment_status ON drm.salary_run_items (payment_status)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_salary_runs_generated_by ON drm.salary_runs (generated_by)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_salary_runs_deleted_at ON drm.salary_runs (deleted_at)`,
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
        await ensureAttendanceEditSchema(client);
        await ensureSalarySchema(client);
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
