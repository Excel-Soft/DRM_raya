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
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS paid_by_user_id uuid REFERENCES drm.users(id)`,
  );
  await client.query(
    `ALTER TABLE drm.salary_run_items ADD COLUMN IF NOT EXISTS paid_at timestamp`,
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

/**
 * Patch 2 Stage 6 — Diagnosis Report source table.
 * `db:push` is broken repo-wide (pre-existing FK mismatch), so the table is created
 * at runtime here (mirrors shared/schema.ts `diagnosisReports`). Fully idempotent
 * (`CREATE TABLE / INDEX IF NOT EXISTS`) — a no-op where it already exists, so it can
 * never abort the shared boot transaction. Column types match drm.users / drm.customers
 * (all uuid) so the FK references carry no type-clash rollback risk.
 */
async function ensureDiagnosisSchema(client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  await client.query(
    `CREATE TABLE IF NOT EXISTS drm.diagnosis_reports (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       customer_id uuid REFERENCES drm.customers(id),
       company_name text,
       person_name text,
       diagnosis_type text,
       diagnosis_status text NOT NULL DEFAULT 'OPEN',
       diagnosis_date date NOT NULL,
       assigned_to uuid REFERENCES drm.users(id),
       branch text,
       department text,
       notes text,
       created_by uuid REFERENCES drm.users(id),
       created_at timestamp NOT NULL DEFAULT now(),
       updated_at timestamp NOT NULL DEFAULT now(),
       deleted_at timestamp
     )`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_diagnosis_reports_assigned ON drm.diagnosis_reports (assigned_to)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_diagnosis_reports_date ON drm.diagnosis_reports (diagnosis_date)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_diagnosis_reports_status ON drm.diagnosis_reports (diagnosis_status)`,
  );
}

/**
 * Task 31 — authoritative source table for approved per-employee bonuses.
 * `db:push` is broken repo-wide (pre-existing FK mismatch), so the table is
 * created idempotently at runtime here (mirrors `employeeBonuses` in
 * shared/schema.ts). Fixed allowances come from existing `drm.users` allowance
 * columns and outstanding loan instalments from `drm.loan_requests`, so no new
 * tables are needed for those.
 */
