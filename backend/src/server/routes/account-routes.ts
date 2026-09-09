import { Express, Request } from "express";
import { generateDrmId } from "../utils/drm-id-utils";
import crypto from "crypto";
import { db, pool, isDbAvailable, isNetworkOrDnsError, markDbUnavailable } from "../db";
import {
  donations,
  invoices,
  ledgerEntries,
  tempGmEntries,
  refundGmEntries,
  dollarBuyers,
  dollarBuying,
  insertDonationSchema,
  insertInvoiceSchema,
  insertLedgerEntrySchema,
  insertTempGmEntrySchema,
  insertRefundGmEntrySchema,
  insertDollarBuyerSchema,
  insertDollarBuyingSchema,
} from "@shared/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { NotificationService } from "../services/notification-service";
import { createProductPostingInvoices } from "../utils/invoice-utils";
import { generateDefaultInvoicesForGm } from "../services/gm-invoice-generation.service";
import { requireManualInvoiceCreator } from "../utils/gm-sales-permissions";
import { projects, projectFinancials, projectApprovals } from "@shared/schema";
import { projectsRepository } from "../repositories/projects.repository";
import { projectFinancialsRepository } from "../repositories/project-financials.repository";
import { projectApprovalsRepository } from "../repositories/project-approvals.repository";
import { sendError, sendApiError, ApiError } from "../utils/api-error";
import { sendSuccess, sendError as sendEnvelopeError } from "../utils/api-response";
import {
  INVOICE_WRITABLE_FIELDS,
  pickWritable,
  assertNonNegativeAmount,
  assertValidCurrency,
  assertValidExchangeRate,
} from "../utils/financial-validation";
import { requireFinancialPermission, FINANCIAL_ACTIONS } from "../middleware/financial-permission";
import { withPgTransaction } from "../utils/financial-transaction";
import { AuditLogService } from "../services/audit-log.service";
import { requireActionPermission } from "../middleware/action-permission.middleware";
import { requireGmSalesActionPermission, GM_SALES_ACTION_KEYS } from "../utils/gm-sales-permissions";
import { getConfig } from "../services/gm-sales-config.service";
import { recordGmSalesAudit, GM_SALES_AUDIT_ACTIONS } from "../services/gm-sales-audit";
import {
  resolveCanonicalGmType,
  checkLoanGmEnabled,
  checkGmCreationThreshold,
  thresholdsConfigured,
  getInitialGmDbState,
  recheckGmThresholdAtApproval,
} from "../services/gm-create-policy.service";
import { mapGmTypeToDbFlags, GM_INVOICE_GENERATION_TIMING, type GmSalesConfig } from "@shared/gm-sales-constants";
import { normalizeRole, ROLES } from "../utils/role-utils";

// Helper to get user ID from request (supports both mock auth and JWT)
function getUserId(req: Request): string | undefined {
  const user = req.user as any;
  return user?.id || user?.userId;
}

/**
 * Patch 5 Stage 2 — re-validate a GM's payment amount against the configured
 * minimum threshold at an approval transition. Short-circuits (no DB read, no
 * behaviour change) when no thresholds are configured, which is the default.
 */
async function enforceApprovalThreshold(
  id: string,
  req: unknown,
): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
  let cfg: GmSalesConfig;
  try {
    cfg = (await getConfig()).config;
  } catch {
    return { ok: false, status: 503, body: { error: "Workflow configuration is unavailable", code: "CONFIG_UNAVAILABLE" } };
  }
  if (!thresholdsConfigured(cfg)) return { ok: true };
  const cur = await pool.query(
    "SELECT is_loan, is_partial_payment, package_type, customer_dollar, amount_usd FROM drm.gm_entries WHERE id = $1",
    [id],
  );
  const e = cur.rows[0];
  if (!e) return { ok: true };
  const amt = Number(e.customer_dollar ?? e.amount_usd ?? 0);
  const recheck = recheckGmThresholdAtApproval({
    config: cfg,
    isLoan: e.is_loan,
    isPartialPayment: e.is_partial_payment,
    packageType: e.package_type,
    amountUsd: amt,
  });
  if (recheck.ok) return { ok: true };
  await recordGmSalesAudit({
    action: GM_SALES_AUDIT_ACTIONS.GM_THRESHOLD_VALIDATION_FAILED,
    entityType: "gm_entry",
    entityId: String(id),
    reason: recheck.message,
    after: recheck.details,
    req: req as any,
  });
  return { ok: false, status: 400, body: { error: recheck.message, code: recheck.code, details: recheck.details } };
}

/**
 * Patch 5 Stage 3 — final-approval gate (mirror of the gm-pool-routes helper) for
 * PARTIAL (P4) and LOAN (P5) GMs. FULL GMs are a pure no-op. A PARTIAL GM is blocked
 * until its receipts cover the full customer dollar; a LOAN GM is blocked until its
 * loan terms are Admin (Super HOD) approved. Returns the LEGACY `{ error, code,
 * details }` body shape used by the surrounding approve route.
 */
async function enforceLoanPartialFinalApprovalGate(
  id: string,
): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
  const cur = await pool.query(
    "SELECT is_loan, is_partial_payment, COALESCE(customer_dollar, amount_usd, 0)::numeric AS target FROM drm.gm_entries WHERE id = $1",
    [id],
  );
  const e = cur.rows[0];
  if (!e) return { ok: true };
  const isLoan = Number(e.is_loan) === 1;
  const isPartial = Number(e.is_partial_payment) === 1;
  if (!isLoan && !isPartial) return { ok: true };

  if (isPartial) {
    const paidRes = await pool.query(
      "SELECT COALESCE(SUM(amount_usd), 0)::numeric AS paid FROM drm.gm_partial_receipts WHERE gm_id = $1",
      [id],
    );
    const target = Number(e.target || 0);
    const paid = Number(paidRes.rows[0]?.paid || 0);
    const remaining = Number((target - paid).toFixed(2));
    if (remaining > 0.009) {
      return {
        ok: false,
        status: 409,
        body: {
          error: `Cannot grant final approval: this partial-payment GM still has an outstanding balance of $${remaining.toFixed(2)}. Record receipts until it is fully paid first.`,
          code: "PARTIAL_PAYMENT_INCOMPLETE",
          details: { target, paid, remaining },
        },
      };
    }
  }

  if (isLoan) {
    const lt = await pool.query(
      "SELECT admin_approval_status FROM drm.gm_loan_terms WHERE gm_id = $1",
      [id],
    );
    const status = (lt.rows[0]?.admin_approval_status as string | undefined) ?? "NONE";
    if (status !== "APPROVED") {
      return {
        ok: false,
        status: 409,
        body: {
          error: "Cannot grant final approval: this loan GM requires Admin (Super HOD) approval of its loan terms first.",
          code: "LOAN_ADMIN_APPROVAL_REQUIRED",
          details: { adminApprovalStatus: status },
        },
      };
    }
  }

  return { ok: true };
}

