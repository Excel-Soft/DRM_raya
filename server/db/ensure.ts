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
 * Patch 2 Stage 4 — additive, idempotent payroll columns on the existing
 * drm.salary_runs / drm.salary_run_items tables (mirrors shared/schema.ts).
 * `db:push` is broken repo-wide (pre-existing FK mismatch), so schema changes are
 * applied at runtime here. The tables already exist (created in Stage 3); this
 * only ADDs the richer per-line payroll columns + run lifecycle columns plus a
 * unique guard so one employee cannot appear twice within the same run.
 */
async function ensureSalarySchema(client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  // salary_runs — lifecycle / actor columns.
  const runCols = [
    `generated_by_user_id uuid REFERENCES drm.users(id)`,
    `generated_at timestamp`,
    `finalized_by_user_id uuid REFERENCES drm.users(id)`,
    `finalized_at timestamp`,
    `remarks text`,
    `deleted_at timestamp`,
  ];
  for (const col of runCols) {
    await client.query(`ALTER TABLE drm.salary_runs ADD COLUMN IF NOT EXISTS ${col}`);
  }

  // salary_run_items — richer per-employee payroll breakdown. All numeric columns
  // default 0 so existing/Stage-3 rows remain valid; payment_status defaults UNPAID.
  const itemCols = [
    `basic_salary numeric(12,2) NOT NULL DEFAULT 0`,
    `leave_days numeric(6,2) NOT NULL DEFAULT 0`,
    `unpaid_leave_days numeric(6,2) NOT NULL DEFAULT 0`,
    `late_minutes integer NOT NULL DEFAULT 0`,
    `overtime_minutes integer NOT NULL DEFAULT 0`,
    `penalty_amount numeric(12,2) NOT NULL DEFAULT 0`,
    `loan_deduction numeric(12,2) NOT NULL DEFAULT 0`,
    `bonus_amount numeric(12,2) NOT NULL DEFAULT 0`,
    `allowance_amount numeric(12,2) NOT NULL DEFAULT 0`,
    `total_deductions numeric(12,2) NOT NULL DEFAULT 0`,
    `payable_salary numeric(12,2) NOT NULL DEFAULT 0`,
    `payment_status text NOT NULL DEFAULT 'UNPAID'`,
    `calculation_snapshot jsonb`,
  ];
  for (const col of itemCols) {
    await client.query(`ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS ${col}`);
  }

  // One employee can only appear once per run (within-run de-dup). Cross-run
  // "one FINALIZED per employee/month/year" is enforced transactionally in the
  // service layer (advisory lock + existence check), not by a constraint here.
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_salary_run_items_run_user ON drm.salary_run_items (run_id, user_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_salary_run_items_payment ON drm.salary_run_items (payment_status)`,
  );
}

/**
 * Patch 2 Stage 6 — Diagnosis Report source table. Additive + idempotent;
 * applied at runtime because db:push is broken repo-wide. Mirrors
 * shared/schema.ts `diagnosisReports`.
 */
async function ensureDiagnosisSchema(client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  await client.query(
    `CREATE TABLE IF NOT EXISTS drm.diagnosis_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid,
      company_name text,
      person_name text,
      diagnosis_type text,
      diagnosis_status text NOT NULL DEFAULT 'OPEN',
      diagnosis_date date NOT NULL,
      assigned_to uuid,
      branch text,
      department text,
      notes text,
      created_by uuid,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      deleted_at timestamp
    )`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_diagnosis_reports_status ON drm.diagnosis_reports (diagnosis_status)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_diagnosis_reports_date ON drm.diagnosis_reports (diagnosis_date)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_diagnosis_reports_assigned ON drm.diagnosis_reports (assigned_to)`,
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
        await ensureDiagnosisSchema(client);
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