async function ensureBonusesSchema(client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  await client.query(
    `CREATE TABLE IF NOT EXISTS drm.employee_bonuses (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id uuid NOT NULL REFERENCES drm.users(id),
       period_month integer NOT NULL,
       period_year integer NOT NULL,
       amount numeric(12,2) NOT NULL DEFAULT 0,
       reason text,
       status text NOT NULL DEFAULT 'PENDING',
       approved_by_user_id uuid REFERENCES drm.users(id),
       approved_at timestamp,
       created_by_user_id uuid REFERENCES drm.users(id),
       created_at timestamp NOT NULL DEFAULT now(),
       updated_at timestamp NOT NULL DEFAULT now()
     )`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_employee_bonuses_user ON drm.employee_bonuses (user_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_employee_bonuses_period ON drm.employee_bonuses (period_year, period_month)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_employee_bonuses_status ON drm.employee_bonuses (status)`,
  );
}

/**
 * Patch 3 Stage 2 — additive, idempotent notification routing/context columns on
 * drm.notifications (mirrors shared/schema.ts). `db:push` is broken repo-wide
 * (pre-existing FK mismatch), so schema changes are applied at runtime here.
 * These let NotificationService persist module/entity/priority instead of
 * dropping them. All additive + nullable/defaulted — safe on a populated table.
 */
async function ensureNotificationsSchema(client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  await client.query(
    `ALTER TABLE drm.notifications ADD COLUMN IF NOT EXISTS module text`,
  );
  await client.query(
    `ALTER TABLE drm.notifications ADD COLUMN IF NOT EXISTS entity_type text`,
  );
  await client.query(
    `ALTER TABLE drm.notifications ADD COLUMN IF NOT EXISTS entity_id text`,
  );
  await client.query(
    `ALTER TABLE drm.notifications ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal'`,
  );
}

/**
 * Patch 4 Stage 2 — Office Accounts master data: Chart of Accounts (account
 * heads), General Ledger, and Journal Voucher. `db:push` is broken repo-wide
 * (pre-existing FK mismatch), so schema changes are applied at runtime here
 * (mirrors shared/schema.ts). ALL statements are additive + idempotent
 * (`ADD COLUMN / CREATE TABLE / CREATE INDEX IF NOT EXISTS`) and each runs as a
 * SEPARATE client.query so a no-op can never abort a sibling statement. New
 * linkage columns are deliberately plain `varchar` WITHOUT foreign keys: the
 * referenced ids (account_heads.id is varchar, users.id is uuid) have mixed
 * types, so a hard FK would risk a type-clash; existence is validated in the
 * application layer instead.
 */
async function ensureOfficeAccountsStage2Schema(client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  // --- account_heads: chart-of-accounts master fields ---
  await client.query(
    `ALTER TABLE drm.account_heads ADD COLUMN IF NOT EXISTS parent_account_id varchar`,
  );
  await client.query(
    `ALTER TABLE drm.account_heads ADD COLUMN IF NOT EXISTS opening_balance numeric(12,2) NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE drm.account_heads ADD COLUMN IF NOT EXISTS normal_balance text`,
  );
  await client.query(
    `ALTER TABLE drm.account_heads ADD COLUMN IF NOT EXISTS branch text`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_account_heads_parent ON drm.account_heads (parent_account_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_account_heads_active ON drm.account_heads (is_active)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_account_heads_category ON drm.account_heads (category)`,
  );

  // --- ledger_entries: account-head linkage + posting lifecycle + voucher refs ---
  await client.query(
    `ALTER TABLE drm.ledger_entries ADD COLUMN IF NOT EXISTS account_head_id varchar`,
  );
  await client.query(
    `ALTER TABLE drm.ledger_entries ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Posted'`,
  );
  await client.query(
    `ALTER TABLE drm.ledger_entries ADD COLUMN IF NOT EXISTS voucher_id varchar`,
  );
  await client.query(
    `ALTER TABLE drm.ledger_entries ADD COLUMN IF NOT EXISTS voucher_line_id varchar`,
  );
  await client.query(
    `ALTER TABLE drm.ledger_entries ADD COLUMN IF NOT EXISTS reversal_of_id varchar`,
  );
  await client.query(
    `ALTER TABLE drm.ledger_entries ADD COLUMN IF NOT EXISTS branch text`,
  );
  await client.query(
    `ALTER TABLE drm.ledger_entries ADD COLUMN IF NOT EXISTS remarks text`,
  );
  await client.query(
    `ALTER TABLE drm.ledger_entries ADD COLUMN IF NOT EXISTS posted_at timestamp`,
  );
  await client.query(
    `ALTER TABLE drm.ledger_entries ADD COLUMN IF NOT EXISTS posted_by_user_id varchar`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_ledger_account_head ON drm.ledger_entries (account_head_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_ledger_voucher ON drm.ledger_entries (voucher_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_ledger_status ON drm.ledger_entries (status)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_ledger_reversal_of ON drm.ledger_entries (reversal_of_id)`,
  );

  // --- journal_vouchers (header) ---
  await client.query(
    `CREATE TABLE IF NOT EXISTS drm.journal_vouchers (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
       voucher_no text NOT NULL UNIQUE,
       voucher_date timestamp NOT NULL DEFAULT now(),
       status text NOT NULL DEFAULT 'DRAFT',
       remarks text,
       branch text,
       total_debit numeric(12,2) NOT NULL DEFAULT 0,
       total_credit numeric(12,2) NOT NULL DEFAULT 0,
       created_by_user_id varchar,
       posted_at timestamp,
       posted_by_user_id varchar,
       cancelled_at timestamp,
       cancelled_by_user_id varchar,
       cancel_reason text,
       created_at timestamp NOT NULL DEFAULT now(),
       updated_at timestamp NOT NULL DEFAULT now()
     )`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_journal_vouchers_status ON drm.journal_vouchers (status)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_journal_vouchers_date ON drm.journal_vouchers (voucher_date)`,
  );

  // --- journal_voucher_lines (detail) ---
  await client.query(
    `CREATE TABLE IF NOT EXISTS drm.journal_voucher_lines (
       id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
       voucher_id varchar NOT NULL,
       account_head_id varchar NOT NULL,
       debit numeric(12,2) NOT NULL DEFAULT 0,
       credit numeric(12,2) NOT NULL DEFAULT 0,
       narration text,
       line_no integer NOT NULL DEFAULT 0,
       created_at timestamp NOT NULL DEFAULT now()
     )`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_jv_lines_voucher ON drm.journal_voucher_lines (voucher_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_jv_lines_account_head ON drm.journal_voucher_lines (account_head_id)`,
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
        await ensureBonusesSchema(client);
        await ensureNotificationsSchema(client);
        await ensureOfficeAccountsStage2Schema(client);
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