export function registerAccountRoutes(app: Express) {
  // ===== GM Entries Routes =====

  // Consolidate schema maintenance into a serial sequence to save connections on startup
  (async () => {
    if (!isDbAvailable()) {
      console.warn("[accounts] skipping schema maintenance because database is unavailable");
      return;
    }
    try {
      // 1. GM Entries
      await pool.query(`
        alter table drm.gm_entries
          add column if not exists gm_type text default 'GM' not null,
          add column if not exists drm_id text,
          add column if not exists member_id text,
          add column if not exists order_id text,
          add column if not exists company_name text,
          add column if not exists sales_person_name text,
          add column if not exists added_by_name text,
          add column if not exists package_type text,
          add column if not exists entry_type text,
          add column if not exists amount_usd numeric(12,2),
          add column if not exists customer_dollar numeric(12,2),
          add column if not exists dollar_rate numeric(12,4),
          add column if not exists amount_pkr numeric(15,2),
          add column if not exists is_loan boolean default false not null,
          add column if not exists is_partial_payment boolean default false not null,
          add column if not exists approved_by_user_id uuid,
          add column if not exists approved_at timestamptz,
          add column if not exists hod_status text,
          add column if not exists accountant_status text,
          add column if not exists sales_person_id uuid
      `);


      // 2. Temp/Refund GM
      await pool.query(`
        alter table drm.temp_gm_entries
          add column if not exists company_name text,
          add column if not exists person_name text,
          add column if not exists amount numeric(12,2) default 0 not null,
          add column if not exists amount_type text default 'PKR' not null,
          add column if not exists reason text,
          add column if not exists comment text,
          add column if not exists status text default 'pending' not null,
          add column if not exists created_by_user_id uuid,
          add column if not exists created_at timestamptz default now();

        alter table drm.refund_gm_entries
          add column if not exists company_name text,
          add column if not exists person_name text,
          add column if not exists amount numeric(12,2) default 0 not null,
          add column if not exists amount_type text default 'PKR' not null,
          add column if not exists comment text,
          add column if not exists status text default 'pending' not null,
          add column if not exists created_by_user_id uuid,
          add column if not exists created_at timestamptz default now();
      `);


      // 3. Ledger Entries Enum
      const enumCheck = await pool.query(`
        SELECT 1 FROM pg_type t 
        JOIN pg_namespace n ON n.oid = t.typnamespace 
        WHERE t.typname = 'ledger_entry_type' AND n.nspname = 'drm'
      `);

      if (enumCheck.rows.length === 0) {
        await pool.query(`
          DO $$ BEGIN
            CREATE TYPE drm.ledger_entry_type AS ENUM ('Credit', 'Debit');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);
      }

      // 4. Ledger Entries Table
      await pool.query(`
        create table if not exists drm.ledger_entries (
          id varchar(255) primary key default gen_random_uuid(),
          entry_type drm.ledger_entry_type not null,
          amount numeric(12,2) not null,
          currency text not null default 'USD',
          description text not null,
          category text not null,
          date timestamptz not null default now(),
          reference_id varchar(255),
          reference_type text,
          balance_after numeric(12,2),
          entry_date timestamptz not null default now(),
          created_by_user_id uuid,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        -- Ensure columns exist if table was created with different schema
        ALTER TABLE drm.ledger_entries ADD COLUMN IF NOT EXISTS entry_type drm.ledger_entry_type;
        ALTER TABLE drm.ledger_entries ALTER COLUMN entry_type SET NOT NULL;
        
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'ledger_entries_entry_date_idx' AND n.nspname = 'drm') THEN
            CREATE INDEX IF NOT EXISTS ledger_entries_entry_date_idx ON drm.ledger_entries (entry_date);
          END IF;
        END $$;
      `);

      // 4. Dollar Buying Module
      await pool.query(`
        create table if not exists drm.dollar_buyers (
          id varchar(50) primary key default gen_random_uuid(),
          name text not null,
          reference text,
          paypal_email text,
          account_no text,
          is_active boolean default true,
          created_at timestamp default now(),
          updated_at timestamp default now()
        );

        create table if not exists drm.dollar_buying (
          id varchar(50) primary key default gen_random_uuid(),
          buyer_id varchar(50) references drm.dollar_buyers(id),
          buyer_name text,
          buyer_reference text,
          paypal_email text,
          account_no text,
          cheque_id text,
          payment_method text,
          type text,
          dollar_amount numeric(12,2) not null,
          dollar_rate numeric(12,2) not null,
          pkr_amount numeric(12,2) not null,
          date timestamp default now(),
          screenshot_url text,
          detail text,
          martini text default 'Show',
          created_by_user_id varchar(50) references users(id),
          created_at timestamp default now(),
          updated_at timestamp default now()
        );
      `);

      console.info("[accounts] schema maintenance completed successfully");
    } catch (err) {
      console.error("[accounts] schema maintenance failed:", err);
    }
  })();

  const gmInsertSchema = z.object({
    gmType: z.enum(["GM", "TempGM", "RefundGM"]).default("GM"),
    drmId: z.string().optional().nullable(),
    memberId: z.string().optional().nullable(),
    orderId: z.string().optional().nullable(),
    companyName: z.string().min(1, "Company name is required"),
    salesPersonName: z.string().optional().nullable(),
    addedByName: z.string().optional().nullable(),
    packageType: z.string().min(1, "Package is required"),
    entryType: z.string().min(1, "Type is required"),
    amountUsd: z.coerce.number().min(0, "Amount is required"),
    customerDollar: z.coerce.number().optional().nullable(),
    dollarRate: z.coerce.number().optional().nullable(),
    amountPkr: z.coerce.number().optional().nullable(),
    isLoan: z.boolean().optional().default(false),
    isPartialPayment: z.boolean().optional().default(false),
    status: z.string().optional(),
    notes: z.string().optional().nullable(),
    customerId: z.string().uuid().optional(),
  });

  // GET /api/account/gm-entries - List all GM entries with filtering
  app.get("/api/account/gm-entries", async (req, res) => {
    try {
      const { status, dateFrom, dateTo } = req.query;
      const params: any[] = [];
      const where: string[] = ["coalesce(is_deleted,false)=false"];
      if (dateFrom) {
        params.push(new Date(String(dateFrom)));
        where.push(`created_at >= $${params.length}`);
      }
      if (dateTo) {
        params.push(new Date(String(dateTo)));
        where.push(`created_at <= $${params.length}`);
      }
      // status filter is now handled on the frontend using effectiveStatus
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      
      const sqlText = `
        WITH combined AS (
          SELECT 
            id::text,
            gm_type,
            drm_id,
            member_id,
            order_id,
            company_name,
            sales_person_name,
            added_by_name,
            package_type,
            entry_type,
            amount,
            amount_usd,
            customer_dollar,
            dollar_rate,
            amount_pkr,
            status,
            approval_status,
            hod_status,
            accountant_status,
            final_status,
            is_loan,
            is_partial_payment,
            notes,
            created_at,
            updated_at,
            COALESCE(is_deleted, false) as is_deleted,
            payment_proof_url
          FROM drm.gm_entries
          
          UNION ALL
          
          SELECT 
            p.id::text,
            'ProductPosting' as gm_type,
            'PP-' || p.id::text as drm_id,
            p.project_name as member_id,
            'INV-' || p.id::text as order_id,
            p.company_name,
            u.full_name as sales_person_name,
            u.full_name as added_by_name,
            'Standard' as package_type,
            'Product Posting' as entry_type,
            p.amount::numeric as amount,
            p.amount::numeric as amount_usd,
            NULL::numeric as customer_dollar,
            NULL::numeric as dollar_rate,
            NULL::numeric as amount_pkr,
            'Pending' as status,
            'approved_by_hod' as approval_status,
            'Approved' as hod_status,
            'Pending' as accountant_status,
            'pending' as final_status,
            false as is_loan,
            false as is_partial_payment,
            p.project_name as notes,
            p.created_at,
            p.updated_at,
            false as is_deleted,
            NULL as payment_proof_url
          FROM drm.product_posting_invoices p
          LEFT JOIN drm.users u ON u.id = p.sales_exec_id
          WHERE p.status = 'PENDING_ACCOUNT'
        )
        SELECT * FROM combined
        ${whereSql}
        ORDER BY created_at DESC
      `;
      const { rows } = await pool.query(sqlText, params);
      const entries = rows.map((row: any) => {
        const approvalStatus = row.approval_status || null;
        const rawStatus = row.status || "Pending";
        const finalStatus = row.final_status || null;

        let effectiveStatus: string;
        if (rawStatus === "Approved" || approvalStatus === "approved" || approvalStatus === "approved_by_account" || finalStatus === "approved") {
          effectiveStatus = "Approved";
        } else if (rawStatus === "Withdrawn" || approvalStatus === "withdrawn" || approvalStatus === "withdrawn_by_hod" || finalStatus === "withdrawn") {
          effectiveStatus = "Withdrawn";
        } else if (rawStatus === "Rejected" || approvalStatus === "account_rejected" || approvalStatus === "rejected_by_account_manager" || approvalStatus === "rejected_by_hod" || finalStatus === "rejected") {
          effectiveStatus = "Account Rejected";
        } else if (approvalStatus === "pending_super_hod" || approvalStatus === "pending_managers" || approvalStatus === "approved_by_hod") {
          effectiveStatus = "HOD Approved";
        } else if (approvalStatus === "rejected" || approvalStatus === "rejected_by_hod") {
          effectiveStatus = "HOD Rejected";
        } else {
          effectiveStatus = rawStatus; // Pending
        }

        return {
          id: row.id,
          gmType: row.gm_type || "GM",
          drmId: row.drm_id || "",
          memberId: row.member_id,
          orderId: row.order_id,
          companyName: row.company_name || "",
          salesPersonName: row.sales_person_name,
          addedByName: row.added_by_name,
          packageType: row.package_type || "",
          entryType: row.entry_type || "",
          amountUsd: String(row.amount_usd ?? row.amount ?? 0),
          customerDollar: row.customer_dollar ? String(row.customer_dollar) : null,
          dollarRate: row.dollar_rate ? String(row.dollar_rate) : null,
          amountPkr: row.amount_pkr ? String(row.amount_pkr) : null,
          status: effectiveStatus,
          approvalStatus: approvalStatus,
          isLoan: Boolean(row.is_loan),
          isPartialPayment: Boolean(row.is_partial_payment),
          notes: row.notes,
          createdAt: row.created_at,
          paymentProofUrl: row.payment_proof_url,
        };
      });
      res.json(entries);
    } catch (error) {
      console.error("Error fetching GM entries:", error);
      res.status(500).json({ error: "Failed to fetch GM entries" });
    }
  });


  // GET /api/account/gm-entries/stats - Get GM entries statistics
  app.get("/api/account/gm-entries/stats", async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `
          select
            count(*)::int as total_count,
            coalesce(sum(coalesce(amount_usd, amount, 0)),0)::numeric as total_amount,
            count(*) filter (where status = 'Pending')::int as pending_count,
            count(*) filter (where coalesce(is_loan,false))::int as loan_count,
            count(*) filter (where coalesce(is_partial_payment,false))::int as partial_payment_count
          from drm.gm_entries
          where coalesce(is_deleted,false)=false
        `,
      );
      const row = rows[0] || {};
      res.json({
        totalCount: row.total_count ?? 0,
        totalAmountUsd: row.total_amount ?? "0",
        pendingCount: row.pending_count ?? 0,
        loanCount: row.loan_count ?? 0,
        partialPaymentCount: row.partial_payment_count ?? 0,
      });
    } catch (error) {
      console.error("Error fetching GM stats:", error);
      res.status(500).json({ error: "Failed to fetch GM stats" });
    }
  });

  // GET /api/accounts/dashboard/gm-summary
  // Patch 5 Stage 7 (P12) — Accounts dashboard GM type + invoice breakdown.
  // Aggregates Full/Partial/Loan GMs with partial received/pending, loan due-soon/
  // overdue, a by-status breakdown, and a recent-GM list enriched with linked
  // invoice statuses + payment confirmation. CTEs pre-aggregate receipts / loan
  // terms / invoices to ONE row per GM, so totals never double-count. GM type is
  // derived from is_loan / is_partial_payment (not the gm_type column). This is a
  // NEW account-dashboard aggregate, not a replacement for /gm-entries/stats.
  app.get("/api/accounts/dashboard/gm-summary", async (req, res) => {
    try {
      if (!req.user) {
        return sendEnvelopeError(res, 401, "UNAUTHENTICATED", "Authentication required");
      }

      const querySchema = z.object({
        gmType: z
          .string()
          .trim()
          .transform((s) => s.toUpperCase())
          .pipe(z.enum(["FULL", "PARTIAL", "LOAN"]))
          .optional(),
        status: z.enum(["Pending", "Approved", "Rejected", "Completed"]).optional(),
        dateFrom: z.string().trim().min(1).optional(),
        dateTo: z.string().trim().min(1).optional(),
        customer: z.string().trim().min(1).optional(),
        owner: z.string().trim().min(1).optional(),
        branch: z.string().trim().min(1).optional(),
        package: z.string().trim().min(1).optional(),
        invoiceStatus: z
          .string()
          .trim()
          .transform((s) => s.toUpperCase())
          .pipe(z.enum(["PENDING_HOD", "PENDING_ACCOUNT", "APPROVED", "REJECTED"]))
          .optional(),
        dueSoonDays: z.coerce.number().int().min(1).max(365).default(7),
        recentLimit: z.coerce.number().int().min(1).max(100).default(10),
      });

      // Drop empty-string query params so they fall back to optional/defaults.
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(req.query)) {
        if (v === undefined || v === null) continue;
        if (typeof v === "string" && v.trim() === "") continue;
        cleaned[k] = v;
      }
      const parsedQuery = querySchema.safeParse(cleaned);
      if (!parsedQuery.success) {
        return sendEnvelopeError(
          res,
          400,
          "INVALID_QUERY",
          "Invalid dashboard filter parameters",
          parsedQuery.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        );
      }
      const q = parsedQuery.data;

      // Build the shared GM filter WHERE clause. `e` = gm_entries, `u` = users
      // (joined for the branch filter). startIdx is the first positional param.
      const buildGmFilters = (startIdx: number) => {
        const conds: string[] = ["COALESCE(e.is_deleted,false) = false"];
        const params: unknown[] = [];
        let i = startIdx;
        if (q.gmType === "LOAN") {
          conds.push("COALESCE(e.is_loan,0) = 1");
        } else if (q.gmType === "PARTIAL") {
          conds.push("COALESCE(e.is_loan,0) = 0 AND COALESCE(e.is_partial_payment,0) = 1");
        } else if (q.gmType === "FULL") {
          conds.push("COALESCE(e.is_loan,0) = 0 AND COALESCE(e.is_partial_payment,0) = 0");
        }
        if (q.status) {
          conds.push(`e.status::text = $${i++}`);
          params.push(q.status);
        }
        if (q.dateFrom) {
          conds.push(`e.created_at >= $${i++}`);
          params.push(q.dateFrom);
        }
        if (q.dateTo) {
          conds.push(`e.created_at <= $${i++}`);
          params.push(q.dateTo);
        }
        if (q.customer) {
          conds.push(`e.company_name ILIKE $${i++}`);
          params.push(`%${q.customer}%`);
        }
        if (q.owner) {
          conds.push(`(e.sales_person_name ILIKE $${i} OR e.sales_person_id::text = $${i + 1})`);
          params.push(`%${q.owner}%`, String(q.owner));
          i += 2;
        }
        if (q.branch) {
          conds.push(`u.branch ILIKE $${i++}`);
          params.push(`%${q.branch}%`);
        }
        if (q.package) {
          conds.push(`e.package_type ILIKE $${i++}`);
          params.push(`%${q.package}%`);
        }
        if (q.invoiceStatus) {
          conds.push(
            `EXISTS (SELECT 1 FROM drm.product_posting_invoices pi WHERE pi.gm_id::text = e.id::text AND pi.status = $${i++})`,
          );
          params.push(q.invoiceStatus);
        }
        return { whereSql: `WHERE ${conds.join(" AND ")}`, params, nextIdx: i };
      };

      // ---- Totals ----
      const totalsFilters = buildGmFilters(1);
      const dueSoonIdx = totalsFilters.nextIdx;
      const totalsParams = [...totalsFilters.params, q.dueSoonDays];
      const totalsSql = `
        WITH receipts AS (
          SELECT gm_id::text AS gm_id, COALESCE(SUM(COALESCE(amount_usd,0)),0)::numeric AS received
          FROM drm.gm_partial_receipts GROUP BY gm_id
        ),
        loans AS (
          -- DISTINCT ON guarantees ONE loan row per GM (latest by created_at) so a
          -- GM with multiple loan-term rows can never multiply the base rows and
          -- double-count loan totals. gm_id stays varchar so the join to e.id::text
          -- (varchar = text) and DISTINCT ON / ORDER BY agree on the same column.
          SELECT DISTINCT ON (gm_id)
                 gm_id, COALESCE(loan_amount_usd,0)::numeric AS loan_amount,
                 agreed_return_date, return_status
          FROM drm.gm_loan_terms
          ORDER BY gm_id, created_at DESC NULLS LAST
        ),
        base AS (
          SELECT
            CASE WHEN COALESCE(e.is_loan,0)=1 THEN 'LOAN'
                 WHEN COALESCE(e.is_partial_payment,0)=1 THEN 'PARTIAL'
                 ELSE 'FULL' END AS gm_type_canonical,
            COALESCE(e.amount_usd,0)::numeric AS amount_usd,
            COALESCE(e.customer_dollar, e.amount_usd, 0)::numeric AS customer_total,
            COALESCE(r.received,0)::numeric AS received,
            COALESCE(l.loan_amount, e.amount_usd, 0)::numeric AS loan_amount,
            l.agreed_return_date, l.return_status
          FROM drm.gm_entries e
          LEFT JOIN drm.users u ON u.id::text = e.sales_person_id
          LEFT JOIN receipts r ON r.gm_id = e.id::text
          LEFT JOIN loans l ON l.gm_id = e.id::text
          ${totalsFilters.whereSql}
        )
        SELECT
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE gm_type_canonical='FULL')::int AS full_count,
          COUNT(*) FILTER (WHERE gm_type_canonical='PARTIAL')::int AS partial_count,
          COUNT(*) FILTER (WHERE gm_type_canonical='LOAN')::int AS loan_count,
          COALESCE(SUM(amount_usd),0)::numeric AS total_amount,
          COALESCE(SUM(amount_usd) FILTER (WHERE gm_type_canonical='FULL'),0)::numeric AS full_amount,
          COALESCE(SUM(customer_total) FILTER (WHERE gm_type_canonical='PARTIAL'),0)::numeric AS partial_total_amount,
          COALESCE(SUM(received) FILTER (WHERE gm_type_canonical='PARTIAL'),0)::numeric AS partial_received_amount,
          COALESCE(SUM(GREATEST(customer_total - received,0)) FILTER (WHERE gm_type_canonical='PARTIAL'),0)::numeric AS partial_pending_amount,
          COALESCE(SUM(loan_amount) FILTER (WHERE gm_type_canonical='LOAN'),0)::numeric AS loan_amount,
          COUNT(*) FILTER (
            WHERE gm_type_canonical='LOAN' AND return_status IS DISTINCT FROM 'RETURNED'
              AND agreed_return_date IS NOT NULL AND agreed_return_date < CURRENT_DATE
          )::int AS loan_overdue_count,
          COUNT(*) FILTER (
            WHERE gm_type_canonical='LOAN' AND return_status IS DISTINCT FROM 'RETURNED'
              AND agreed_return_date IS NOT NULL AND agreed_return_date >= CURRENT_DATE
              AND agreed_return_date <= CURRENT_DATE + $${dueSoonIdx}::int
          )::int AS loan_due_soon_count
        FROM base
      `;

      // ---- By status ----
      const statusFilters = buildGmFilters(1);
      const byStatusSql = `
        SELECT e.status AS status, COUNT(*)::int AS count,
               COALESCE(SUM(COALESCE(e.amount_usd,0)),0)::numeric AS amount
        FROM drm.gm_entries e
        LEFT JOIN drm.users u ON u.id::text = e.sales_person_id
        ${statusFilters.whereSql}
        GROUP BY e.status
      `;

      // ---- Recent GMs (enriched with linked invoice statuses) ----
      const recentFilters = buildGmFilters(1);
      const limitIdx = recentFilters.nextIdx;
      const recentParams = [...recentFilters.params, q.recentLimit];
      const recentSql = `
        WITH receipts AS (
          SELECT gm_id::text AS gm_id, COALESCE(SUM(COALESCE(amount_usd,0)),0)::numeric AS received
          FROM drm.gm_partial_receipts GROUP BY gm_id
        ),
        loans AS (
          -- One loan row per GM (latest by created_at); see totals query above.
          SELECT DISTINCT ON (gm_id)
                 gm_id, COALESCE(loan_amount_usd,0)::numeric AS loan_amount,
                 agreed_return_date, return_status, admin_approval_status
          FROM drm.gm_loan_terms
          ORDER BY gm_id, created_at DESC NULLS LAST
        ),
        invoices AS (
          SELECT gm_id::text AS gm_id,
            ARRAY_AGG(DISTINCT status) AS statuses,
            COUNT(*)::int AS invoice_count,
            BOOL_OR(COALESCE(paid_amount,0) > 0 OR paid_date IS NOT NULL) AS any_paid,
            BOOL_OR(status='APPROVED') AS any_approved,
            BOOL_OR(status IN ('PENDING_HOD','PENDING_ACCOUNT')) AS any_pending
          FROM drm.product_posting_invoices WHERE gm_id IS NOT NULL GROUP BY gm_id
        )
        SELECT
          e.id,
          CASE WHEN COALESCE(e.is_loan,0)=1 THEN 'LOAN'
               WHEN COALESCE(e.is_partial_payment,0)=1 THEN 'PARTIAL'
               ELSE 'FULL' END AS gm_type_canonical,
          e.company_name, e.sales_person_name, e.package_type, e.status, e.created_at,
          COALESCE(e.amount_usd,0)::numeric AS amount_usd,
          e.customer_dollar,
          COALESCE(r.received,0)::numeric AS received,
          l.loan_amount, l.agreed_return_date, l.return_status, l.admin_approval_status,
          COALESCE(inv.statuses, ARRAY[]::text[]) AS invoice_statuses,
          COALESCE(inv.invoice_count,0)::int AS invoice_count,
          COALESCE(inv.any_paid,false) AS any_paid,
          COALESCE(inv.any_approved,false) AS any_approved,
          COALESCE(inv.any_pending,false) AS any_pending
        FROM drm.gm_entries e
        LEFT JOIN drm.users u ON u.id::text = e.sales_person_id
        LEFT JOIN receipts r ON r.gm_id = e.id::text
        LEFT JOIN loans l ON l.gm_id = e.id::text
        LEFT JOIN invoices inv ON inv.gm_id = e.id::text
        ${recentFilters.whereSql}
        ORDER BY e.created_at DESC
        LIMIT $${limitIdx}
      `;

      const [totalsRes, byStatusRes, recentRes] = await Promise.all([
        pool.query(totalsSql, totalsParams),
        pool.query(byStatusSql, statusFilters.params),
        pool.query(recentSql, recentParams),
      ]);

      const t = totalsRes.rows[0] || {};
      const totals = {
        totalGmCount: t.total_count ?? 0,
        fullGmCount: t.full_count ?? 0,
        partialGmCount: t.partial_count ?? 0,
        loanGmCount: t.loan_count ?? 0,
        totalGmAmount: String(t.total_amount ?? "0"),
        fullGmAmount: String(t.full_amount ?? "0"),
        partialGmTotalAmount: String(t.partial_total_amount ?? "0"),
        partialGmReceivedAmount: String(t.partial_received_amount ?? "0"),
        partialGmPendingAmount: String(t.partial_pending_amount ?? "0"),
        loanGmAmount: String(t.loan_amount ?? "0"),
        loanDueSoonCount: t.loan_due_soon_count ?? 0,
        loanOverdueCount: t.loan_overdue_count ?? 0,
      };

      const byStatus = byStatusRes.rows.map((r: any) => ({
        status: r.status,
        count: r.count ?? 0,
        amount: String(r.amount ?? "0"),
      }));

      const derivePaymentStatus = (r: any): string => {
        if (r.any_paid) return "PAID";
        if (r.any_approved) return "APPROVED";
        if (r.any_pending) return "PENDING";
        if ((r.invoice_count ?? 0) > 0) return "OTHER";
        return "NONE";
      };

      const todayStart = new Date(new Date().toDateString());
      const recentGms = recentRes.rows.map((r: any) => {
        const type = r.gm_type_canonical as string;
        const customerTotal = r.customer_dollar != null ? Number(r.customer_dollar) : Number(r.amount_usd ?? 0);
        const received = Number(r.received ?? 0);
        const overdue =
          type === "LOAN" &&
          r.return_status !== "RETURNED" &&
          !!r.agreed_return_date &&
          new Date(r.agreed_return_date) < todayStart;
        return {
          id: r.id,
          gmType: type,
          companyName: r.company_name || "",
          salesPersonName: r.sales_person_name || null,
          packageType: r.package_type || "",
          status: r.status,
          createdAt: r.created_at,
          amountUsd: String(r.amount_usd ?? "0"),
          customerDollar: r.customer_dollar != null ? String(r.customer_dollar) : null,
          partialReceivedAmount: type === "PARTIAL" ? String(received) : null,
          partialPendingAmount: type === "PARTIAL" ? String(Math.max(customerTotal - received, 0)) : null,
          loan:
            type === "LOAN"
              ? {
                  loanAmountUsd: r.loan_amount != null ? String(r.loan_amount) : null,
                  agreedReturnDate: r.agreed_return_date,
                  returnStatus: r.return_status || null,
                  adminApprovalStatus: r.admin_approval_status || null,
                  overdue,
                }
              : null,
          invoiceStatuses: r.invoice_statuses || [],
          invoiceCount: r.invoice_count ?? 0,
          paymentConfirmationStatus: derivePaymentStatus(r),
        };
      });

      return sendSuccess(res, {
        totals,
        byStatus,
        recentGms,
        filters: {
          gmType: q.gmType ?? null,
          status: q.status ?? null,
          dateFrom: q.dateFrom ?? null,
          dateTo: q.dateTo ?? null,
          customer: q.customer ?? null,
          owner: q.owner ?? null,
          branch: q.branch ?? null,
          package: q.package ?? null,
          invoiceStatus: q.invoiceStatus ?? null,
        },
        dueSoonDays: q.dueSoonDays,
      });
    } catch (error) {
      console.error("Error building GM dashboard summary:", error);
      return sendEnvelopeError(res, 500, "GM_SUMMARY_FAILED", "Failed to build GM dashboard summary");
    }
  });

  // GET /api/account/gm-entries/:id/invoices
  // Patch 5 Stage 7 (P13) — GM detail linked-invoice visibility. Returns the
  // invoices linked to a GM (product-posting invoices carry a gm_id; legacy
  // drm.invoices has no GM linkage so it is intentionally excluded), each with its
  // type, status, HOD + Accounts approval audit, payment/proof, and linked project
  // status — plus the GM's partial receipt history and loan terms. Read-only.
  app.get("/api/account/gm-entries/:id/invoices", async (req, res) => {
    try {
      if (!req.user) {
        return sendEnvelopeError(res, 401, "UNAUTHENTICATED", "Authentication required");
      }
      const id = String(req.params.id);

      const gmRes = await pool.query(
        `SELECT id, gm_type, company_name, sales_person_name, package_type, status,
                COALESCE(amount_usd,0)::numeric AS amount_usd, customer_dollar, created_at,
                COALESCE(is_loan,0) AS is_loan, COALESCE(is_partial_payment,0) AS is_partial_payment
         FROM drm.gm_entries
         WHERE id::text = $1 AND COALESCE(is_deleted,false) = false`,
        [id],
      );
      if (gmRes.rows.length === 0) {
        return sendEnvelopeError(res, 404, "GM_NOT_FOUND", "GM entry not found");
      }
      const g = gmRes.rows[0];
      const canonicalType = Number(g.is_loan) === 1 ? "LOAN" : Number(g.is_partial_payment) === 1 ? "PARTIAL" : "FULL";

      const [invRes, recRes, loanRes] = await Promise.all([
        pool.query(
          `SELECT id, invoice_type, status, COALESCE(amount,0)::numeric AS amount, currency,
                  auto_generated, hod_approved_by, hod_approved_at, accounts_approved_by,
                  accounts_approved_at, rejected_by, rejected_at, rejection_reason,
                  paid_amount, paid_date, payment_method, receipt_reference,
                  project_name, company_name, created_at
           FROM drm.product_posting_invoices
           WHERE gm_id::text = $1
           ORDER BY created_at DESC`,
          [id],
        ),
        pool.query(
          `SELECT id, COALESCE(amount_usd,0)::numeric AS amount_usd, amount_pkr, dollar_rate,
                  receipt_date, method, reference, notes
           FROM drm.gm_partial_receipts
           WHERE gm_id::text = $1
           ORDER BY receipt_date ASC`,
          [id],
        ),
        pool.query(
          `SELECT loan_amount_usd, company_copay_usd, agreed_return_date, admin_approval_status,
                  admin_approved_at, admin_comment, return_status, returned_at
           FROM drm.gm_loan_terms
           WHERE gm_id::text = $1
           LIMIT 1`,
          [id],
        ),
      ]);

      const invoiceIds = invRes.rows.map((r: any) => r.id);
      let projectRows: any[] = [];
      if (invoiceIds.length > 0) {
        const projRes = await pool.query(
          `SELECT id, invoice_id, name, status, department_type
           FROM drm.projects
           WHERE invoice_id = ANY($1::uuid[])`,
          [invoiceIds],
        );
        projectRows = projRes.rows;
      }
      const projectsByInvoice = new Map<string, any[]>();
      for (const p of projectRows) {
        const key = String(p.invoice_id);
        if (!projectsByInvoice.has(key)) projectsByInvoice.set(key, []);
        projectsByInvoice.get(key)!.push({
          id: p.id,
          name: p.name,
          status: p.status,
          departmentType: p.department_type ?? null,
        });
      }

      const invoices = invRes.rows.map((r: any) => ({
        id: r.id,
        invoiceType: r.invoice_type ?? null,
        status: r.status,
        amount: String(r.amount ?? "0"),
        currency: r.currency ?? "USD",
        autoGenerated: Boolean(r.auto_generated),
        hodApprovedBy: r.hod_approved_by ?? null,
        hodApprovedAt: r.hod_approved_at ?? null,
        accountsApprovedBy: r.accounts_approved_by ?? null,
        accountsApprovedAt: r.accounts_approved_at ?? null,
        rejectedBy: r.rejected_by ?? null,
        rejectedAt: r.rejected_at ?? null,
        rejectionReason: r.rejection_reason ?? null,
        paidAmount: r.paid_amount != null ? String(r.paid_amount) : null,
        paidDate: r.paid_date ?? null,
        paymentMethod: r.payment_method ?? null,
        receiptReference: r.receipt_reference ?? null,
        projectName: r.project_name ?? null,
        companyName: r.company_name ?? null,
        createdAt: r.created_at,
        projects: projectsByInvoice.get(String(r.id)) ?? [],
      }));

      const partialReceipts = recRes.rows.map((r: any) => ({
        id: r.id,
        amountUsd: String(r.amount_usd ?? "0"),
        amountPkr: r.amount_pkr != null ? String(r.amount_pkr) : null,
        dollarRate: r.dollar_rate != null ? String(r.dollar_rate) : null,
        receiptDate: r.receipt_date,
        method: r.method ?? null,
        reference: r.reference ?? null,
        notes: r.notes ?? null,
      }));

      const todayStart = new Date(new Date().toDateString());
      let loanTerms: any = null;
      if (loanRes.rows.length > 0) {
        const l = loanRes.rows[0];
        const overdue =
          l.return_status !== "RETURNED" && !!l.agreed_return_date && new Date(l.agreed_return_date) < todayStart;
        loanTerms = {
          loanAmountUsd: l.loan_amount_usd != null ? String(l.loan_amount_usd) : null,
          companyCopayUsd: l.company_copay_usd != null ? String(l.company_copay_usd) : null,
          agreedReturnDate: l.agreed_return_date ?? null,
          adminApprovalStatus: l.admin_approval_status ?? null,
          adminApprovedAt: l.admin_approved_at ?? null,
          adminComment: l.admin_comment ?? null,
          returnStatus: l.return_status ?? null,
          returnedAt: l.returned_at ?? null,
          overdue,
        };
      }

      const customerTotal = g.customer_dollar != null ? Number(g.customer_dollar) : Number(g.amount_usd ?? 0);
      const partialReceivedTotal = partialReceipts.reduce((acc, r) => acc + Number(r.amountUsd || 0), 0);
      const partialPendingTotal = canonicalType === "PARTIAL" ? Math.max(customerTotal - partialReceivedTotal, 0) : 0;

      const anyPaid = invoices.some((i) => (i.paidAmount != null && Number(i.paidAmount) > 0) || i.paidDate != null);
      const anyApproved = invoices.some((i) => i.status === "APPROVED");
      const anyPending = invoices.some((i) => i.status === "PENDING_HOD" || i.status === "PENDING_ACCOUNT");
      const paymentConfirmationStatus = anyPaid
        ? "PAID"
        : anyApproved
          ? "APPROVED"
          : anyPending
            ? "PENDING"
            : invoices.length > 0
              ? "OTHER"
              : "NONE";

      return sendSuccess(res, {
        gm: {
          id: g.id,
          gmType: canonicalType,
          companyName: g.company_name || "",
          salesPersonName: g.sales_person_name || null,
          packageType: g.package_type || "",
          status: g.status,
          amountUsd: String(g.amount_usd ?? "0"),
          customerDollar: g.customer_dollar != null ? String(g.customer_dollar) : null,
          createdAt: g.created_at,
        },
        invoices,
        partialReceipts,
        loanTerms,
        summary: {
          invoiceCount: invoices.length,
          paymentConfirmationStatus,
          partialReceivedTotal: canonicalType === "PARTIAL" ? String(partialReceivedTotal) : null,
          partialPendingTotal: canonicalType === "PARTIAL" ? String(partialPendingTotal) : null,
        },
      });
    } catch (error) {
      console.error("Error fetching GM linked invoices:", error);
      return sendEnvelopeError(res, 500, "GM_INVOICES_FAILED", "Failed to fetch GM linked invoices");
    }
  });

  // POST /api/account/gm-entries - Create new GM entry
  app.post("/api/account/gm-entries", requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_CREATE_ACCOUNT, { auditUnauthorizedAttempt: true }), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const validated = gmInsertSchema.parse(req.body);
      const amountNumeric = Number.isFinite(validated.amountUsd) ? validated.amountUsd : 0;
      // Stage 8: a GM entry must carry a positive USD amount.
      if (!Number.isFinite(amountNumeric) || amountNumeric <= 0) {
        return res.status(400).json({ error: "GM amount (USD) must be greater than 0" });
      }

      // Patch 5 Stage 2 — resolve canonical GM type (FULL/PARTIAL/LOAN) and enforce
      // the config-driven loan gate + minimum-payment threshold. Behaviour-preserving
      // with safe defaults. The DB gm_type column keeps the existing GM/TempGM/RefundGM
      // value; the derived flags below feed is_loan/is_partial_payment.
      const typeResult = resolveCanonicalGmType({
        explicit: (req.body as any)?.canonicalGmType,
        isLoan: validated.isLoan,
        isPartialPayment: validated.isPartialPayment,
      });
      if (!typeResult.ok || !typeResult.value) {
        await recordGmSalesAudit({
          action: GM_SALES_AUDIT_ACTIONS.GM_TYPE_CHANGE_DENIED,
          entityType: "gm_entry",
          entityId: "n/a",
          reason: typeResult.message,
          after: { explicit: (req.body as any)?.canonicalGmType, isLoan: validated.isLoan, isPartialPayment: validated.isPartialPayment },
          req,
        });
        return res.status(400).json({ error: typeResult.message, code: typeResult.code });
      }
      const canonicalGmType = typeResult.value;
      const gmFlags = mapGmTypeToDbFlags(canonicalGmType).value ?? { isLoan: 0, isPartialPayment: 0 };
      const isLoanFlag = gmFlags.isLoan === 1;
      const isPartialFlag = gmFlags.isPartialPayment === 1;

      let gmConfig: GmSalesConfig;
      try {
        gmConfig = (await getConfig()).config;
      } catch {
        return res.status(503).json({ error: "Workflow configuration is unavailable", code: "CONFIG_UNAVAILABLE" });
      }

      const loanCheck = checkLoanGmEnabled(gmConfig, canonicalGmType);
      if (!loanCheck.ok) {
        return res.status(400).json({ error: loanCheck.message, code: loanCheck.code });
      }

      const thresholdCheck = checkGmCreationThreshold({
        config: gmConfig,
        gmType: canonicalGmType,
        packageKey: validated.packageType,
        amountUsd: validated.amountUsd,
      });
      if (!thresholdCheck.ok) {
        await recordGmSalesAudit({
          action: GM_SALES_AUDIT_ACTIONS.GM_THRESHOLD_VALIDATION_FAILED,
          entityType: "gm_entry",
          entityId: "n/a",
          reason: thresholdCheck.message,
          after: thresholdCheck.details,
          req,
        });
        return res.status(400).json({ error: thresholdCheck.message, code: thresholdCheck.code, details: thresholdCheck.details });
      }

      const createdByRole = (req.user as any)?.activeRoleId ?? (req.user as any)?.roleId ?? null;

      let countryVal = "Other";
      let resolvedSalesPersonId: string | null = null;
      if (validated.customerId) {
        const cRes = await pool.query("select country, owner_user_id from drm.customers where id = $1", [validated.customerId]);
        if (cRes.rows[0]?.country) countryVal = cRes.rows[0].country;
        if (cRes.rows[0]?.owner_user_id) resolvedSalesPersonId = cRes.rows[0].owner_user_id;
      }

      if (!resolvedSalesPersonId && validated.salesPersonName) {
        const uRes = await pool.query(
          "select id from drm.users where lower(full_name) = lower($1) or lower(name) = lower($1) or lower(username) = lower($1) limit 1",
          [validated.salesPersonName.trim()]
        );
        if (uRes.rows[0]?.id) resolvedSalesPersonId = uRes.rows[0].id;
      }

      const drmId = generateDrmId(
        validated.companyName,
        countryVal,
        validated.memberId || validated.companyName,
        validated.orderId || validated.memberId || crypto.randomUUID()
      );

      const { rows } = await pool.query(
        `
          insert into gm_entries (
            id,
            gm_type,
            drm_id,
            member_id,
            order_id,
            company_name,
            sales_person_name,
            added_by_name,
            package_type,
            entry_type,
            amount,
            amount_usd,
            customer_dollar,
            dollar_rate,
            amount_pkr,
            status,
            is_loan,
            is_partial_payment,
            notes,
            created_by,
            customer_id,
            sales_person_id,
            created_at,
            updated_at,
            is_deleted,
            created_by_role
          )
          values (
            gen_random_uuid(),
            $1,$2,$3,$4,$5,$6,$7,$8,$9,
            $10,$11,$12,$13,$14,
            coalesce($15,'Pending'),
            $16,$17,$18,
            $19,$20,$21,
            now(), now(), false, $22
          )
          returning 
            id,
            gm_type,
            drm_id,
            member_id,
            order_id,
            company_name,
            sales_person_name,
            added_by_name,
            package_type,
            entry_type,
            amount,
            amount_usd,
            customer_dollar,
            dollar_rate,
            amount_pkr,
            status,
            is_loan,
            is_partial_payment,
            notes,
            created_at,
            updated_at
        `,
        [
          validated.gmType,
          drmId,
          validated.memberId ?? null,
          validated.orderId ?? null,
          validated.companyName,
          validated.salesPersonName ?? null,
          validated.addedByName ?? null,
          validated.packageType,
          validated.entryType,
          amountNumeric,
          validated.amountUsd,
          validated.customerDollar ?? null,
          validated.dollarRate ?? null,
          validated.amountPkr ?? null,
          validated.status ?? "Pending",
          isLoanFlag,
          isPartialFlag,
          validated.notes ?? null,
          getUserId(req),
          validated.customerId ?? null,
          resolvedSalesPersonId,
          createdByRole,
        ],
      );

      const row = rows[0];

      const isOverrideCreate = (() => {
        const r = normalizeRole(createdByRole ?? "");
        return r === ROLES.ADMIN || gmConfig.gmCreateOverrideRoles.map((x) => normalizeRole(x)).includes(r);
      })();
      await recordGmSalesAudit({
        action: GM_SALES_AUDIT_ACTIONS.GM_CREATE,
        entityType: "gm_entry",
        entityId: String(row.id),
        nextStatus: getInitialGmDbState(canonicalGmType).canonicalStage,
        after: {
          canonicalGmType,
          isLoan: isLoanFlag,
          isPartialPayment: isPartialFlag,
          status: row.status,
          packageType: row.package_type,
          amountUsd: validated.amountUsd,
          createdByRole,
          override: isOverrideCreate,
          source: "account",
        },
        reason: isOverrideCreate ? "gm_create_override" : undefined,
        req,
      });
      await recordGmSalesAudit({
        action: GM_SALES_AUDIT_ACTIONS.GM_TYPE_SET,
        entityType: "gm_entry",
        entityId: String(row.id),
        after: { canonicalGmType, source: typeResult.source },
        req,
      });

      if (validated.customerId) {
        try {
          await pool.query(
            `update drm.customers set pool_type = 'GMBV', updated_at = now() where id = $1 and coalesce(pool_type, '') <> 'GMBV'`,
            [validated.customerId],
          );
        } catch (err) {
          console.warn("Failed to mark customer as GMBV for gm entry", err);
        }
      }

      res.status(201).json({
        id: row.id,
        gmType: row.gm_type,
        drmId: row.drm_id,
        memberId: row.member_id,
        orderId: row.order_id,
        companyName: row.company_name,
        salesPersonName: row.sales_person_name,
        addedByName: row.added_by_name,
        packageType: row.package_type,
        entryType: row.entry_type,
        amountUsd: String(row.amount_usd ?? row.amount ?? 0),
        customerDollar: row.customer_dollar ? String(row.customer_dollar) : null,
        dollarRate: row.dollar_rate ? String(row.dollar_rate) : null,
        amountPkr: row.amount_pkr ? String(row.amount_pkr) : null,
        status: row.status,
        isLoan: Boolean(row.is_loan),
        isPartialPayment: Boolean(row.is_partial_payment),
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating GM entry:", error);
      res.status(500).json({ error: "Failed to create GM entry" });
    }
  });

  // POST /api/account/create-project-from-gm - Create a project from an approved GM entry
  app.post("/api/account/create-project-from-gm", async (req, res) => {
    try {
        const fs = require('fs');
        fs.appendFileSync('route_debug_log.txt', `[${new Date().toISOString()}] /create-project-from-gm called with: ${JSON.stringify(req.body)}\n`);
    } catch (e) {}
    
    console.log("[API] /api/account/create-project-from-gm called", req.body);
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });

      const { gmId, projectName, dueAmount, totalAmount, paymentMethod, receiptNumber } = req.body;

      if (!gmId) return res.status(400).json({ error: "GM Entry ID (gmId) is required" });

      // 1. Fetch the GM Entry
      // 1. Fetch the data (Try GM Entry then Invoice)
      console.log("[API] Fetching Entry ID:", gmId);
      let entry: any = null;
      let source: 'gm' | 'product_posting' = 'gm';
      
      const { rows: gmRows } = await pool.query(
        "SELECT * FROM drm.gm_entries WHERE id = $1",
        [gmId]
      );
      
      if (gmRows.length > 0) {
        entry = gmRows[0];
        source = 'gm';
      } else {
        const { rows: invRows } = await pool.query(
          "SELECT * FROM drm.product_posting_invoices WHERE id = $1",
          [gmId]
        );
        if (invRows.length > 0) {
          entry = invRows[0];
          source = 'product_posting';
        }
      }

      if (!entry) {
        console.error("[API] Entry not found for ID:", gmId);
        return res.status(404).json({ error: "Entry not found" });
      }

      const companyName = entry.company_name || entry.companyName || "Unknown Company";
      let salesPersonId = source === 'gm' ? entry.sales_person_id : entry.sales_exec_id;
      
      // Fallback if salesPersonId is not set in the entry
      if (!salesPersonId && source === 'gm') {
        if (entry.customer_id) {
          const custRes = await pool.query("SELECT owner_user_id FROM drm.customers WHERE id = $1", [entry.customer_id]);
          if (custRes.rows[0]?.owner_user_id) {
            salesPersonId = custRes.rows[0].owner_user_id;
          }
        }
        if (!salesPersonId && entry.sales_person_name) {
          const userRes = await pool.query(
            "SELECT id FROM drm.users WHERE lower(full_name) = lower($1) OR lower(name) = lower($1) OR lower(username) = lower($1) LIMIT 1",
            [entry.sales_person_name.trim()]
          );
          if (userRes.rows[0]?.id) {
            salesPersonId = userRes.rows[0].id;
          }
        }
        if (!salesPersonId && entry.created_by) {
          salesPersonId = entry.created_by;
        }
      }

      // 2. Create the Project
      console.log("[API] Creating Project for:", companyName);
      const project = await projectsRepository.create({
        name: projectName || companyName,
        description: `Project created from ${source === 'gm' ? 'GM Entry' : 'Invoice'} ${entry.drm_id || entry.id}`,
        ownerUserId: salesPersonId || getUserId(req)!,
        status: "Active",
        workSpace: companyName,
        customerId: (source === 'gm' ? entry.customer_id : null) || null,
        invoiceId: source === 'product_posting' ? entry.id : null,
      } as any);
      console.log("[API] Project created with ID:", project.id);
      
      // Auto-initialize workflow for D&D Manager visibility
      try {
        const { getOrCreateProductPostingWorkflow } = require("./services/product-posting-workflow.service");
        await getOrCreateProductPostingWorkflow(project.id);
        console.log("[API] Workflow initialized for project:", project.id);
      } catch (wfErr) {
        console.warn("[API] Failed to initialize workflow (silent catch):", wfErr);
      }

      // 3. Create Financials
      try {
        await projectFinancialsRepository.create({
          projectId: project.id,
          totalAmount: String(totalAmount || (source === 'gm' ? entry.amount_pkr : entry.amount) || 0),
          paidAmount: String((totalAmount || 0) - (dueAmount || 0)),
          currency: source === 'gm' ? "PKR" : "USD",
        } as any);
      } catch (finError) {
        console.warn("[API] Failed to create financials:", (finError as Error).message);
      }

      // 4. Create Initial Approval Stage
      try {
        await projectApprovalsRepository.create({
          id: crypto.randomUUID(),
          projectId: project.id,
          stage: "HOD",
          status: "Pending",
          requestedBy: getUserId(req),
        } as any);
      } catch (appError) {
        console.error("[API] Failed to create approval stage:", appError);
      }

      // Update source status
      if (source === 'product_posting') {
        console.log("[API] Updating invoice status to APPROVED for ID:", entry.id);
        await pool.query("UPDATE drm.product_posting_invoices SET status = 'APPROVED' WHERE id = $1", [entry.id]);
      }

      // 5. Send Notification to Sales Executive
      if (salesPersonId) {
        console.log(`[API] Attempting notification for Sales Executive ${salesPersonId}`);
        try {
          await NotificationService.notify({
            userId: salesPersonId,
            message: `New project '${project.name}' created. Please upload the required documents in the PMS module to proceed.`,
            type: "SUCCESS",
            targetUrl: "/pms/approvals"
          });
          console.log("[API] Notification sent successfully");
        } catch (notifErr) {
          console.error("[API] Notification failed (silent catch):", notifErr);
        }
      } else {
        console.warn("[API] No salesPersonId found to notify");
      }

      console.log("[API] All steps completed for project:", project.id);

      res.status(201).json({
        success: true,
        projectId: project.id,
        message: "Project created and Sales Executive notified"
      });
    } catch (error) {
      console.error("[API] Critical Error creating project from GM:", error);
      res.status(500).json({
        error: "Internal Server Error",
        details: (error as Error).message,
        stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      });
    }
  });

  // PATCH /api/account/gm-entries/:id/approve - Approve GM entry (Account Manager)
  app.patch("/api/account/gm-entries/:id/approve", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const thr = await enforceApprovalThreshold(req.params.id, req);
      if (!thr.ok) return res.status(thr.status).json(thr.body);

      // Patch 5 Stage 3 — block final approval of an unpaid PARTIAL / un-admin-approved LOAN GM.
      const gate = await enforceLoanPartialFinalApprovalGate(req.params.id);
      if (!gate.ok) return res.status(gate.status).json(gate.body);

      const { rows } = await pool.query(
        `
            update drm.gm_entries
               set status          = 'Approved',
                   approval_status = 'approved_by_account',
                   accountant_status = 'approved',
                   updated_at      = now()
             where id = $1
             returning id, drm_id, status, approval_status, notes, created_at, updated_at, sales_person_id, company_name, customer_id, sales_person_name, created_by
          `,
        [req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: "GM entry not found" });

      const entry = rows[0];
      let salesPersonId = entry.sales_person_id;
      
      // Fallback if salesPersonId is not set in the entry
      if (!salesPersonId) {
        if (entry.customer_id) {
          const custRes = await pool.query("SELECT owner_user_id FROM drm.customers WHERE id = $1", [entry.customer_id]);
          if (custRes.rows[0]?.owner_user_id) {
            salesPersonId = custRes.rows[0].owner_user_id;
          }
        }
        if (!salesPersonId && entry.sales_person_name) {
          const userRes = await pool.query(
            "SELECT id FROM drm.users WHERE lower(full_name) = lower($1) OR lower(name) = lower($1) OR lower(username) = lower($1) LIMIT 1",
            [entry.sales_person_name.trim()]
          );
          if (userRes.rows[0]?.id) {
            salesPersonId = userRes.rows[0].id;
          }
        }
        if (!salesPersonId && entry.created_by) {
          salesPersonId = entry.created_by;
        }
      }

      if (salesPersonId) {
        try {
          await NotificationService.notify({
            userId: salesPersonId,
            message: `Your GM entry for '${entry.company_name || 'Unknown'}' has been approved by the Account Manager. Please proceed to upload the required documents in the PMS module.`,
            type: "SUCCESS",
            targetUrl: "/pms/approvals"
          });
        } catch (notifErr) {
          console.error("[API] Failed to send approval notification:", notifErr);
        }
      }

      res.json({ success: true, id: rows[0].id, drmId: rows[0].drm_id, status: "Approved", approvalStatus: "approved_by_account" });
    } catch (error) {
      console.error("Error approving GM entry:", error);
      res.status(500).json({ error: "Failed to approve GM entry" });
    }
  });

  // PATCH /api/account/gm-entries/:id/reject - Reject GM entry (Account Manager)
  app.patch("/api/account/gm-entries/:id/reject", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { reason } = req.body || {};

      const { rows } = await pool.query(
        `
            update drm.gm_entries
               set status          = 'Rejected',
                   approval_status = 'account_rejected',
                   accountant_status = 'rejected',
                   notes           = CASE WHEN $2::text IS NOT NULL THEN coalesce(notes,'') || ' [Account Rejected: ' || $2 || ']' ELSE notes END,
                   updated_at      = now()
             where id = $1
             returning id, drm_id, status, approval_status, notes, created_at, updated_at
          `,
        [req.params.id, reason ?? null],
      );
      if (!rows[0]) return res.status(404).json({ error: "GM entry not found" });
      res.json({ success: true, id: rows[0].id, drmId: rows[0].drm_id, status: "Account Rejected", approvalStatus: "account_rejected" });
    } catch (error) {
      console.error("Error rejecting GM entry:", error);
      res.status(500).json({ error: "Failed to reject GM entry" });
    }
  });

  // DELETE /api/account/gm-entries/:id - Delete GM entry
  app.delete("/api/account/gm-entries/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { rowCount } = await pool.query(
        `update drm.gm_entries set is_deleted = true, updated_at = now() where id = $1`,
        [req.params.id],
      );
      if (!rowCount) return res.status(404).json({ error: "GM entry not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting GM entry:", error);
      res.status(500).json({ error: "Failed to delete GM entry" });
    }
  });

  // ===== Donations Routes =====

  // GET /api/account/donations - List all donations
  app.get("/api/account/donations", async (req, res) => {
    try {
      // Actual DB columns: id, donor_name, amount, date, notes, created_at, updated_at, is_deleted
      const { rows } = await pool.query(
        `SELECT
           id,
           donor_name AS "personName",
           ''         AS "companyName",
           'Mr.'      AS title,
           amount,
           'PKR'      AS currency,
           notes      AS comment,
           'Pending'  AS status,
           COALESCE(date, created_at) AS "createdAt"
         FROM drm.donations
         WHERE is_deleted IS NOT TRUE
         ORDER BY COALESCE(date, created_at) DESC`
      );
      console.log(`[donations GET] rows returned: ${rows.length}`, rows.length > 0 ? JSON.stringify(rows[0]) : 'empty');
      res.json(rows);
    } catch (error) {
      console.error("Error fetching donations:", error);
      res.status(500).json({ error: "Failed to fetch donations" });
    }
  });

  // Debug: show actual donations table columns
  app.get("/api/account/donations/schema", async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'drm' AND table_name = 'donations'
         ORDER BY ordinal_position`
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // GET /api/account/donations/stats
  app.get("/api/account/donations/stats", async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS "totalCount", COALESCE(SUM(amount), 0)::text AS "totalAmount" FROM drm.donations`
      );
      res.json(rows[0] || { totalCount: 0, totalAmount: "0" });
    } catch (error) {
      console.error("Error fetching donation stats:", error);
      res.status(500).json({ error: "Failed to fetch donation stats" });
    }
  });


  // POST /api/account/donations
  app.post("/api/account/donations", requireFinancialPermission(FINANCIAL_ACTIONS.donationCreate), async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      // Actual columns: donor_name, amount, date, notes
      const { personName, amount, comment } = req.body;
      if (!personName || !amount) return res.status(400).json({ error: "personName and amount are required" });

      const { rows } = await pool.query(
        `INSERT INTO drm.donations (donor_name, amount, date, notes)
         VALUES ($1, $2, now(), $3)
         RETURNING id, donor_name AS "personName", amount,
                   COALESCE(date, created_at) AS "createdAt", notes AS comment`,
        [personName, amount, comment || null]
      );
      const row = rows[0];
      res.status(201).json({
        id: row.id,
        personName: row.personName || personName,
        companyName: '',
        title: 'Mr.',
        amount: row.amount,
        currency: 'PKR',
        comment: row.comment || null,
        status: 'Pending',
        createdAt: row.createdAt,
      });
    } catch (error) {
      console.error("Error creating donation:", error);
      res.status(500).json({ error: "Failed to create donation" });
    }
  });


  // DELETE /api/account/donations/:id
  app.delete("/api/account/donations/:id", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { rows } = await pool.query(
        `DELETE FROM drm.donations WHERE id = $1 RETURNING id`,
        [req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: "Donation not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting donation:", error);
      res.status(500).json({ error: "Failed to delete donation" });
    }
  });


  // ===== Invoices Routes =====

  // GET /api/account/invoices - List all invoices
  app.get("/api/account/invoices", async (req, res) => {
    try {
      const { status, dateFrom, dateTo } = req.query;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(status);
      }
      if (dateFrom) {
        conditions.push(`issue_date >= $${paramIndex++}`);
        params.push(dateFrom);
      }
      if (dateTo) {
        conditions.push(`issue_date <= $${paramIndex++}`);
        params.push(dateTo);
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const { rows } = await pool.query(
        `SELECT id, customer_id, invoice_number, total as amount, status, issue_date as issued_at, due_date as due_at, notes, created_at, updated_at
         FROM drm.invoices ${whereSql}
         ORDER BY created_at DESC`,
        params
      );

      res.json(
        rows.map((row: any) => ({
          id: row.id,
          customerId: row.customer_id,
          invoiceNumber: row.invoice_number || '',
          total: String(row.amount || 0),
          status: row.status || 'Draft',
          issueDate: row.issued_at || row.created_at,
          dueDate: row.due_at,
          notes: row.notes,
          currency: 'PKR',
          createdAt: row.created_at,
        }))
      );
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  // GET /api/account/invoices/stats - Get invoice statistics
  app.get("/api/account/invoices/stats", async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT
          count(*)::int as total_count,
          coalesce(sum(total), 0)::numeric as total_amount,
          count(*) filter (where status = 'Draft')::int as draft_count,
          count(*) filter (where status = 'Sent')::int as sent_count,
          count(*) filter (where status = 'Paid')::int as paid_count,
          count(*) filter (where status = 'Overdue')::int as overdue_count,
          coalesce(sum(total) filter (where status = 'Paid'), 0)::numeric as paid_amount,
          coalesce(sum(total) filter (where status in ('Draft', 'Sent', 'Overdue')), 0)::numeric as pending_amount
        FROM drm.invoices`
      );

      const row = rows[0] || {};
      res.json({
        totalCount: row.total_count ?? 0,
        totalAmount: String(row.total_amount ?? '0'),
        draftCount: row.draft_count ?? 0,
        sentCount: row.sent_count ?? 0,
        paidCount: row.paid_count ?? 0,
        overdueCount: row.overdue_count ?? 0,
        paidAmount: String(row.paid_amount ?? '0'),
        pendingAmount: String(row.pending_amount ?? '0'),
      });
    } catch (error) {
      console.error("Error fetching invoice stats:", error);
      res.status(500).json({ error: "Failed to fetch invoice stats" });
    }
  });

  // GET /api/account/invoices/next-number - Get next invoice number
  app.get("/api/account/invoices/next-number", async (_req, res) => {
    try {
      const result = await db.select({ count: sql<number>`COUNT(*)` }).from(invoices);
      const nextNumber = `INV-${String((result[0]?.count || 0) + 1).padStart(5, "0")}`;
      res.json({ invoiceNumber: nextNumber });
    } catch (error) {
      console.error("Error generating invoice number:", error);
      res.status(500).json({ error: "Failed to generate invoice number" });
    }
  });

  // GET /api/account/invoices/:id - Get single invoice
  app.get("/api/account/invoices/:id", async (req, res) => {
    try {
      const [invoice] = await db.select()
        .from(invoices)
        .where(eq(invoices.id, req.params.id));

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  // POST /api/account/invoices - Create new invoice
  //
  // LEGACY endpoint (Patch 5 Stage 4 / P7). This writes to the separate `invoices`
  // table, NOT the canonical `drm.product_posting_invoices` workflow owned by
  // InvoiceWorkflowService. The canonical manual-create path is POST /api/invoices.
  // Minimal hardening applied here: the same role policy as the canonical path
  // (sales + admin; service_executive only via config; account_manager retained
  // for legacy callers). REMAINING GAP: this legacy table has no canonical
  // invoice_type enum and is not part of the HOD/Accounts approval state machine,
  // so the closed-vocabulary type check and approval-completeness gates do NOT
  // apply here. New invoices should use the canonical POST /api/invoices.
  app.post(
    "/api/account/invoices",
    requireManualInvoiceCreator({ extraAllowedRoles: [ROLES.ACCOUNT_MANAGER] }),
    async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const validated = insertInvoiceSchema.parse(req.body);
      const [invoice] = await db.insert(invoices).values({
        ...validated,
        createdByUserId: getUserId(req)!,
      }).returning();

      res.status(201).json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating invoice:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  // PATCH /api/account/invoices/:id - Update invoice
  app.patch("/api/account/invoices/:id", requireActionPermission("invoice.update"), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Mass-assignment guard: only whitelisted columns may be updated.
      // invoiceNumber / id / createdByUserId / createdAt remain immutable here.
      const writable = pickWritable(req.body ?? {}, INVOICE_WRITABLE_FIELDS);
      if (writable.subtotal !== undefined) assertNonNegativeAmount(writable.subtotal, "subtotal");
      if (writable.tax !== undefined) assertNonNegativeAmount(writable.tax, "tax");
      if (writable.total !== undefined) assertNonNegativeAmount(writable.total, "total");
      if (writable.currency !== undefined) assertValidCurrency(writable.currency, "currency");

      const [existing] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const [invoice] = await db.update(invoices)
        .set({
          ...(writable as any),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, req.params.id))
        .returning();

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      await AuditLogService.record({
        actorUserId: (req.user as any)?.userId ?? (req.user as any)?.id,
        action: "invoice.update",
        module: "account",
        entityType: "Invoice",
        entityId: String(req.params.id),
        before: { status: existing.status },
        after: { ...(writable as any) },
        req,
      });

      res.json(invoice);
    } catch (error) {
      if (error instanceof ApiError) return sendError(res, error);
      console.error("Error updating invoice:", error);
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  // PATCH /api/account/invoices/:id/status - Update invoice status
  app.patch("/api/account/invoices/:id/status", requireActionPermission("invoice.update_status"), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const statusSchema = z.object({
        status: z.enum(["Draft", "Pending", "Sent", "Paid", "Overdue", "Cancelled"]),
      });
      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      }
      const { status } = parsed.data;

      const [existing] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const updateData: any = { status, updatedAt: new Date() };
      if (status === "Paid") {
        updateData.paidAt = new Date();
      }

      const [invoice] = await db.update(invoices)
        .set(updateData)
        .where(eq(invoices.id, req.params.id))
        .returning();

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      await AuditLogService.recordTransition({
        actorUserId: (req.user as any)?.userId ?? (req.user as any)?.id,
        action: "invoice.update_status",
        module: "account",
        entityType: "Invoice",
        entityId: String(req.params.id),
        previousStatus: existing.status ?? undefined,
        nextStatus: status,
        req,
      });

      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice status:", error);
      res.status(500).json({ error: "Failed to update invoice status" });
    }
  });

  // DELETE /api/account/invoices/:id - Delete invoice
  app.delete("/api/account/invoices/:id", requireActionPermission("invoice.delete"), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const [invoice] = await db.delete(invoices)
        .where(eq(invoices.id, req.params.id))
        .returning();

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      await AuditLogService.record({
        actorUserId: (req.user as any)?.userId ?? (req.user as any)?.id,
        action: "invoice.delete",
        module: "account",
        entityType: "Invoice",
        entityId: String(req.params.id),
        before: { status: invoice.status, invoiceNumber: (invoice as any).invoiceNumber },
        req,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  // ===== Ledger Routes =====

  // GET /api/account/ledger - Get ledger entries
  app.get("/api/account/ledger", async (req, res) => {
    try {
      const { entryType, category, dateFrom, dateTo, limit = "100" } = req.query;

      let query = db.select().from(ledgerEntries).orderBy(desc(ledgerEntries.entryDate)).$dynamic();

      const conditions = [];
      if (entryType) conditions.push(eq(ledgerEntries.entryType, entryType as any));
      if (category) conditions.push(eq(ledgerEntries.category, category as string));
      if (dateFrom) conditions.push(gte(ledgerEntries.entryDate, new Date(dateFrom as string)));
      if (dateTo) conditions.push(lte(ledgerEntries.entryDate, new Date(dateTo as string)));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      query = query.limit(parseInt(limit as string));

      const result = await query;
      res.json(result);
    } catch (error) {
      console.error("Error fetching ledger entries:", error);
      sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to fetch ledger entries" });
    }
  });

  // GET /api/account/ledger/summary - Get ledger summary
  app.get("/api/account/ledger/summary", async (_req, res) => {
    try {
      const result = await db.select({
        totalCredits: sql<string>`COALESCE(SUM(amount) FILTER (WHERE entry_type = 'Credit'), 0)`,
        totalDebits: sql<string>`COALESCE(SUM(amount) FILTER (WHERE entry_type = 'Debit'), 0)`,
        entryCount: sql<number>`COUNT(*)`,
      }).from(ledgerEntries);

      const summary = result[0] || { totalCredits: "0", totalDebits: "0", entryCount: 0 };
      const balance = parseFloat(summary.totalCredits) - parseFloat(summary.totalDebits);

      res.json({ ...summary, balance: balance.toFixed(2) });
    } catch (error) {
      console.error("Error fetching ledger summary:", error);
      sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to fetch ledger summary" });
    }
  });

  // POST /api/account/ledger - Create ledger entry
  app.post("/api/account/ledger", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const validated = insertLedgerEntrySchema.parse(req.body);
      // Stage 8: validate posting amount, currency and entry type.
      const ledgerAmt = Number(validated.amount);
      if (!Number.isFinite(ledgerAmt) || ledgerAmt <= 0) {
        return res.status(400).json({ error: "Ledger amount must be greater than 0" });
      }
      if (!["USD", "PKR", "Dollar"].includes(String(validated.currency ?? "USD"))) {
        return res.status(400).json({ error: "Invalid currency" });
      }
      if (!["Credit", "Debit"].includes(String((validated as any).entryType))) {
        return res.status(400).json({ error: "entryType must be Credit or Debit" });
      }
      const [entry] = await db.insert(ledgerEntries).values({
        ...validated,
        createdByUserId: getUserId(req)!,
      }).returning();

      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating ledger entry:", error);
      res.status(500).json({ error: "Failed to create ledger entry" });
    }
  });

  // DELETE /api/account/ledger/:id - Delete ledger entry
  app.delete("/api/account/ledger/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const [entry] = await db.delete(ledgerEntries)
        .where(eq(ledgerEntries.id, req.params.id))
        .returning();

      if (!entry) {
        return res.status(404).json({ error: "Ledger entry not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting ledger entry:", error);
      res.status(500).json({ error: "Failed to delete ledger entry" });
    }
  });

  // ===== Temporary GM Entries Routes =====

  // GET /api/account/customers-list - Return real customers for dropdown
  app.get("/api/account/customers-list", async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, company_name, person_name, drm_id
         FROM drm.customers
         WHERE coalesce(is_deleted, false) = false
         ORDER BY company_name
         LIMIT 500`
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching customers list:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // GET /api/account/users-list - Return real users for person dropdown
  app.get("/api/account/users-list", async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, full_name, email, role
         FROM drm.users
         WHERE is_active = true
         ORDER BY full_name
         LIMIT 200`
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching users list:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // GET /api/account/temp-gm - List all temporary GM entries (exclude deleted)
  app.get("/api/account/temp-gm", async (_req, res) => {
    try {
      const entries = await pool.query(
        `SELECT id, company_name, person_name, amount, amount_type, reason, comment, status, created_at as "createdAt"
         FROM drm.temp_gm_entries
         WHERE coalesce(is_deleted, false) = false
         ORDER BY created_at DESC`
      );
      res.json(entries.rows);
    } catch (error) {
      console.error("Error fetching temp GM entries:", error);
      res.status(500).json({ error: "Failed to fetch temp GM entries" });
    }
  });

  // POST /api/account/temp-gm - Create new temporary GM entry
  app.post("/api/account/temp-gm", requireFinancialPermission(FINANCIAL_ACTIONS.tempGmCreate), async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { companyName, personName, amount, amountType = 'PKR', reason, comment } = req.body;
      if (!companyName || !personName || !amount || !reason) {
        return res.status(400).json({ error: "companyName, personName, amount, reason are required" });
      }
      const userId = getUserId(req)!;
      console.log('[temp-gm POST] inserting with created_by=', userId);
      const { rows } = await pool.query(
        `INSERT INTO drm.temp_gm_entries
           (company_name, person_name, amount, amount_type, reason, comment, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
         RETURNING id, company_name, person_name, amount, amount_type, reason, comment, status, created_at AS "createdAt"`,
        [companyName, personName, amount, amountType, reason, comment || null, userId]
      );
      console.log('[temp-gm POST] success, id=', rows[0]?.id);
      res.status(201).json(rows[0]);
    } catch (error: any) {
      console.error("Error creating temp GM entry:", error.message);
      res.status(500).json({ error: "Failed to create temp GM entry", detail: error.message });
    }
  });

  // PATCH /api/account/temp-gm/:id/status - Update temp GM entry status
  app.patch("/api/account/temp-gm/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const { rows } = await pool.query(
        `UPDATE drm.temp_gm_entries SET status = $1 WHERE id = $2 RETURNING *`,
        [status, req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: "Entry not found" });
      res.json(rows[0]);
    } catch (error) {
      console.error("Error updating temp GM entry:", error);
      res.status(500).json({ error: "Failed to update entry" });
    }
  });

  // DELETE /api/account/temp-gm/:id
  app.delete("/api/account/temp-gm/:id", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { rows } = await pool.query(
        `DELETE FROM drm.temp_gm_entries WHERE id = $1 RETURNING id`,
        [req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: "Entry not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting temp GM entry:", error);
      res.status(500).json({ error: "Failed to delete entry" });
    }
  });

  // ===== Refund GM Entries Routes =====

  // GET /api/account/refund-gm - List all refund GM entries
  app.get("/api/account/refund-gm", async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, company_name AS "companyName", person_name AS "personName",
                amount, amount_type AS "amountType", comment, status,
                created_at AS "createdAt"
         FROM drm.refund_gm_entries
         ORDER BY created_at DESC`
      );
      res.json(rows);
    } catch (error) {
      console.error("Error fetching refund GM entries:", error);
      res.status(500).json({ error: "Failed to fetch refund GM entries" });
    }
  });

  // POST /api/account/refund-gm - Create new refund GM entry
  app.post("/api/account/refund-gm", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { companyName, personName, amount, amountType = 'PKR', comment } = req.body;
      if (!companyName || !personName || !amount) {
        return res.status(400).json({ error: "companyName, personName, amount are required" });
      }
      // Stage 8: refund amount must be positive and the reason is mandatory.
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ error: "Refund amount must be greater than 0" });
      }
      if (!String(comment ?? "").trim()) {
        return res.status(400).json({ error: "A reason (comment) is required for a refund" });
      }
      const userId = getUserId(req)!;
      const { rows } = await pool.query(
        `INSERT INTO drm.refund_gm_entries (company_name, person_name, amount, amount_type, comment, status, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6)
         RETURNING id, company_name AS "companyName", person_name AS "personName",
                   amount, amount_type AS "amountType", comment, status, created_at AS "createdAt"`,
        [companyName, personName, amount, amountType, comment || null, userId]
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      console.error("Error creating refund GM entry:", error);
      res.status(500).json({ error: "Failed to create refund GM entry" });
    }
  });

  // DELETE /api/account/refund-gm/:id
  app.delete("/api/account/refund-gm/:id", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { rows } = await pool.query(
        `DELETE FROM drm.refund_gm_entries WHERE id = $1 RETURNING id`,
        [req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: "Entry not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting refund GM entry:", error);
      res.status(500).json({ error: "Failed to delete entry" });
    }
  });

  // ===== Pending Quotations for Account Manager =====
  // Returns all invoices that HOD has approved (pending_account_manager status)
  app.get("/api/account/pending-quotations", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const page = Math.max(1, parseInt(String(req.query.page ?? "1")) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20")) || 20));
      const offset = (page - 1) * limit;

      const { rows } = await pool.query(`
        SELECT
          q.id::text,
          q.account_holder   AS "accountHolder",
          q.company,
          q.email,
          q.contact,
          q.gst_percent      AS "gstPercent",
          q.discount_type    AS "discountType",
          q.discount_value   AS "discountValue",
          q.sub_amount       AS "subAmount",
          q.gst_amount       AS "gstAmount",
          q.total_amount     AS "totalAmount",
          q.grand_total      AS "grandTotal",
          q.save_status      AS "saveStatus",
          q.note,
          q.created_at       AS "createdAt",
          q.updated_at       AS "updatedAt",
          q.lead_id          AS "leadId",
          q.customer_id      AS "customerId",
          u.full_name        AS "submittedByName",
          u.email            AS "submittedByEmail",
          'quotation'        AS "source",
          NULL               AS "paymentProofUrl"
        FROM drm.quotations q
        LEFT JOIN drm.users u ON u.id::text = q.created_by::text
        WHERE q.save_status = 'pending_account_manager'
        
        UNION ALL
        
        SELECT
          p.id::text,
          p.company_name     AS "accountHolder",
          p.company_name     AS "company",
          NULL               AS "email",
          NULL               AS "contact",
          0                  AS "gstPercent",
          'AMOUNT'           AS "discountType",
          0                  AS "discountValue",
          p.amount::numeric  AS "subAmount",
          0                  AS "gstAmount",
          p.amount::numeric  AS "totalAmount",
          p.amount::numeric  AS "grandTotal",
          p.status           AS "saveStatus",
          p.project_name     AS "note",
          p.created_at       AS "createdAt",
          p.updated_at       AS "updatedAt",
          NULL               AS "leadId",
          NULL               AS "customerId",
          u.full_name        AS "submittedByName",
          u.email            AS "submittedByEmail",
          'product_posting'  AS "source",
          NULL               AS "paymentProofUrl"
        FROM drm.product_posting_invoices p
        LEFT JOIN drm.users u ON u.id = p.sales_exec_id
        WHERE p.status = 'PENDING_ACCOUNT'
        
        UNION ALL
        
        SELECT
          i.id::text,
          i.customer_name     AS "accountHolder",
          i.customer_name     AS "company",
          i.customer_email    AS "email",
          NULL               AS "contact",
          0                  AS "gstPercent",
          'AMOUNT'           AS "discountType",
          0                  AS "discountValue",
          i.subtotal::numeric AS "subAmount",
          i.tax::numeric      AS "gstAmount",
          i.total::numeric    AS "totalAmount",
          i.total::numeric    AS "grandTotal",
          i.status::text      AS "saveStatus",
          i.notes             AS "note",
          i.created_at        AS "createdAt",
          i.updated_at        AS "updatedAt",
          NULL                AS "leadId",
          i.customer_id::text AS "customerId",
          u.full_name         AS "submittedByName",
          u.email             AS "submittedByEmail",
          'standard_invoice'  AS "source",
          NULL                AS "paymentProofUrl"
        FROM drm.invoices i
        LEFT JOIN drm.users u ON u.id::text = i.created_by_user_id::text
        WHERE i.status = 'Sent'
        
        ORDER BY "updatedAt" DESC NULLS LAST
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      const countRes = await pool.query(
        `SELECT (
          (SELECT COUNT(*) FROM drm.quotations WHERE save_status = 'pending_account_manager') +
          (SELECT COUNT(*) FROM drm.product_posting_invoices WHERE status = 'PENDING_ACCOUNT') +
          (SELECT COUNT(*) FROM drm.invoices WHERE status = 'Sent')
        )::int AS count`
      );

      return res.json({
        success: true,
        data: rows,
        meta: { total: countRes.rows[0]?.count ?? 0, page, limit }
      });
    } catch (error) {
      console.error("Error fetching pending quotations:", error);
      return res.status(500).json({ error: "Failed to fetch pending quotations" });
    }
  });

  // Account Manager approves/rejects a quotation invoice
  app.post("/api/account/pending-quotations/:id/approve", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const { action, note, amount, paymentMethod, receiptNumber, projectName: customProjectName } = req.body as { 
        action: "approve" | "reject"; 
        note?: string;
        amount?: number | string;
        paymentMethod?: string;
        receiptNumber?: string;
        projectName?: string;
      };

      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
      }

      const newStatus = action === "approve" ? "Approved" : "Rejected";
      const postingStatus = action === "approve" ? "APPROVED" : "REJECTED";

      // Try updating quotations first
      const quotRes = await pool.query(`
        UPDATE drm.quotations
        SET save_status = $1,
            note = COALESCE($2, note),
            payment_method = COALESCE($3, payment_method),
            updated_at = now()
        WHERE id = $4 AND save_status = 'pending_account_manager'
        RETURNING id, save_status AS "saveStatus", created_by AS "createdBy", company, customer_id AS "customerId", 'quotation' as source
      `, [newStatus, note ?? null, paymentMethod ?? null, id]);

      let quotation = quotRes.rows[0];

      if (!quotation) {
        // Try updating product_posting_invoices
        const postingRes = await pool.query(`
          UPDATE drm.product_posting_invoices
          SET status = $1,
              payment_method = COALESCE($2, payment_method),
              updated_at = now()
          WHERE id = $3 AND status = 'PENDING_ACCOUNT'
          RETURNING id, status AS "saveStatus", sales_exec_id AS "createdBy", company_name as company, customer_id as "customerId", project_name, 'product_posting' as source
        `, [postingStatus, paymentMethod ?? null, id]);

        if (postingRes.rows.length === 0) {
          // Try updating standard invoices
          const invRes = await pool.query(`
            UPDATE drm.invoices
            SET status = $1,
                payment_method = COALESCE($2, payment_method),
                updated_at = now()
            WHERE id = $3 AND status = 'Sent'
            RETURNING id, status AS "saveStatus", created_by_user_id AS "createdBy", customer_name as company, customer_id as "customerId", 'standard_invoice' as source
          `, [action === "approve" ? "Paid" : "Rejected", paymentMethod ?? null, id]);

          if (invRes.rows.length === 0) {
            return res.status(404).json({ error: "Invoice not found or already processed" });
          }
          quotation = invRes.rows[0];
        } else {
          quotation = postingRes.rows[0];
        }
      }

      if (newStatus === "Approved") {
        try {
          const newProjectId = crypto.randomUUID();
          const projectName = customProjectName || (quotation.source === 'product_posting' ? 'Alibaba Product Posting' : `Proj-${(quotation.company || "").replace(/\s+/g, '-').substring(0, 15) || quotation.id.substring(0, 8)}`);
          const ownerUserId = quotation.createdBy;
          const customerId = quotation.customerId;
          const description = quotation.source === 'product_posting' 
            ? `Auto-created from product posting invoice ${quotation.id}`
            : quotation.source === 'standard_invoice'
            ? `Auto-created from standard invoice ${quotation.id}`
            : `Auto-created from quotation ${quotation.id}`;

          console.log(`[APPROVE_DEBUG] Quotation source: ${quotation.source}, ownerUserId: ${ownerUserId}, customerId: ${customerId}`);

          // Create the project
          await pool.query(`
            INSERT INTO drm.projects (id, name, description, owner_user_id, customer_id, status, created_by, created_at, updated_at, invoice_id)
            VALUES ($1, $2, $3, $4, $5, 'Documents Pending', $6, now(), now(), $7)
          `, [
            newProjectId,
            projectName,
            description,
            ownerUserId,
            customerId,
            ownerUserId,
            (quotation.source === 'product_posting' || quotation.source === 'standard_invoice') ? quotation.id : null
          ]);

          // Create Project Financials & Payment record if amount is provided
          if (amount) {
            const financialId = crypto.randomUUID();
            await pool.query(`
              INSERT INTO drm.project_financials (id, project_id, total_amount, paid_amount, currency, created_at, updated_at)
              VALUES ($1, $2, $3, $4, 'USD', now(), now())
            `, [financialId, newProjectId, amount, amount]);

            await pool.query(`
              INSERT INTO drm.project_payments (id, project_id, amount, payment_method, reference, notes, paid_by_user_id, paid_at, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
            `, [crypto.randomUUID(), newProjectId, amount, paymentMethod || 'BankTransfer', receiptNumber || '', note || '', ownerUserId]);
          }

          console.log(`[APPROVE_DEBUG] Project created: ${newProjectId}`);

          // Log Activity and Notify
          const { ActivityLogService } = await import("../services/activity-service");

          await ActivityLogService.log({
            userId: ownerUserId,
            action: "AUTO_CREATED",
            resourceType: "Project",
            resourceId: newProjectId,
            details: description
          });

          console.log(`[APPROVE_DEBUG] Sending notification to: ${ownerUserId}`);
          
          await NotificationService.notify({
            userId: ownerUserId,
            message: `Your '${quotation.project_name || (quotation.source === 'product_posting' ? 'Product Posting Invoice' : 'Quotation')}' for '${quotation.company || 'your company'}' has been approved by the Account Manager. Project '${projectName}' has been created. Please upload the required documents in the PMS module to proceed.`,
            type: "SUCCESS",
            link: "/pms/approvals"
          });
          
          console.log(`[APPROVE_DEBUG] Notification sent successfully`);
        } catch (projErr) {
          console.error("Error auto-creating project after quotation approval:", projErr);
        }
      }

      return res.json({ success: true, data: quotation });
    } catch (error) {
      console.error("Error processing quotation approval:", error);
      return res.status(500).json({ error: "Failed to process invoice" });
    }
  });
  
  // GET /api/account/ab-report/stats - Get statistics for AB Report
  app.get("/api/account/ab-report/stats", async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const params: any[] = [];
      let dateWhere = "";
      
      if (dateFrom && dateTo) {
        params.push(new Date(String(dateFrom)));
        params.push(new Date(String(dateTo)));
        dateWhere = ` AND created_at >= $1 AND created_at <= $2`;
      }

      const { rows } = await pool.query(`
        WITH gm_stats AS (
          SELECT 
            COUNT(*) FILTER (WHERE entry_type IN ('Standard', 'GM')) as client_count,
            COALESCE(SUM(amount_pkr) FILTER (WHERE entry_type IN ('Standard', 'GM')), 0) as client_amount,
            COUNT(*) FILTER (WHERE entry_type = 'Cheque') as cheque_count,
            COALESCE(SUM(amount_pkr) FILTER (WHERE entry_type = 'Cheque'), 0) as cheque_amount,
            COUNT(*) FILTER (WHERE is_loan = 1) as loan_count,
            COALESCE(SUM(amount_pkr) FILTER (WHERE is_loan = 1), 0) as loan_amount,
            COALESCE(SUM(customer_dollar), 0) as total_dollar_balance,
            COALESCE(SUM(amount_usd), 0) as total_dollar_buy
          FROM drm.gm_entries
          WHERE coalesce(is_deleted, false) = false ${dateWhere.replace('$1', '$1').replace('$2', '$2')}
        ),
        temp_stats AS (
          SELECT 
            COUNT(*) as temp_count,
            COALESCE(SUM(amount), 0) as temp_amount
          FROM drm.temp_gm_entries
          WHERE 1=1 ${dateWhere.replace('$1', '$1').replace('$2', '$2')}
        ),
        refund_stats AS (
          SELECT 
            COALESCE(SUM(amount), 0) as refund_amount
          FROM drm.refund_gm_entries
          WHERE status = 'approved' ${dateWhere.replace('$1', '$1').replace('$2', '$2')}
        )
        SELECT * FROM gm_stats, temp_stats, refund_stats;
      `, params);

      const stats = rows[0] || {};
      
      // Calculate derived values
      const sum_pkr = Number(stats.client_amount) + Number(stats.cheque_amount) + Number(stats.loan_amount);
      // ACC-LEGACY-001 (Patch 7 Stage 5): the dollar buy figure is stored in USD
      // and there is no reliable PKR conversion rate available at this aggregate
      // level. Previously this multiplied by a hardcoded `280` and presented the
      // invented PKR number as real. We now report the real USD total honestly and
      // expose conversion metadata instead of fabricating a rate.
      const total_dollar_usd = Number(stats.total_dollar_buy);
      const dollarPkrRate: number | null = null;
      const cash_in_hand = sum_pkr - Number(stats.refund_amount);

      res.json({
        account: {
          cash: {
            clientPayment: { count: Number(stats.client_count), amount: Number(stats.client_amount) },
            cheque: { count: Number(stats.cheque_count), amount: Number(stats.cheque_amount) },
            loanRecovered: { count: Number(stats.loan_count), amount: Number(stats.loan_amount) },
            lastClosing: { count: 0, amount: 0 },
            total: { count: Number(stats.client_count) + Number(stats.cheque_count) + Number(stats.loan_count), amount: sum_pkr }
          },
          dollars: {
            balance: { count: 0, amount: Number(stats.total_dollar_balance) },
            buy: { count: 0, amount: Number(stats.total_dollar_buy) },
            required: { count: 0, amount: 0 },
            getFunds: { count: 0, amount: 0 },
            total: { count: 0, amount: Number(stats.total_dollar_balance) + Number(stats.total_dollar_buy) }
          },
          tempPayment: {
            tempGm: { count: Number(stats.temp_count), amount: Number(stats.temp_amount) },
            martiniPending: { count: 0, amount: 0 },
            pendingCheque: { count: 0, amount: 0 },
            advancePay: { count: 0, amount: 0 },
            total: { count: Number(stats.temp_count), amount: Number(stats.temp_amount) }
          },
          accountClosing: {
            clientPayment: { count: 0, amount: Number(stats.client_amount) },
            cheque: { count: 0, amount: Number(stats.cheque_amount) },
            pendingCheque: { count: 0, amount: 0 },
            extraAmount: { count: 0, amount: 0 },
            total: { count: 0, amount: Number(stats.client_amount) + Number(stats.cheque_amount) }
          }
        },
        closing: [
          { label: "Client Payment", type: "P", val: Number(stats.client_amount).toLocaleString() },
          { label: "Cheque Payment", type: "P", val: Number(stats.cheque_amount).toLocaleString() },
          { label: "Loan Recovered", type: "P", val: Number(stats.loan_amount).toLocaleString() },
          { label: "Sum", type: "P", val: sum_pkr.toLocaleString(), color: "text-blue-500", border: true },
          { label: "Refund Amount", type: "P", val: Number(stats.refund_amount).toLocaleString() },
          { label: "Total Dollar (USD)", type: "P", val: `$${total_dollar_usd.toLocaleString()}`, color: "text-rose-400" },
          { label: "Cash In Hand", type: "P", val: cash_in_hand.toLocaleString(), color: "text-emerald-500", bold: true },
        ],
        meta: {
          dollarConversion: {
            usdTotal: total_dollar_usd,
            pkrRate: dollarPkrRate,
            pkrTotal: dollarPkrRate === null ? null : total_dollar_usd * dollarPkrRate,
            rateSource: dollarPkrRate === null ? "unavailable" : "stored",
            note: "Dollar totals are shown in USD; no stored PKR conversion rate is applied.",
          },
        },
      });
    } catch (error) {
      console.error("Error fetching AB report stats:", error);
      res.status(500).json({ error: "Failed to fetch AB report statistics" });
    }
  });

  // GET /api/account/dollar-system/list - Get lists for Dollar System (Wallets Dashboard)
  app.get("/api/account/dollar-system/list", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const params: any[] = [];
      let dateWhere = "";
      let buyingDateWhere = "";

      if (startDate && endDate) {
        params.push(new Date(String(startDate)));
        params.push(new Date(String(endDate)));
        dateWhere = ` AND created_at >= $1 AND created_at <= $2`;
        buyingDateWhere = ` AND date >= $1 AND date <= $2`;
      }

      // 1. Wallet Balances & Stats (Combining GM entries and Dollar Buying)
      const statsRes = await pool.query(`
        WITH gm_stats AS (
          SELECT
            COALESCE(SUM(amount_usd), 0) as gm_usd,
            COALESCE(SUM(amount_pkr), 0) as gm_pkr,
            COALESCE(SUM(amount_usd) FILTER (WHERE is_loan = 1), 0) as loan_usd,
            COALESCE(SUM(amount_pkr) FILTER (WHERE is_loan = 1), 0) as loan_pkr,
            COALESCE(SUM(amount_pkr) FILTER (WHERE entry_type = 'Recovery'), 0) as cash_rec,
            COALESCE(SUM(amount_usd) FILTER (WHERE entry_type = 'Recovery'), 0) as dollar_rec
          FROM drm.gm_entries
          WHERE coalesce(is_deleted, false) = false
        ),
        buy_stats AS (
          SELECT
            COALESCE(SUM(dollar_amount), 0) as buy_usd,
            COALESCE(SUM(pkr_amount), 0) as buy_pkr
          FROM drm.dollar_buying
        )
        SELECT
          (gm_usd + buy_usd) as "dollarBalance",
          (gm_pkr - buy_pkr) as "pkrBalance",
          loan_usd as "loanDollar",
          loan_pkr as "loanPkr",
          cash_rec as "cashRecovered",
          dollar_rec as "dollarRecovered",
          buy_usd as "totalBuyingUsd",
          buy_pkr as "totalBuyingPkr"
        FROM gm_stats, buy_stats
      `);
      const walletStats = statsRes.rows[0];

      // 2. Full Payments
      const fullPayments = await pool.query(`
        SELECT id, drm_id as "drmId", created_at as "date", company_name as "company", sales_person_name as "salePerson", amount_usd as "dollar", amount_pkr as "pkr", dollar_rate as "rate", extra_discount_usd as "exDisc", alibaba_discount_usd as "abDisc"
        FROM drm.gm_entries
        WHERE coalesce(is_deleted, false) = false AND (entry_type IN ('Full', 'Standard', 'Service', 'GM') OR (is_loan = 0 AND is_partial_payment = 0)) ${dateWhere}
        ORDER BY created_at DESC LIMIT 50
      `, params);

      // 3. Partial Payments
      const partialPayments = await pool.query(`
        SELECT id, drm_id as "drmId", created_at as "date", company_name as "company", sales_person_name as "salePerson", amount_usd as "dollar", amount_pkr as "pkr", package_type as "package", gm_type as "type"
        FROM drm.gm_entries
        WHERE coalesce(is_deleted, false) = false AND (entry_type = 'Partial' OR is_partial_payment = 1) ${dateWhere}
        ORDER BY created_at DESC LIMIT 50
      `, params);

      // 4. Loan Payments
      const loans = await pool.query(`
        SELECT id, drm_id as "drmId", created_at as "date", company_name as "company", sales_person_name as "salePerson", amount_usd as "dollar", amount_pkr as "pkr", is_loan, entry_type
        FROM drm.gm_entries
        WHERE coalesce(is_deleted, false) = false AND is_loan = 1 ${dateWhere}
        ORDER BY created_at DESC LIMIT 50
      `, params);

      // 5. Recent Transactions
      const transactions = await pool.query(`
        SELECT id, company_name as "name", created_at as "date", notes as "email", amount_usd as "amount", dollar_rate as "rate"
        FROM drm.gm_entries
        WHERE coalesce(is_deleted, false) = false
        ORDER BY created_at DESC LIMIT 10
      `);

      // 6. Pending Approvals
      const pendingApprovals = await pool.query(`
        SELECT id, drm_id as "drmId", company_name as "company", sales_person_name as "salePerson", amount_usd as "dollar", amount_pkr as "pkr", dollar_rate as "rate", alibaba_discount_usd as "abDisc", extra_discount_usd as "exDisc", package_type as "package", gm_type as "type", status
        FROM drm.gm_entries
        WHERE coalesce(is_deleted, false) = false AND status = 'Pending' ${dateWhere}
        ORDER BY created_at DESC LIMIT 50
      `, params);

      // 7. Paid Alibaba
      const alibabaPayments = await pool.query(`
        SELECT id, created_at as "date", drm_id as "drmId", company_name as "company", amount_usd as "dollar", status,
               created_at as "abDate", 'pk1366559178xcih' as "abId", 'P2603262976188360_1' as "orderId"
        FROM drm.gm_entries
        WHERE coalesce(is_deleted, false) = false AND status = 'Approved' ${dateWhere}
        ORDER BY created_at DESC LIMIT 50
      `, params);

      // 8. Calculate Monthly Totals for the 4 small cards
      const monthlyStatsRes = await pool.query(`
        SELECT
          COALESCE(SUM(dollar_amount), 0) as "monthBuying",
          COALESCE(SUM(pkr_amount), 0) as "monthBuyingPkr"
        FROM drm.dollar_buying
        WHERE date_trunc('month', date) = date_trunc('month', now())
      `);
      const { monthBuying, monthBuyingPkr } = monthlyStatsRes.rows[0];

      const monthPaidRes = await pool.query(`
        SELECT
          COALESCE(SUM(amount_usd), 0) as "monthPaidUsd",
          COALESCE(SUM(amount_pkr), 0) as "monthPaidPkr"
        FROM drm.gm_entries
        WHERE coalesce(is_deleted, false) = false
          AND status = 'Approved'
          AND date_trunc('month', created_at) = date_trunc('month', now())
      `);
      const { monthPaidUsd, monthPaidPkr } = monthPaidRes.rows[0];

      res.json({
        walletStats,
        fullPayments: fullPayments.rows,
        partialPayments: partialPayments.rows,
        loans: loans.rows,
        pendingApprovals: pendingApprovals.rows,
        alibabaPayments: alibabaPayments.rows,
        transactions: transactions.rows,
        counts: {
          full: fullPayments.rows.length,
          partial: partialPayments.rows.length,
          pending: pendingApprovals.rows.length,
          temp: 0,
          liabilities: 0
        },
        monthlySummary: {
          buyingUsd: monthBuying,
          buyingPkr: monthBuyingPkr,
          paidUsd: monthPaidUsd,
          paidPkr: monthPaidPkr,
          balanceUsd: Number(walletStats.dollarBalance),
          advancePkr: 0
        }
      });
    } catch (error) {
      console.error("Error fetching dollar system list:", error);
      sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to fetch dollar system details" });
    }
  });


  // POST /api/account/dollar-system/transaction - Record new wallet transaction
  app.post(
    "/api/account/dollar-system/transaction",
    requireFinancialPermission(FINANCIAL_ACTIONS.dollarTransaction),
    async (req, res) => {
    try {
      const { type, amountUsd, amountPkr, rate, company, notes } = req.body;

      // Validate the transaction type against the known, supported set so an
      // unknown value can never silently fall through to a Standard/Approved row.
      const ALLOWED_DOLLAR_TX_TYPES = ["SEND", "RECEIVE", "ADVANCE", "BALANCE"];
      if (!type) {
        return sendApiError(res, { status: 400, code: "VALIDATION_ERROR", message: "Transaction type is required" });
      }
      if (!ALLOWED_DOLLAR_TX_TYPES.includes(type)) {
        return sendApiError(res, { status: 400, code: "VALIDATION_ERROR", message: "Invalid transaction type. Must be one of: SEND, RECEIVE, ADVANCE, BALANCE." });
      }

      // Validate monetary inputs (additive — only assert on values actually
      // provided, so valid calls that omit a field keep their existing behaviour).
      if (amountUsd !== undefined && amountUsd !== null && amountUsd !== "") {
        assertNonNegativeAmount(amountUsd, "amountUsd");
      }
      if (amountPkr !== undefined && amountPkr !== null && amountPkr !== "") {
        assertNonNegativeAmount(amountPkr, "amountPkr");
      }
      if (rate !== undefined && rate !== null && rate !== "") {
        assertValidExchangeRate(rate, "rate");
      }

      let gmType = 'GM';
      let entryType = 'Standard';
      let finalAmountUsd = Number(amountUsd) || 0;
      let finalAmountPkr = Number(amountPkr) || 0;

      if (type === 'SEND') {
        finalAmountUsd = -Math.abs(finalAmountUsd);
        finalAmountPkr = -Math.abs(finalAmountPkr);
        entryType = 'Standard';
      } else if (type === 'RECEIVE') {
        finalAmountUsd = Math.abs(finalAmountUsd);
        finalAmountPkr = Math.abs(finalAmountPkr);
        entryType = 'Recovery';
      } else if (type === 'ADVANCE') {
        entryType = 'Advance';
      } else if (type === 'BALANCE') {
        entryType = 'Adjustment';
      }

      // ACC-LEGACY-001: never fabricate an exchange rate. Store the validated
      // rate when the caller supplies one, otherwise NULL (drm.gm_entries.dollar_rate
      // is nullable) — previously this defaulted to a hardcoded `277`, writing an
      // invented market rate into the ledger.
      const hasRate = rate !== undefined && rate !== null && rate !== "";
      const storedRate: number | null = hasRate ? Number(rate) : null;
      // Internal wallet reference. Date.now() alone can collide on rapid calls;
      // a short random suffix keeps it unique without changing the WLT- convention.
      const walletRef = `WLT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Persist the wallet entry inside an explicit transaction boundary.
      // NOTE: the post-response product-posting invoices below are intentionally
      // best-effort and are NOT part of this transaction (no atomicity claim).
      const result = await withPgTransaction((client) => client.query(`
        INSERT INTO drm.gm_entries (
          drm_id, company_name, amount, amount_usd, amount_pkr, dollar_rate, 
          entry_type, gm_type, package_type, notes, status, created_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING id
      `, [
        walletRef, 
        company || 'Wallet Operation', 
        finalAmountPkr,
        finalAmountUsd, 
        finalAmountPkr, 
        storedRate, 
        entryType, 
        gmType,
        'Wallet',
        notes || '', 
        'Approved', 
        req.user?.userId || null
      ]));

      const newId = result.rows[0].id;

      await AuditLogService.record({
        actorUserId: getUserId(req),
        action: FINANCIAL_ACTIONS.dollarTransaction,
        module: "office_accounts",
        entityType: "gm_entry",
        entityId: String(newId),
        after: {
          type,
          amountUsd: finalAmountUsd,
          amountPkr: finalAmountPkr,
          rate: storedRate,
          company: company || 'Wallet Operation',
        },
        req,
      });

      res.json({ success: true, id: newId });
      
      // Automatically create the default product-posting invoices (Patch 5
      // Stage 4 / P6). Wallet operations have no GM record, so no idempotency
      // key — matches prior behavior. Gated by configured timing (default
      // ON_GM_CREATION). Best-effort: never throws.
      if (req.user?.userId) {
        await generateDefaultInvoicesForGm({
          gmId: null,
          customerId: null,
          companyName: company || 'Wallet Operation',
          ownerUserId: req.user.userId,
          event: GM_INVOICE_GENERATION_TIMING.ON_GM_CREATION,
          actorUserId: req.user.userId,
          req,
        });
      }
    } catch (error) {
      console.error("Error creating transaction:", error);
      if (!res.headersSent) {
        sendError(res, error);
      }
    }
  });
// ===== Dollar Buying Routes =====

  app.get("/api/account/buyers", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM drm.dollar_buyers 
        WHERE is_active = true 
        ORDER BY name ASC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("Failed to fetch buyers:", err);
      res.status(500).json({ error: "Failed to fetch buyers" });
    }
  });

  app.post("/api/account/buyers", requireFinancialPermission(FINANCIAL_ACTIONS.dollarBuyerCreate), async (req, res) => {
    try {
      const data = insertDollarBuyerSchema.parse(req.body);
      const result = await pool.query(`
        INSERT INTO drm.dollar_buyers (name, reference, paypal_email, account_no)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [data.name, data.reference, data.paypalEmail, data.accountNo]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Failed to create buyer:", err);
      res.status(400).json({ error: "Invalid data" });
    }
  });

  app.get("/api/account/buying", async (req, res) => {
    try {
      const { buyerId, startDate, endDate } = req.query;
      let query = `
        SELECT b.*, db.name as buyer_name_full
        FROM drm.dollar_buying b
        LEFT JOIN drm.dollar_buyers db ON b.buyer_id = db.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (buyerId && buyerId !== 'all') {
        params.push(buyerId);
        query += ` AND b.buyer_id = $${params.length}`;
      }
      if (startDate) {
        params.push(new Date(startDate as string));
        query += ` AND b.date >= $${params.length}`;
      }
      if (endDate) {
        params.push(new Date(endDate as string));
        query += ` AND b.date <= $${params.length}`;
      }

      query += ` ORDER BY b.date DESC`;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error("Failed to fetch buying records:", err);
      res.status(500).json({ error: "Failed to fetch records" });
    }
  });

  app.post("/api/account/buying", async (req, res) => {
    try {
      const data = insertDollarBuyingSchema.parse(req.body);
      const user = req.user as any;
      const userId = user?.id || user?.userId;

      const result = await pool.query(`
        INSERT INTO drm.dollar_buying (
          buyer_id, buyer_name, buyer_reference, paypal_email, account_no,
          cheque_id, payment_method, type, dollar_amount, dollar_rate, 
          pkr_amount, date, detail, created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        data.buyerId, data.buyerName, data.buyerReference, data.paypalEmail, data.accountNo,
        data.chequeId, data.paymentMethod, data.type, data.dollarAmount, data.dollarRate,
        data.pkrAmount, data.date || new Date(), data.detail, userId
      ]);

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Failed to record buying:", err);
      res.status(400).json({ error: "Invalid data" });
    }
  });

  app.delete("/api/account/buying/:id", async (req, res) => {
    try {
      await pool.query(`DELETE FROM drm.dollar_buying WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete" });
    }
  });

  app.delete("/api/account/buyers/:id", async (req, res) => {
    try {
      // Soft delete
      await pool.query(`UPDATE drm.dollar_buyers SET is_active = false WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete" });
    }
  });
}
