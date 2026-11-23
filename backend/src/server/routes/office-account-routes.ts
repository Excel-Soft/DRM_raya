import { Router, Request, Response } from "express";
import { z } from "zod";
import { db, pool } from "../db";
import { 
  accountHeads, officeExpenses, officeVas, cheques, businessCustomers, invoices, customers, users,
  ledgerEntries, journalVouchers, journalVoucherLines,
  insertAccountHeadSchema, insertOfficeExpenseSchema, insertOfficeVasSchema,
  insertChequeSchema, insertBusinessCustomerSchema
} from "@shared/schema";
import { eq, desc, asc, and, gte, lte, ilike, or, notIlike, inArray, isNotNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { sendError, sendApiError, ApiError, badRequest, conflict, notFound } from "../utils/api-error";
import {
  requireFinancialPermission,
  FINANCIAL_ACTIONS,
  STAGE2_FINANCIAL_ROLES,
} from "./middleware/financial-permission";
import { ROLES, normalizeRole } from "../utils/role-utils";

// Who may delete an office expense (super_admin normalizes to admin).
const EXPENSE_DELETE_ROLES: string[] = ["admin", "super_hod", "hod"];
import { withFinancialTransaction } from "../utils/financial-transaction";
import { AuditLogService } from "./services/audit-log.service";
import { pickWritable, assertPositiveAmount, assertValidDate } from "../utils/financial-validation";
import { sendCsvExport } from "../utils/financial-export";
import { computeTrialBalance } from "../utils/trial-balance";

const router = Router();

const AUDIT_MODULE = "office_accounts";

// Stage 2 write/post/export role policy (Patch 4 spec G) — canonical
// definition moved to server/middleware/financial-permission.ts
// (`STAGE2_FINANCIAL_ROLES`/`FINANCIAL_VIEW_ROLES`) so it has exactly one
// source of truth; imported above rather than redefined here.

function getUserId(req: Request): string {
  return (req.user as any)?.id || (req.user as any)?.userId || "system";
}

/** Allowed cheque statuses — mirrors `chequeStatusEnum` in shared/schema.ts. */
const CHEQUE_STATUSES = ["Pending", "Cleared", "Bounced", "Cancelled"] as const;

const chequeStatusUpdateSchema = z.object({
  status: z.enum(CHEQUE_STATUSES),
});

/**
 * Every financial DELETE must carry a justification. A missing/blank reason is
 * a 400 (destructive-without-reason fails). Reason is read from the request
 * body and, for DELETE-compatibility, falls back to the query string.
 */
const deleteReasonSchema = z.object({
  reason: z
    .string({ required_error: "A reason is required to delete a financial record." })
    .trim()
    .min(3, "A reason (at least 3 characters) is required to delete a financial record."),
});

function getDeleteReason(req: Request): string {
  const candidate =
    (req.body && (req.body as any).reason) ??
    (typeof req.query.reason === "string" ? req.query.reason : undefined);
  return deleteReasonSchema.parse({ reason: candidate }).reason;
}

// ---------------------------------------------------------------------------
// Account Heads (Chart of Accounts) — Patch 4 Stage 2
// ---------------------------------------------------------------------------

const ACCOUNT_HEAD_NORMAL_BALANCES = ["Debit", "Credit"] as const;

/** Columns a PATCH may modify. System/audit fields are intentionally excluded. */
const ACCOUNT_HEAD_WRITABLE_FIELDS = [
  "code", "name", "category", "type", "description",
  "parentAccountId", "openingBalance", "normalBalance", "branch", "isActive",
];

function assertNumericIfPresent(value: unknown, field: string): void {
  if (value === undefined || value === null || value === "") return;
  if (!Number.isFinite(Number(value))) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be a number.`);
  }
}

function assertNormalBalanceIfPresent(value: unknown): void {
  if (value === undefined || value === null || value === "") return;
  if (!ACCOUNT_HEAD_NORMAL_BALANCES.includes(String(value) as any)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Normal balance must be 'Debit' or 'Credit'.");
  }
}

/** Parent must exist and (on update) cannot be the head itself. */
async function assertParentValid(parentId: unknown, selfId?: string): Promise<void> {
  if (parentId === undefined || parentId === null || parentId === "") return;
  const pid = String(parentId);
  if (selfId && pid === selfId) {
    throw new ApiError(400, "VALIDATION_ERROR", "An account head cannot be its own parent.");
  }
  const [parent] = await db
    .select({ id: accountHeads.id })
    .from(accountHeads)
    .where(eq(accountHeads.id, pid))
    .limit(1);
  if (!parent) {
    throw new ApiError(400, "VALIDATION_ERROR", "Parent account head does not exist.");
  }
}

/** Detect a Postgres unique-violation (duplicate code) through Drizzle's wrapper. */
function isUniqueViolation(error: any): boolean {
  return error?.code === "23505" || error?.cause?.code === "23505";
}

/** Build the shared WHERE conditions for account-head list + export. */
function buildAccountHeadConditions(query: Request["query"]) {
  const { category, type, status, parent, q } = query;
  const conditions: any[] = [];
  if (category) conditions.push(eq(accountHeads.category, category as any));
  if (type) conditions.push(eq(accountHeads.type, type as string));
  if (status === "active") conditions.push(eq(accountHeads.isActive, 1));
  else if (status === "inactive") conditions.push(eq(accountHeads.isActive, 0));
  if (parent) conditions.push(eq(accountHeads.parentAccountId, parent as string));
  if (q && String(q).trim()) {
    const term = `%${String(q).trim()}%`;
    conditions.push(or(ilike(accountHeads.code, term), ilike(accountHeads.name, term)));
  }
  return conditions;
}

router.get("/account-heads/next-code", requireFinancialPermission(FINANCIAL_ACTIONS.accountHeadView, { roles: STAGE2_FINANCIAL_ROLES }), async (req: Request, res: Response) => {
  try {
    const parentId = (req.query.parentId as string) || null;
    const level = parseInt((req.query.level as string) || "1", 10);
    
    let maxCodeStr = "";
    
    if (!parentId || parentId === "null") {
      const result = await db.select({ maxCode: sql<string>`MAX(code)` }).from(accountHeads).where(sql`parent_account_id IS NULL`);
      maxCodeStr = result[0]?.maxCode || "";
      let nextCode = 10000;
      if (maxCodeStr) {
         nextCode = parseInt(maxCodeStr, 10) + 5000;
      }
      return res.json({ nextCode: String(nextCode) });
    } else {
      const parentResult = await db.select({ code: accountHeads.code }).from(accountHeads).where(eq(accountHeads.id, parentId)).limit(1);
      if (!parentResult || parentResult.length === 0) {
        return sendError(res, badRequest("Invalid parentId"));
      }
      const parentCode = parseInt(parentResult[0].code, 10);
      
      const result = await db.select({ maxCode: sql<string>`MAX(code)` }).from(accountHeads).where(eq(accountHeads.parentAccountId, parentId));
      maxCodeStr = result[0]?.maxCode || "";
      
      let nextCode = 0;
      if (level === 2) {
        nextCode = maxCodeStr ? parseInt(maxCodeStr, 10) + 100 : parentCode + 100;
      } else if (level === 3) {
        nextCode = maxCodeStr ? parseInt(maxCodeStr, 10) + 1 : parentCode + 1;
      } else {
        nextCode = maxCodeStr ? parseInt(maxCodeStr, 10) + 1 : parentCode + 1;
      }
      return res.json({ nextCode: String(nextCode) });
    }
  } catch (error) {
    console.error("Error fetching next code:", error);
    sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to fetch next code" });
  }
});

// List — backward-compatible array shape (consumed by chart-of-accounts.tsx and
// office-trial-balance.tsx). Optional filters: category, type, status, parent, q.
router.get("/account-heads", requireFinancialPermission(FINANCIAL_ACTIONS.accountHeadView, { roles: STAGE2_FINANCIAL_ROLES }), async (req: Request, res: Response) => {
  try {
    const conditions = buildAccountHeadConditions(req.query);
    const results = await db
      .select()
      .from(accountHeads)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(accountHeads.code));
    res.json(results);
  } catch (error) {
    console.error("Error fetching account heads:", error);
    sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to fetch account heads" });
  }
});

// CSV export — same filters as the list, RBAC-gated and audited.
router.get(
  "/account-heads/export",
  requireFinancialPermission(FINANCIAL_ACTIONS.accountHeadExport, { roles: STAGE2_FINANCIAL_ROLES }),
  async (req: Request, res: Response) => {
    try {
      const conditions = buildAccountHeadConditions(req.query);
      const results = await db
        .select()
        .from(accountHeads)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(accountHeads.code));

      // Resolve parent ids to codes for a human-readable export.
      const all = await db
        .select({ id: accountHeads.id, code: accountHeads.code })
        .from(accountHeads);
      const codeById = new Map(all.map((h) => [h.id, h.code]));

      const count = sendCsvExport(res, {
        module: "account_heads",
        range: {},
        columns: [
          { header: "Code", value: (r) => r.code },
          { header: "Name", value: (r) => r.name },
          { header: "Category", value: (r) => r.category },
          { header: "Type", value: (r) => r.type },
          { header: "Parent", value: (r) => (r.parentAccountId ? (codeById.get(r.parentAccountId) ?? r.parentAccountId) : "") },
          { header: "Opening Balance", value: (r) => r.openingBalance },
          { header: "Normal Balance", value: (r) => r.normalBalance },
          { header: "Branch", value: (r) => r.branch },
          { header: "Status", value: (r) => (r.isActive ? "Active" : "Inactive") },
          { header: "Notes", value: (r) => r.description },
        ],
        rows: results,
      });

      await AuditLogService.record({
        actorUserId: getUserId(req),
        action: FINANCIAL_ACTIONS.accountHeadExport,
        module: AUDIT_MODULE,
        entityType: "account_heads_export",
        entityId: "csv",
        after: { rowCount: count, filters: req.query },
        req,
      });
    } catch (error) {
      console.error("Error exporting account heads:", error);
      if (!res.headersSent) {
        sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to export account heads" });
      }
    }
  },
);

router.post(
  "/account-heads",
  requireFinancialPermission(FINANCIAL_ACTIONS.accountHeadCreate, { roles: STAGE2_FINANCIAL_ROLES }),
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const data = insertAccountHeadSchema.parse(req.body);

      assertNumericIfPresent(data.openingBalance, "Opening balance");
      assertNormalBalanceIfPresent(data.normalBalance);
      await assertParentValid(data.parentAccountId);

      const [result] = await db.insert(accountHeads).values({
        ...data,
        createdByUserId: userId,
      }).returning();

      await AuditLogService.record({
        actorUserId: userId,
        action: FINANCIAL_ACTIONS.accountHeadCreate,
        module: AUDIT_MODULE,
        entityType: "account_head",
        entityId: String(result.id),
        after: { code: result.code, name: result.name, category: result.category },
        req,
      });

      res.status(201).json(result);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return sendError(res, conflict("An account head with this code already exists."));
      }
      console.error("Error creating account head:", error);
      sendError(res, error);
    }
  },
);

// Update / toggle active — parent!=self, parent exists, numeric opening balance.
router.patch(
  "/account-heads/:id",
  requireFinancialPermission(FINANCIAL_ACTIONS.accountHeadUpdate, { roles: STAGE2_FINANCIAL_ROLES }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const writable: Record<string, any> = pickWritable(req.body, ACCOUNT_HEAD_WRITABLE_FIELDS);

      if (Object.keys(writable).length === 0) {
        return sendError(res, badRequest("No updatable fields were provided."));
      }

      assertNumericIfPresent(writable.openingBalance, "Opening balance");
      assertNormalBalanceIfPresent(writable.normalBalance);
      await assertParentValid(writable.parentAccountId, id);

      // Normalize types for the driver (decimal expects string, is_active integer).
      if (writable.openingBalance !== undefined && writable.openingBalance !== null) {
        writable.openingBalance = String(writable.openingBalance);
      }
      if (writable.isActive !== undefined) {
        writable.isActive = Number(writable.isActive) ? 1 : 0;
      }

      const [existing] = await db.select().from(accountHeads).where(eq(accountHeads.id, id)).limit(1);
      if (!existing) return sendError(res, notFound("Account head not found."));

      const [updated] = await db
        .update(accountHeads)
        .set({ ...writable, updatedAt: new Date() })
        .where(eq(accountHeads.id, id))
        .returning();

      const isToggle =
        writable.isActive !== undefined &&
        Number(writable.isActive) !== Number(existing.isActive);

      if (isToggle) {
        await AuditLogService.recordTransition({
          actorUserId: userId,
          action: FINANCIAL_ACTIONS.accountHeadUpdate,
          module: AUDIT_MODULE,
          entityType: "account_head",
          entityId: String(id),
          previousStatus: existing.isActive ? "Active" : "Inactive",
          nextStatus: updated.isActive ? "Active" : "Inactive",
          before: { code: existing.code, isActive: existing.isActive },
          after: { code: updated.code, isActive: updated.isActive },
          req,
        });
      } else {
        await AuditLogService.record({
          actorUserId: userId,
          action: FINANCIAL_ACTIONS.accountHeadUpdate,
          module: AUDIT_MODULE,
          entityType: "account_head",
          entityId: String(id),
          before: { code: existing.code, name: existing.name },
          after: { code: updated.code, name: updated.name },
          req,
        });
      }

      res.json(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return sendError(res, conflict("An account head with this code already exists."));
      }
      console.error("Error updating account head:", error);
      sendError(res, error);
    }
  },
);

// Delete — refuses to destroy a head referenced by ledger/voucher rows; it is
// soft-disabled (is_active = 0) instead so the financial history stays intact.
router.delete(
  "/account-heads/:id",
  requireFinancialPermission(FINANCIAL_ACTIONS.accountHeadDelete, { roles: STAGE2_FINANCIAL_ROLES }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const reason = getDeleteReason(req);
      const userId = getUserId(req);

      const [existing] = await db.select().from(accountHeads).where(eq(accountHeads.id, id)).limit(1);
      if (!existing) return sendError(res, notFound("Account head not found."));

      const [ledgerRef] = await db
        .select({ id: ledgerEntries.id })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.accountHeadId, id))
        .limit(1);
      const [lineRef] = await db
        .select({ id: journalVoucherLines.id })
        .from(journalVoucherLines)
        .where(eq(journalVoucherLines.accountHeadId, id))
        .limit(1);
      const referenced = Boolean(ledgerRef || lineRef);

      if (referenced) {
        const [disabled] = await db
          .update(accountHeads)
          .set({ isActive: 0, updatedAt: new Date() })
          .where(eq(accountHeads.id, id))
          .returning();

        await AuditLogService.recordTransition({
          actorUserId: userId,
          action: FINANCIAL_ACTIONS.accountHeadUpdate,
          module: AUDIT_MODULE,
          entityType: "account_head",
          entityId: String(id),
          previousStatus: existing.isActive ? "Active" : "Inactive",
          nextStatus: "Inactive",
          reason,
          before: { code: existing.code, name: existing.name, isActive: existing.isActive },
          after: { code: disabled.code, isActive: disabled.isActive },
          req,
        });

        return res.json({
          success: true,
          softDisabled: true,
          message: "Account head has ledger references and was deactivated instead of deleted.",
        });
      }

      const [deleted] = await db.delete(accountHeads).where(eq(accountHeads.id, id)).returning();

      await AuditLogService.record({
        actorUserId: userId,
        action: FINANCIAL_ACTIONS.accountHeadDelete,
        module: AUDIT_MODULE,
        entityType: "account_head",
        entityId: String(id),
        reason,
        before: deleted ? { code: deleted.code, name: deleted.name } : undefined,
        req,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting account head:", error);
      sendError(res, error);
    }
  },
);

// ---------------------------------------------------------------------------
// Trial Balance (Patch 6 Stage 7) — derived report over ledger_entries +
// account_heads. Read endpoint is auth-only (mirrors /ledger); the CSV export is
// RBAC-gated + audited (mirrors /ledger/export). Formula + invariants live in
// TRIAL_BALANCE_FORMULA.md and the pure helper server/utils/trial-balance.ts.
// ---------------------------------------------------------------------------

/** Resolve & validate the optional start/end day filters (end is inclusive). */
function resolveTrialBalanceDates(query: Request["query"]): { start: Date | null; end: Date | null } {
  const startRaw = query.startDate ? String(query.startDate).trim() : "";
  const endRaw = query.endDate ? String(query.endDate).trim() : "";
  let start: Date | null = null;
  let end: Date | null = null;
  if (startRaw) {
    start = new Date(startRaw);
    if (isNaN(start.getTime())) {
      throw new ApiError(400, "VALIDATION_ERROR", "startDate is not a valid date.");
    }
  }
  if (endRaw) {
    end = new Date(endRaw);
    if (isNaN(end.getTime())) {
      throw new ApiError(400, "VALIDATION_ERROR", "endDate is not a valid date.");
    }
    // Make the end filter inclusive of the whole calendar day.
    end.setHours(23, 59, 59, 999);
  }
  if (start && end && start.getTime() > end.getTime()) {
    throw new ApiError(400, "VALIDATION_ERROR", "startDate must be on or before endDate.");
  }
  return { start, end };
}

/**
 * Load the account heads (filtered by category/branch, active only) and every
 * ledger row for those heads up to `end`. Branch is applied to the heads only —
 * the heads already scope which ledger rows are pulled, so we do not also filter
 * ledger by branch (many entries carry a null branch and would be dropped).
 */
async function loadTrialBalanceData(query: Request["query"]) {
  const { start, end } = resolveTrialBalanceDates(query);
  const accountType = query.accountType ? String(query.accountType).trim() : "";
  const branch = query.branch ? String(query.branch).trim() : "";

  const accConds: any[] = [eq(accountHeads.isActive, 1)];
  if (accountType) {
    const cats = accountType.split(",").map((s) => s.trim()).filter(Boolean);
    if (cats.length) accConds.push(inArray(accountHeads.category, cats as any));
  }
  // Office (branch) is a property of the posted entry (expense office), not of the
  // head - heads carry no branch, so filtering heads by it returned nothing.
  const branches = branch.split(",").map((b) => b.trim()).filter(Boolean);

  const accounts = await db
    .select({
      id: accountHeads.id,
      code: accountHeads.code,
      name: accountHeads.name,
      category: accountHeads.category,
      normalBalance: accountHeads.normalBalance,
      openingBalance: accountHeads.openingBalance,
    })
    .from(accountHeads)
    .where(and(...accConds))
    .orderBy(asc(accountHeads.code));

  const headIds = accounts.map((a) => a.id);
  let ledger: { accountHeadId: string | null; entryType: string; amount: string | null; currency: string | null; date: Date | null }[] = [];
  if (headIds.length) {
    const ledConds: any[] = [inArray(ledgerEntries.accountHeadId, headIds)];
    if (end) ledConds.push(lte(ledgerEntries.date, end));
    if (branches.length) ledConds.push(inArray(ledgerEntries.branch, branches));
    ledger = await db
      .select({
        accountHeadId: ledgerEntries.accountHeadId,
        entryType: ledgerEntries.entryType,
        amount: ledgerEntries.amount,
        currency: ledgerEntries.currency,
        date: ledgerEntries.date,
      })
      .from(ledgerEntries)
      .where(and(...ledConds));
  }

  return { start, end, accounts, ledger };
}

// Trial balance report (auth-only read). Totals are computed over the full
// filtered set; only the returned `rows` are paginated.
router.get("/trial-balance", requireFinancialPermission(FINANCIAL_ACTIONS.trialBalanceView, { roles: STAGE2_FINANCIAL_ROLES }), async (req: Request, res: Response) => {
  try {
    const { start, end, accounts, ledger } = await loadTrialBalanceData(req.query);
    const includeZeroBalance = String(req.query.includeZeroBalance ?? "") === "true";
    const result = computeTrialBalance(accounts, ledger, { start, end, includeZeroBalance });

    // Transactions per head within the period (old-DRM Trial Balance "Transactions" column).
    const periodCounts: Record<string, number> = {};
    for (const r of ledger) {
      if (!r.accountHeadId) continue;
      const d = r.date ? new Date(r.date) : null;
      if (start && d && d < start) continue;
      if (end && d && d > end) continue;
      periodCounts[r.accountHeadId] = (periodCounts[r.accountHeadId] ?? 0) + 1;
    }

    // Currency safety — never sum across currencies. Surface a warning instead.
    const currencies = Array.from(
      new Set(ledger.map((r) => r.currency).filter((c): c is string => !!c)),
    );

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(10000, Math.max(1, parseInt(String(req.query.limit ?? "10000"), 10) || 10000));
    const total = result.rows.length;
    const startIdx = (page - 1) * limit;
    const paged = result.rows.slice(startIdx, startIdx + limit);

    res.json({
      rows: paged,
      periodCounts,
      totals: result.totals,
      imbalance: result.imbalance,
      imbalanceAmount: result.imbalanceAmount,
      currencyWarning: currencies.length > 1,
      currencies,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      filters: {
        startDate: req.query.startDate ?? null,
        endDate: req.query.endDate ?? null,
        branch: req.query.branch ?? null,
        accountType: req.query.accountType ?? null,
        includeZeroBalance,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) return sendError(res, error);
    console.error("Error building trial balance:", error);
    sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to build trial balance" });
  }
});

// Trial balance CSV export — RBAC-gated + audited. Exports the full filtered set
// (no pagination), mirroring /ledger/export.
router.get(
  "/trial-balance/export",
  requireFinancialPermission(FINANCIAL_ACTIONS.trialBalanceExport, { roles: STAGE2_FINANCIAL_ROLES }),
  async (req: Request, res: Response) => {
    try {
      const { start, end, accounts, ledger } = await loadTrialBalanceData(req.query);
      const includeZeroBalance = String(req.query.includeZeroBalance ?? "") === "true";
      const result = computeTrialBalance(accounts, ledger, { start, end, includeZeroBalance });

      const count = sendCsvExport(res, {
        module: "trial_balance",
        range: {
          from: req.query.startDate ? String(req.query.startDate) : undefined,
          to: req.query.endDate ? String(req.query.endDate) : undefined,
        },
        columns: [
          { header: "Code", value: (r) => r.code ?? "" },
          { header: "Account", value: (r) => r.name ?? "" },
          { header: "Category", value: (r) => r.category ?? "" },
          { header: "Opening Debit", value: (r) => r.openingDebit },
          { header: "Opening Credit", value: (r) => r.openingCredit },
          { header: "Period Debit", value: (r) => r.periodDebit },
          { header: "Period Credit", value: (r) => r.periodCredit },
          { header: "Closing Debit", value: (r) => r.closingDebit },
          { header: "Closing Credit", value: (r) => r.closingCredit },
        ],
        rows: result.rows,
      });

      await AuditLogService.record({
        actorUserId: getUserId(req),
        action: FINANCIAL_ACTIONS.trialBalanceExport,
        module: AUDIT_MODULE,
        entityType: "trial_balance_export",
        entityId: "csv",
        after: { rowCount: count, imbalance: result.imbalance, filters: req.query },
        req,
      });
    } catch (error) {
      if (error instanceof ApiError && !res.headersSent) return sendError(res, error);
      console.error("Error exporting trial balance:", error);
      if (!res.headersSent) {
        sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to export trial balance" });
      }
    }
  },
);

// Office Expenses
db.execute(sql`
  CREATE TABLE IF NOT EXISTS "drm"."office_expenses" (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_head text NOT NULL,
    office text NOT NULL,
    amount numeric(12, 2) NOT NULL,
    currency text NOT NULL DEFAULT 'PKR',
    voucher_number text,
    cheque_number text,
    file_url text,
    detail text,
    expense_date timestamp NOT NULL DEFAULT now(),
    created_by_user_id varchar,
    created_at timestamp NOT NULL DEFAULT now()
  );
  ALTER TABLE "drm"."office_expenses" ADD COLUMN IF NOT EXISTS "voucher_number" text;
  ALTER TABLE "drm"."office_expenses" ADD COLUMN IF NOT EXISTS "cheque_number" text;
  ALTER TABLE "drm"."office_expenses" ADD COLUMN IF NOT EXISTS "file_url" text;
  ALTER TABLE "drm"."office_expenses" ADD COLUMN IF NOT EXISTS "detail" text;
  ALTER TABLE "drm"."office_expenses" ADD COLUMN IF NOT EXISTS "expense_date" timestamp DEFAULT now();
`).catch(() => {});

/**
 * Shared WHERE for GET /expenses and /expenses/export.
 *  - startDate / endDate: inclusive calendar days (endDate covers the whole day).
 *  - office: comma list.
 *  - headIds: comma list of chart-of-account head ids; matches the head itself and
 *    every head below it (Accounting -> Parent -> Child -> Transactional filters).
 *    An expense stores the head id (new + migrated) or, for older new-app rows, the
 *    head name / "code - name" label - all three are matched.
 *  - accountingHead: legacy raw values (kept for backward compatibility).
 */
async function buildExpenseConditions(q: Record<string, any>) {
  const { startDate, endDate, office, accountingHead, headIds, search } = q;
  const conditions: any[] = [];
  const dateOnly = (v: string) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : new Date(v).toISOString().slice(0, 10));
  if (startDate) conditions.push(sql`${officeExpenses.expenseDate} >= ${dateOnly(String(startDate))}::date`);
  if (endDate) conditions.push(sql`${officeExpenses.expenseDate} < (${dateOnly(String(endDate))}::date + 1)`);
  if (office) {
    const officeArray = String(office).split(",").filter(Boolean);
    if (officeArray.length > 0) conditions.push(inArray(officeExpenses.office, officeArray));
  }
  if (accountingHead) {
    const headArray = String(accountingHead).split(",").filter(Boolean);
    if (headArray.length > 0) conditions.push(inArray(officeExpenses.expenseHead, headArray));
  }
  if (headIds) {
    const ids = String(headIds).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 500);
    if (ids.length > 0) {
      const { rows } = await pool.query(
        `WITH RECURSIVE sub AS (
           SELECT id, code, name FROM drm.account_heads WHERE id = ANY($1::text[])
           UNION
           SELECT a.id, a.code, a.name FROM drm.account_heads a JOIN sub ON a.parent_account_id = sub.id
         )
         SELECT id, code, name FROM sub`,
        [ids],
      );
      const values = new Set<string>();
      for (const r of rows) {
        values.add(r.id);
        if (r.name) values.add(r.name);
        if (r.code && r.name) values.add(`${r.code} - ${r.name}`);
      }
      // No head under the selection -> nothing can match.
      conditions.push(values.size > 0 ? inArray(officeExpenses.expenseHead, Array.from(values)) : sql`false`);
    }
  }
  const searchText = typeof search === "string" ? search.trim() : "";
  if (searchText) {
    const pattern = `%${searchText}%`;
    conditions.push(
      or(
        ilike(officeExpenses.detail, pattern),
        ilike(officeExpenses.office, pattern),
        ilike(officeExpenses.voucherNumber, pattern),
        ilike(officeExpenses.chequeNumber, pattern),
        ilike(officeExpenses.expenseHead, pattern),
        sql`${officeExpenses.amount}::text ILIKE ${pattern}`,
        sql`EXISTS (
          SELECT 1 FROM drm.users u
           WHERE u.id = ${officeExpenses.createdByUserId}
             AND (u.full_name ILIKE ${pattern} OR u.username ILIKE ${pattern})
        )`,
        sql`EXISTS (
          SELECT 1 FROM drm.account_heads ah
           WHERE ah.id::text = ${officeExpenses.expenseHead}
             AND (
               ah.name ILIKE ${pattern}
               OR ah.code ILIKE ${pattern}
               OR (ah.code || ' - ' || ah.name) ILIKE ${pattern}
             )
        )`,
      )!,
    );
  }
  return conditions;
}

router.get("/expenses", async (req: Request, res: Response) => {
  try {
    const conditions = await buildExpenseConditions(req.query as Record<string, any>);
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // ?page=N&pageSize=50 -> one page (most recent first) + total count/amount.
    // Without ?page the full array is returned (used by the CSV / Excel export).
    const paged = req.query.page !== undefined;
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
    const page = Math.max(1, Number(req.query.page) || 1);

    let query = db.select({
      expense: officeExpenses,
      createdByName: sql<string>`COALESCE(${users.fullName}, ${users.username}, 'System')`,
      accountHeadName: accountHeads.name,
      accountHeadCode: accountHeads.code
    })
    .from(officeExpenses)
    // created_by_user_id is uuid; the old CAST(users.id AS VARCHAR) made every call 500.
    .leftJoin(users, eq(officeExpenses.createdByUserId, users.id))
    .leftJoin(accountHeads, sql`${officeExpenses.expenseHead} = ${accountHeads.id}::text`)
    .where(where)
    .orderBy(desc(officeExpenses.expenseDate), desc(officeExpenses.createdAt), desc(officeExpenses.id))
    .$dynamic();
    if (paged) query = query.limit(pageSize).offset((page - 1) * pageSize);
    const results = await query;

    // Old-DRM receipts (webxl_expense_images + webxl_expense.bill_image) for migrated
    // expenses on this page; served through /api/legacy-assets/expense-bill?f=<file>.
    const legacyReceipts = new Map<string, string[]>();
    const pageIds = results.map((r) => r.expense.id);
    if (pageIds.length > 0) {
      try {
        const { rows: receiptRows } = await pool.query(
          `SELECT m.modern_id, array_agg(DISTINCT f.file) AS files
             FROM migration_meta.migration_legacy_ids m
             JOIN (
               SELECT expense_id AS legacy_id, btrim(images) AS file FROM legacy_archive.webxl_expense_images
                WHERE NULLIF(btrim(images), '') IS NOT NULL
               UNION ALL
               SELECT id, btrim(bill_image) FROM legacy_archive.webxl_expense
                WHERE NULLIF(btrim(bill_image), '') IS NOT NULL
             ) f ON f.legacy_id = m.legacy_id
            WHERE m.entity_type = 'expense_row' AND m.legacy_table = 'webxl_expense'
              AND m.modern_id = ANY($1::text[])
            GROUP BY m.modern_id`,
          [pageIds],
        );
        for (const r of receiptRows) legacyReceipts.set(r.modern_id, (r.files as string[]).sort());
      } catch {
        /* archive not present in this database */
      }
    }

    const mapped = results.map(row => {
      let headName = row.expense.expenseHead;
      if (row.accountHeadName) {
        headName = row.accountHeadCode ? `${row.accountHeadCode} - ${row.accountHeadName}` : row.accountHeadName;
      }
      return {
        ...row.expense,
        expenseHead: headName,
        // raw stored value (account head id for chart-of-account heads) - used by Edit
        expenseHeadId: row.expense.expenseHead,
        createdByName: row.createdByName,
        legacyReceipts: legacyReceipts.get(row.expense.id) ?? [],
      };
    });

    if (!paged) return res.json(mapped);
    const [agg] = await db
      .select({
        total: sql<number>`count(*)::int`,
        totalAmount: sql<string>`coalesce(sum(${officeExpenses.amount}), 0)::text`,
      })
      .from(officeExpenses)
      .where(where);
    res.json({ data: mapped, total: agg?.total ?? 0, totalAmount: agg?.totalAmount ?? "0", page, pageSize });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to fetch expenses" });
  }
});

// CSV export — same filters as GET /expenses, RBAC-gated and audited.
router.get(
  "/expenses/export",
  requireFinancialPermission(FINANCIAL_ACTIONS.expenseExport),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, office, accountingHead } = req.query;
      const conditions = await buildExpenseConditions(req.query as Record<string, any>);

      const results = await db.select({
        expense: officeExpenses,
        accountHeadName: accountHeads.name,
        accountHeadCode: accountHeads.code
      }).from(officeExpenses)
        .leftJoin(accountHeads, sql`${officeExpenses.expenseHead} = ${accountHeads.id}::text`)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(officeExpenses.expenseDate), desc(officeExpenses.createdAt));

      const rows = results.map(r => {
        let headName = r.expense.expenseHead;
        if (r.accountHeadName) {
          headName = r.accountHeadCode ? `${r.accountHeadCode} - ${r.accountHeadName}` : r.accountHeadName;
        }
        return {
          ...r.expense,
          expenseHead: headName
        };
      });

      const count = sendCsvExport(res, {
        module: "office_expenses",
        range: { from: startDate as string | undefined, to: endDate as string | undefined },
        columns: [
          { header: "Expense Head", value: (r) => r.expenseHead },
          { header: "Office", value: (r) => r.office },
          { header: "Amount", value: (r) => r.amount },
          { header: "Currency", value: (r) => r.currency },
          { header: "Voucher Number", value: (r) => r.voucherNumber },
          { header: "Cheque Number", value: (r) => r.chequeNumber },
          { header: "Detail", value: (r) => r.detail },
          { header: "Expense Date", value: (r) => r.expenseDate },
        ],
        rows,
      });

      await AuditLogService.record({
        actorUserId: getUserId(req),
        action: FINANCIAL_ACTIONS.expenseExport,
        module: AUDIT_MODULE,
        entityType: "office_expenses_export",
        entityId: "csv",
        after: {
          rowCount: count,
          filters: {
            startDate: startDate ?? null,
            endDate: endDate ?? null,
            office: office ?? null,
            accountingHead: accountingHead ?? null,
          },
        },
        req,
      });
    } catch (error) {
      console.error("Error exporting expenses:", error);
      if (!res.headersSent) {
        sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to export expenses" });
      }
    }
  },
);

router.post(
  "/expenses",
  requireFinancialPermission(FINANCIAL_ACTIONS.expenseCreate),
  async (req: Request, res: Response) => {
    try {
      const rawUser = req.user as any;
      let userId = rawUser?.id || rawUser?.userId;
      if (!userId || userId === "system") {
        try {
          const [u] = await db.select({ id: users.id }).from(users).limit(1);
          if (u) userId = u.id;
        } catch {}
      }

      const body = req.body || {};
      const expenseHead = String(body.expenseHead || "").trim();
      const office = String(body.office || "").trim();
      const amount = String(body.amount || "0").trim();
      const currency = String(body.currency || "PKR").trim();
      const voucherNumber = body.voucherNumber ? String(body.voucherNumber).trim() : null;
      const chequeNumber = body.chequeNumber ? String(body.chequeNumber).trim() : null;
      const fileUrl = body.fileUrl ? String(body.fileUrl) : null;
      const detail = body.detail ? String(body.detail).trim() : null;
      
      let expenseDate = new Date();
      if (body.expenseDate) {
        const parsed = new Date(body.expenseDate);
        if (!isNaN(parsed.getTime())) expenseDate = parsed;
      }

      if (!expenseHead || !office || !amount) {
        return res.status(400).json({ error: { message: "Please fill required fields (expenseHead, office, amount)" } });
      }

      assertPositiveAmount(amount, "amount");

      let parsedExpenseHead = expenseHead;
      if (expenseHead && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expenseHead)) {
        const headMatch = await db.select().from(accountHeads).where(
          or(
            eq(accountHeads.name, expenseHead),
            sql`${accountHeads.code} || ' - ' || ${accountHeads.name} = ${expenseHead}`
          )
        ).limit(1);
        if (headMatch.length > 0) {
          parsedExpenseHead = headMatch[0].id;
        }
      }

      const [result] = await db.insert(officeExpenses).values({
        expenseHead: parsedExpenseHead,
        office,
        amount,
        currency,
        voucherNumber,
        chequeNumber,
        fileUrl,
        detail,
        expenseDate: expenseDate.toISOString().split('T')[0],
        createdByUserId: userId || undefined,
      }).returning();

      try {
        await AuditLogService.record({
          actorUserId: userId || "system",
          action: FINANCIAL_ACTIONS.expenseCreate,
          module: AUDIT_MODULE,
          entityType: "office_expense",
          entityId: String(result.id),
          after: { amount: result.amount, currency: result.currency, expenseHead: result.expenseHead, office: result.office },
          req,
        });
      } catch (auditErr) {
        console.warn("Audit log record skipped:", auditErr);
      }

      try {
        await db.insert(ledgerEntries).values({
          accountHeadId: parsedExpenseHead,
          entryType: "Debit",
          amount: amount,
          currency: currency,
          date: expenseDate,
          entryDate: expenseDate.toISOString().split("T")[0],
          description: detail || `Office Expense - ${office}`,
          category: "Expenses",
          referenceId: result.id,
          referenceType: "office_expense",
          branch: office,
          createdByUserId: userId,
        });
      } catch (err) {
        console.error("Failed to insert ledger entry for expense:", err);
      }

      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating expense:", error);
      sendError(res, error);
    }
  },
);

/** Columns an expense PATCH may modify. System/audit fields are excluded. */
const EXPENSE_WRITABLE_FIELDS = [
  "expenseHead", "office", "amount", "currency",
  "voucherNumber", "chequeNumber", "fileUrl", "detail", "expenseDate",
];

// Edit an expense — RBAC-gated, mass-assignment guarded, validated, audited
// with before/after. There is no `status` column, so this is a real edit (not a
// void); destructive removal stays on DELETE (which requires a reason).
router.patch(
  "/expenses/:id",
  requireFinancialPermission(FINANCIAL_ACTIONS.expenseUpdate, { roles: STAGE2_FINANCIAL_ROLES }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = pickWritable(req.body ?? {}, EXPENSE_WRITABLE_FIELDS);
      if (Object.keys(updates).length === 0) {
        throw new ApiError(400, "VALIDATION_ERROR", "No editable fields were provided.");
      }
      if (updates.amount !== undefined) assertPositiveAmount(updates.amount, "amount");
      let ledgerExpenseDate: Date | undefined;
      if (updates.expenseDate !== undefined) {
        ledgerExpenseDate = assertValidDate(updates.expenseDate, "expenseDate");
        updates.expenseDate = ledgerExpenseDate.toISOString().split('T')[0];
      }

      const [before] = await db.select().from(officeExpenses).where(eq(officeExpenses.id, id)).limit(1);
      if (!before) {
        throw new ApiError(404, "NOT_FOUND", "Expense not found.");
      }

      if (updates.expenseHead && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updates.expenseHead as string)) {
        const headMatch = await db.select().from(accountHeads).where(
          or(
            eq(accountHeads.name, updates.expenseHead as string),
            sql`${accountHeads.code} || ' - ' || ${accountHeads.name} = ${updates.expenseHead}`
          )
        ).limit(1);
        if (headMatch.length > 0) {
          updates.expenseHead = headMatch[0].id;
        }
      }

      const [updated] = await db
        .update(officeExpenses)
        .set(updates)
        .where(eq(officeExpenses.id, id))
        .returning();

      await AuditLogService.record({
        actorUserId: getUserId(req),
        action: FINANCIAL_ACTIONS.expenseUpdate,
        module: AUDIT_MODULE,
        entityType: "office_expense",
        entityId: String(id),
        before: { amount: before.amount, currency: before.currency, expenseHead: before.expenseHead, office: before.office, expenseDate: before.expenseDate, detail: before.detail },
        after: { amount: updated.amount, currency: updated.currency, expenseHead: updated.expenseHead, office: updated.office, expenseDate: updated.expenseDate, detail: updated.detail },
        req,
      });

      try {
        await db.update(ledgerEntries)
          .set({
            amount: updated.amount,
            currency: updated.currency,
            date: updated.expenseDate ? new Date(updated.expenseDate) : undefined,
            entryDate: updated.expenseDate ? new Date(updated.expenseDate).toISOString().split("T")[0] : undefined,
            description: updated.detail || `Office Expense - ${updated.office}`,
            accountHeadId: updated.expenseHead,
            branch: updated.office
          })
          .where(and(eq(ledgerEntries.referenceId, id), eq(ledgerEntries.referenceType, "office_expense")));
      } catch (err) {
        console.error("Failed to update ledger entry for expense:", err);
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating expense:", error);
      sendError(res, error);
    }
  },
);

router.delete(
  "/expenses/:id",
  requireFinancialPermission(FINANCIAL_ACTIONS.expenseDelete),
  async (req: Request, res: Response) => {
    try {
      // Office Expense delete: admin, super HOD and HOD only (product rule, Nov 2026).
      const role = normalizeRole(String((req.user as any)?.activeRoleId || (req.user as any)?.roleId || (req.user as any)?.role || ""));
      if (!EXPENSE_DELETE_ROLES.includes(role)) {
        return sendApiError(res, { status: 403, code: "FORBIDDEN", message: "Only admin, super HOD or HOD can delete expenses" });
      }
      const { id } = req.params;
      const reason = getDeleteReason(req);
      const [deleted] = await db.delete(officeExpenses).where(eq(officeExpenses.id, id)).returning();

      await AuditLogService.record({
        actorUserId: getUserId(req),
        action: FINANCIAL_ACTIONS.expenseDelete,
        module: AUDIT_MODULE,
        entityType: "office_expense",
        entityId: String(id),
        reason,
        before: deleted ? { amount: deleted.amount, currency: deleted.currency, expenseHead: deleted.expenseHead } : undefined,
        req,
      });

      try {
        await db.delete(ledgerEntries)
          .where(and(eq(ledgerEntries.referenceId, id), eq(ledgerEntries.referenceType, "office_expense")));
      } catch (err) {
        console.error("Failed to delete ledger entry for expense:", err);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting expense:", error);
      sendError(res, error);
    }
  },
);

// Office VAS
router.get("/vas", async (req: Request, res: Response) => {
  try {
    // Office VAS = money received against invoices (old DRM drm/office-vas).
    //  - Old-DRM invoices: one row per payment event from webxl_invoice_item_pay
    //    (drm.legacy_invoice_item_payments): the item payments of one invoice made in
    //    the same minute, amount = sum actually paid (partial payments show what was
    //    received, e.g. 600 of an 800 invoice), method Bank Transfar / cash / Free.
    //    (The old page collapsed the range to one row per company; every payment is
    //    listed here instead.)
    //  - New-app paid invoices without item payments: invoice total / payment_method / paid_at.
    // Explicit columns only - db.select().from(invoices) asked for invoices.quotation_id,
    // which this database does not have (every call returned 500).
    // ?startDate&endDate (inclusive days) &search &page&pageSize(50) -> { data, total, totalAmount }
    const { startDate, endDate, search } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
    const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
    const params: unknown[] = [day(startDate), day(endDate), search ? `%${String(search)}%` : null];

    const base = `
      WITH legacy_pay AS (
        SELECT p.invoice_id,
               date_trunc('minute', p.paid_at) AS pay_minute,
               max(p.paid_at) AS paid_at,
               round(sum(COALESCE(p.amount, 0))) AS amount, -- item splits were floats (11999.99 -> 12000)
               string_agg(DISTINCT NULLIF(btrim(p.method), ''), ', ') AS method
          FROM drm.legacy_invoice_item_payments p
         WHERE p.invoice_id IS NOT NULL AND p.paid_at IS NOT NULL
         GROUP BY p.invoice_id, date_trunc('minute', p.paid_at)
      ),
      rows AS (
        SELECT 'pay:' || lp.invoice_id::text || ':' || extract(epoch FROM lp.pay_minute)::bigint AS id,
               i.customer_name AS company, lp.amount, lp.method, lp.paid_at::timestamp AS paid_at, i.id::text AS invoice_id
          FROM legacy_pay lp JOIN drm.invoices i ON i.id = lp.invoice_id::text
        UNION ALL
        SELECT 'inv:' || i.id::text, i.customer_name, i.total, NULLIF(btrim(i.payment_method), ''),
               COALESCE(i.paid_at, i.issue_date), i.id::text
          FROM drm.invoices i
         WHERE i.status = 'Paid'
           AND NOT EXISTS (SELECT 1 FROM drm.legacy_invoice_item_payments p WHERE p.invoice_id::text = i.id)
      )
      SELECT rows.*, to_char(paid_at, 'YYYY-MM-DD HH24:MI:SS') AS paid_at_text FROM rows
       WHERE COALESCE(company, '') NOT ILIKE '%alibaba%'
         AND ($1::date IS NULL OR paid_at >= $1::date)
         AND ($2::date IS NULL OR paid_at < $2::date + 1)
         AND ($3::text IS NULL OR company ILIKE $3)`;

    // Old DRM "Department Wise Summary" (func.php total_vas_view): each invoice gets ONE
    // department = MIN(dep_id) of webxl_quotation_services whose name equals an invoice
    // item; amounts of the listed rows are summed per department ('Unknown' if none).
    // Old invoices: webxl_invoice_item. New-app invoices: item productId -> catalog
    // service project/route department (stored as a department code), else item name.
    const deptSql = `
      WITH r AS (${base}),
      legacy_dep AS (
        SELECT m.modern_id AS invoice_id, MIN(NULLIF(btrim(qs.dep_id), '')::int) AS dep_id
          FROM migration_meta.migration_legacy_ids m
          JOIN legacy_archive.webxl_invoice_item ii ON ii.invoice_id = m.legacy_id
          JOIN legacy_archive.webxl_quotation_services qs ON btrim(qs.name) = btrim(ii.item)
         WHERE m.modern_table = 'invoices' AND m.legacy_table = 'webxl_invoice'
           AND m.modern_id IN (SELECT invoice_id FROM r)
           AND NULLIF(btrim(qs.dep_id), '') ~ '^[0-9]+$'
         GROUP BY m.modern_id
      ),
      modern_items AS (
        SELECT i.id::text AS invoice_id, it->>'productId' AS product_id, NULLIF(btrim(COALESCE(it->>'detail', it->>'name')), '') AS item_name
          FROM drm.invoices i
          CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN i.items ~ '^\\s*\\[' THEN i.items::jsonb ELSE '[]'::jsonb END) it
         WHERE i.id::text IN (SELECT invoice_id FROM r)
           AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m WHERE m.modern_table = 'invoices' AND m.modern_id = i.id::text)
      ),
      modern_dep AS (
        SELECT mi.invoice_id,
               MIN(COALESCE(
                 (SELECT d.name FROM drm.departments d
                   WHERE d.code = COALESCE(ss.project_department, ss.route_departments[1], sv.project_department, sv.route_departments[1])),
                 (SELECT ld.name FROM legacy_archive.webxl_department ld
                   WHERE ld._legacy_pk = (SELECT MIN(NULLIF(btrim(qs.dep_id), '')::int)::text FROM legacy_archive.webxl_quotation_services qs
                                           WHERE btrim(qs.name) = mi.item_name AND NULLIF(btrim(qs.dep_id), '') ~ '^[0-9]+$'))
               )) AS dep_name
          FROM modern_items mi
          LEFT JOIN drm.service_subservices ss ON ss.id::text = mi.product_id
          LEFT JOIN drm.services sv ON sv.id::text = mi.product_id
         GROUP BY mi.invoice_id
      )
      SELECT COALESCE(NULLIF(btrim(regexp_replace(COALESCE(ld.name, md.dep_name), '\\s+', ' ', 'g')), ''), 'Unknown') AS department, COALESCE(sum(r.amount), 0)::float8 AS amount
        FROM r
        LEFT JOIN legacy_dep l ON l.invoice_id = r.invoice_id
        LEFT JOIN legacy_archive.webxl_department ld ON ld._source_table = 'webxl_department' AND ld._legacy_pk = l.dep_id::text
        LEFT JOIN modern_dep md ON md.invoice_id = r.invoice_id
       GROUP BY 1
       ORDER BY 2 DESC`;

    const [{ rows }, { rows: aggRows }, { rows: deptRows }] = await Promise.all([
      pool.query(
        `${base} ORDER BY paid_at DESC NULLS LAST, id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        params,
      ),
      pool.query(`SELECT count(*)::int AS total, COALESCE(sum(amount), 0)::text AS total_amount FROM (${base}) x`, params),
      pool.query(deptSql, params),
    ]);

    res.json({
      data: rows.map((r: any) => ({
        id: r.id,
        companyName: r.company,
        amount: r.amount != null ? String(r.amount) : "0",
        currency: "PKR",
        method: r.method || "",
        // naive local time, formatted like the old page (YYYY-MM-DD HH:mm:ss)
        vasDate: r.paid_at_text || null,
      })),
      total: aggRows[0]?.total ?? 0,
      totalAmount: aggRows[0]?.total_amount ?? "0",
      departmentSummary: deptRows.map((d: any) => ({ department: d.department, amount: Number(d.amount) || 0 })),
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Error fetching VAS entries:", error);
    sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to fetch VAS entries" });
  }
});

router.post(
  "/vas",
  requireFinancialPermission(FINANCIAL_ACTIONS.vasCreate),
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const data = insertOfficeVasSchema.parse(req.body);

      const [result] = await db.insert(officeVas).values({
        ...data,
        createdByUserId: userId,
      }).returning();

      await AuditLogService.record({
        actorUserId: userId,
        action: FINANCIAL_ACTIONS.vasCreate,
        module: AUDIT_MODULE,
        entityType: "office_vas",
        entityId: String(result.id),
        after: { amount: result.amount, currency: result.currency, companyName: result.companyName },
        req,
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating VAS entry:", error);
      sendError(res, error);
    }
  },
);

router.delete(
  "/vas/:id",
  requireFinancialPermission(FINANCIAL_ACTIONS.vasDelete),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const reason = getDeleteReason(req);
      const [deleted] = await db.delete(officeVas).where(eq(officeVas.id, id)).returning();

      await AuditLogService.record({
        actorUserId: getUserId(req),
        action: FINANCIAL_ACTIONS.vasDelete,
        module: AUDIT_MODULE,
        entityType: "office_vas",
        entityId: String(id),
        reason,
        before: deleted ? { amount: deleted.amount, currency: deleted.currency, companyName: deleted.companyName } : undefined,
        req,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting VAS entry:", error);
      sendError(res, error);
    }
  },
);

// Cheques
db.execute(sql`ALTER TABLE "drm"."cheques" ADD COLUMN IF NOT EXISTS "cheque_type" text;`).catch(() => {});

router.get("/cheques", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status, search, type } = req.query;
    let conditions = [];
    
    if (startDate) {
      conditions.push(gte(cheques.chequeDate, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(cheques.chequeDate, new Date(endDate as string)));
    }
    if (status) {
      conditions.push(eq(cheques.status, status as any));
    }
    if (search) {
      conditions.push(or(
        ilike(cheques.companyName, `%${search}%`),
        ilike(cheques.chequeNumber, `%${search}%`),
        ilike(cheques.bankName, `%${search}%`)
      ));
    }
    
    const results = await db.select().from(cheques)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(cheques.chequeDate));
      
    // Fetch all expenses to calculate used amounts for cheques
    let usedMap: Record<string, number> = {};
    try {
      const allExpenses = await db.select({
        chequeNumber: officeExpenses.chequeNumber,
        amount: officeExpenses.amount
      }).from(officeExpenses);
      
      usedMap = allExpenses.reduce((acc, exp) => {
          if (exp.chequeNumber) {
              acc[exp.chequeNumber] = (acc[exp.chequeNumber] || 0) + parseFloat(exp.amount as string || "0");
          }
          return acc;
      }, {} as Record<string, number>);
    } catch (e) {
      console.warn("Could not query office_expenses for used cheques. Schema may be outdated.");
    }
    
    const enrichedResults = results.map(c => {
        const used = usedMap[c.chequeNumber] || usedMap[c.id] || 0;
        const total = parseFloat(c.amount as string || "0");
        const remaining = Math.max(0, total - used);
        
        return {
            ...c,
            usedAmount: used,
            remainingAmount: remaining.toFixed(2)
        };
    });
    
    res.json(enrichedResults);
  } catch (error) {
    console.error("Error fetching cheques:", error);
    sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to fetch cheques" });
  }
});

router.post(
  "/cheques",
  requireFinancialPermission(FINANCIAL_ACTIONS.chequeCreate),
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const data = insertChequeSchema.parse(req.body);

      const [result] = await db.insert(cheques).values({
        ...data,
        createdByUserId: userId,
      }).returning();

      await AuditLogService.record({
        actorUserId: userId,
        action: FINANCIAL_ACTIONS.chequeCreate,
        module: AUDIT_MODULE,
        entityType: "cheque",
        entityId: String(result.id),
        after: { chequeNumber: result.chequeNumber, amount: result.amount, currency: result.currency, status: result.status },
        req,
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating cheque:", error);
      sendError(res, error);
    }
  },
);

router.patch(
  "/cheques/:id/status",
  requireFinancialPermission(FINANCIAL_ACTIONS.chequeStatusUpdate),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      // Whitelist + validate: only `status`, and only an allowed enum value.
      const { status } = chequeStatusUpdateSchema.parse(pickWritable(req.body ?? {}, ["status"]));

      const [existing] = await db.select().from(cheques).where(eq(cheques.id, id));
      if (!existing) {
        return sendApiError(res, { status: 404, code: "NOT_FOUND", message: "Cheque not found" });
      }

      const [result] = await db.update(cheques)
        .set({ status, updatedAt: new Date() })
        .where(eq(cheques.id, id))
        .returning();

      await AuditLogService.recordTransition({
        actorUserId: getUserId(req),
        action: FINANCIAL_ACTIONS.chequeStatusUpdate,
        module: AUDIT_MODULE,
        entityType: "cheque",
        entityId: String(id),
        previousStatus: existing.status as string,
        nextStatus: status,
        req,
      });

      res.json(result);
    } catch (error) {
      console.error("Error updating cheque status:", error);
      sendError(res, error);
    }
  },
);

router.delete(
  "/cheques/:id",
  requireFinancialPermission(FINANCIAL_ACTIONS.chequeDelete),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const reason = getDeleteReason(req);
      const [deleted] = await db.delete(cheques).where(eq(cheques.id, id)).returning();

      await AuditLogService.record({
        actorUserId: getUserId(req),
        action: FINANCIAL_ACTIONS.chequeDelete,
        module: AUDIT_MODULE,
        entityType: "cheque",
        entityId: String(id),
        reason,
        before: deleted ? { chequeNumber: deleted.chequeNumber, amount: deleted.amount, status: deleted.status } : undefined,
        req,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting cheque:", error);
      sendError(res, error);
    }
  },
);

// Business Customers
router.get("/business-customers", async (req: Request, res: Response) => {
  try {
    // Business Customer = companies whose invoices were paid in installments (old DRM).
    // Per invoice: payments come from webxl_invoice_item_pay (drm.legacy_invoice_item_payments);
    // payments of one invoice in the same minute are one installment. An invoice counts
    // when it has 2+ installments or is part-paid (paid < total). Per company:
    //   Amount Paid = sum received, Amount Due = sum(invoice total - paid, never < 0).
    // Filters: companyName, phone, cnic (CNIC or NTN), date (invoice date, YYYY-MM-DD).
    // (Replaces db.select().from(invoices), which asked for the missing quotation_id
    //  column and made every call 500.)
    const q = req.query as Record<string, any>;
    const like = (v: unknown) => (typeof v === "string" && v.trim() ? `%${v.trim()}%` : null);
    const day = typeof q.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? q.date : null;
    const { rows } = await pool.query(
      `WITH pay AS (
         SELECT p.invoice_id::text AS invoice_id,
                sum(COALESCE(p.amount, 0)) AS paid,
                count(DISTINCT date_trunc('minute', p.paid_at)) AS installments,
                max(p.paid_at) AS last_paid_at
           FROM drm.legacy_invoice_item_payments p
          WHERE p.invoice_id IS NOT NULL
          GROUP BY 1
       ),
       inv AS (
         SELECT i.id, i.customer_id, i.customer_name, i.issue_date,
                COALESCE(i.total, 0) AS total, pay.paid, pay.installments, pay.last_paid_at
           FROM drm.invoices i
           JOIN pay ON pay.invoice_id = i.id
          WHERE (pay.installments > 1 OR (pay.paid > 0 AND pay.paid < COALESCE(i.total, 0) - 1))
            AND ($4::date IS NULL OR i.issue_date::date = $4::date)
       )
       SELECT COALESCE(c.id::text, 'name:' || lower(btrim(inv.customer_name))) AS id,
              COALESCE(c.company_name, inv.customer_name) AS company_name,
              c.phone, c.cnic, c.ntn, c.drm_id,
              count(*)::int AS invoices,
              sum(inv.installments)::int AS installments,
              round(sum(inv.paid), 2)::text AS total_paid,
              round(sum(GREATEST(inv.total - inv.paid, 0)), 2)::text AS total_due,
              max(inv.last_paid_at) AS last_paid_at
         FROM inv
         LEFT JOIN drm.customers c ON c.id = inv.customer_id
        WHERE ($1::text IS NULL OR COALESCE(c.company_name, inv.customer_name) ILIKE $1)
          AND ($2::text IS NULL OR c.phone ILIKE $2)
          AND ($3::text IS NULL OR c.cnic ILIKE $3 OR c.ntn ILIKE $3)
        GROUP BY 1, 2, 3, 4, 5, 6
        ORDER BY max(inv.last_paid_at) DESC NULLS LAST`,
      [like(q.companyName ?? q.search), like(q.phone), like(q.cnic), day],
    );
    const liveResults = rows.map((r: any) => ({
      id: r.id,
      companyName: r.company_name,
      phone: r.phone,
      cnic: r.cnic,
      ntn: r.ntn,
      drmId: r.drm_id,
      invoices: r.invoices,
      installments: r.installments,
      totalPaid: r.total_paid,
      totalDue: r.total_due,
      lastPaidAt: r.last_paid_at,
    }));

    res.json(liveResults);
  } catch (error) {
    console.error("Error fetching business customers:", error);
    sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to fetch business customers" });
  }
});

router.post(
  "/business-customers",
  requireFinancialPermission(FINANCIAL_ACTIONS.businessCustomerCreate),
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const data = insertBusinessCustomerSchema.parse(req.body);

      const [result] = await db.insert(businessCustomers).values({
        ...data,
        createdByUserId: userId,
      }).returning();

      await AuditLogService.record({
        actorUserId: userId,
        action: FINANCIAL_ACTIONS.businessCustomerCreate,
        module: AUDIT_MODULE,
        entityType: "business_customer",
        entityId: String(result.id),
        after: { companyName: result.companyName },
        req,
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating business customer:", error);
      sendError(res, error);
    }
  },
);

router.delete(
  "/business-customers/:id",
  requireFinancialPermission(FINANCIAL_ACTIONS.businessCustomerDelete),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const reason = getDeleteReason(req);
      const [deleted] = await db.delete(businessCustomers).where(eq(businessCustomers.id, id)).returning();

      await AuditLogService.record({
        actorUserId: getUserId(req),
        action: FINANCIAL_ACTIONS.businessCustomerDelete,
        module: AUDIT_MODULE,
        entityType: "business_customer",
        entityId: String(id),
        reason,
        before: deleted ? { companyName: deleted.companyName } : undefined,
        req,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting business customer:", error);
      sendError(res, error);
    }
  },
);

// ===========================================================================
// Journal Vouchers + Office General Ledger — Patch 4 Stage 2
//
// Canonical Office Accounts double-entry surface. Posting is balanced and
// atomic; posted ledger rows are immutable (correct via reversal, never edit).
// Leaves the legacy Company Ledger (/api/account/ledger, /api/reports/ledger)
// untouched.
// ===========================================================================

/** Currency for Office Accounts postings (the Office module works in PKR). */
const OFFICE_LEDGER_CURRENCY = "PKR";

/** Drizzle transaction handle type (no public export, derive it locally). */
type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type PostingLine = {
  accountHeadId: string;
  debit: number;
  credit: number;
  narration?: string | null;
  voucherLineId?: string | null;
};

function toCents(value: number): number {
  return Math.round(value * 100);
}

function generateVoucherNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `JV-${ymd}-${rand}`;
}

/**
 * The single double-entry posting engine, shared by voucher-post and the manual
 * journal endpoint so there is exactly one balance/validation/insert path.
 *
 * Invariants enforced (all or nothing):
 *  - at least two lines;
 *  - every line is EITHER a debit OR a credit, strictly greater than zero;
 *  - no negative amounts;
 *  - sum(debits) === sum(credits), compared in integer cents;
 *  - every referenced account head exists and is active.
 *
 * Returns the inserted ledger rows. Must run inside withFinancialTransaction.
 */
async function postBalancedLedger(
  tx: DrizzleTx,
  params: {
    lines: PostingLine[];
    voucherId?: string | null;
    referenceId?: string | null;
    referenceType: string;
    branch?: string | null;
    remarks: string;
    userId: string;
    date: Date;
    category: string;
  },
) {
  const { lines, voucherId, referenceId, referenceType, branch, remarks, userId, date, category } = params;

  if (!lines || lines.length < 2) {
    throw new ApiError(400, "VALIDATION_ERROR", "A journal entry needs at least two lines.");
  }

  let totalDebitCents = 0;
  let totalCreditCents = 0;
  for (const line of lines) {
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Line amounts must be numbers.");
    }
    if (debit < 0 || credit < 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "Line amounts cannot be negative.");
    }
    const debitCents = toCents(debit);
    const creditCents = toCents(credit);
    if ((debitCents > 0) === (creditCents > 0)) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Each line must be either a debit or a credit (exactly one, greater than zero).",
      );
    }
    totalDebitCents += debitCents;
    totalCreditCents += creditCents;
  }

  if (totalDebitCents !== totalCreditCents) {
    throw new ApiError(400, "VALIDATION_ERROR", "Debits and credits must balance.");
  }

  // All account heads must exist and be active.
  const headIds = Array.from(new Set(lines.map((l) => l.accountHeadId)));
  const heads = await tx
    .select({ id: accountHeads.id, isActive: accountHeads.isActive, code: accountHeads.code })
    .from(accountHeads)
    .where(inArray(accountHeads.id, headIds));
  const headById = new Map(heads.map((h) => [h.id, h]));
  for (const id of headIds) {
    const head = headById.get(id);
    if (!head) {
      throw new ApiError(400, "VALIDATION_ERROR", `Account head ${id} does not exist.`);
    }
    if (head.isActive !== 1) {
      throw new ApiError(400, "VALIDATION_ERROR", `Account head ${head.code} is inactive.`);
    }
  }

  const now = new Date();
  const rows = lines.map((line) => {
    const isDebit = toCents(Number(line.debit) || 0) > 0;
    const amountNum = isDebit ? Number(line.debit) : Number(line.credit);
    return {
      entryType: (isDebit ? "Debit" : "Credit") as "Debit" | "Credit",
      amount: amountNum.toFixed(2),
      currency: OFFICE_LEDGER_CURRENCY,
      description: line.narration?.trim() || remarks,
      category,
      date,
      referenceId: referenceId ?? null,
      referenceType,
      entryDate: date.toISOString().split("T")[0],
      createdByUserId: userId,
      accountHeadId: line.accountHeadId,
      status: "Posted",
      voucherId: voucherId ?? null,
      voucherLineId: line.voucherLineId ?? null,
      branch: branch ?? null,
      remarks: line.narration?.trim() || remarks,
      postedAt: now,
      postedByUserId: userId,
    };
  });

  return tx.insert(ledgerEntries).values(rows).returning();
}

/**
 * Reverse a balanced set of posted ledger rows by inserting mirror rows
 * (debit<->credit) that reference the originals, then marking the originals
 * Reversed. Because the originals balance, the mirror set also balances.
 */
async function reverseLedgerEntries(
  tx: DrizzleTx,
  originals: Array<typeof ledgerEntries.$inferSelect>,
  params: { userId: string; reason: string },
) {
  const now = new Date();
  const mirrors = originals.map((o) => ({
    entryType: (o.entryType === "Debit" ? "Credit" : "Debit") as "Debit" | "Credit",
    amount: o.amount,
    currency: o.currency,
    description: `Reversal: ${o.description}`,
    category: o.category,
    date: now,
    referenceId: o.referenceId,
    referenceType: o.referenceType ? `${o.referenceType}_reversal` : "reversal",
    entryDate: now.toISOString().split("T")[0],
    createdByUserId: params.userId,
    accountHeadId: o.accountHeadId,
    status: "Reversal",
    voucherId: o.voucherId,
    voucherLineId: o.voucherLineId,
    reversalOfId: o.id,
    branch: o.branch,
    remarks: params.reason,
    postedAt: now,
    postedByUserId: params.userId,
  }));

  const inserted = await tx.insert(ledgerEntries).values(mirrors).returning();
  await tx
    .update(ledgerEntries)
    .set({ status: "Reversed", updatedAt: now })
    .where(inArray(ledgerEntries.id, originals.map((o) => o.id)));
  return inserted;
}

const jvLineInputSchema = z.object({
  accountHeadId: z.string().min(1, "Account head is required."),
  debit: z.coerce.number().nonnegative().optional().default(0),
  credit: z.coerce.number().nonnegative().optional().default(0),
  narration: z.string().optional().nullable(),
  lineNo: z.coerce.number().int().optional(),
});

const jvCreateSchema = z.object({
  voucherNo: z.string().trim().min(1).optional(),
  voucherDate: z.coerce.date().optional(),
  remarks: z.string().trim().min(1, "Remarks are required."),
  branch: z.string().trim().optional().nullable(),
  lines: z.array(jvLineInputSchema).optional().default([]),
});

const reasonSchema = z.object({ reason: z.string().trim().min(1, "A reason is required.") });

const manualJournalSchema = z.object({
  date: z.coerce.date().optional(),
  branch: z.string().trim().optional().nullable(),
  remarks: z.string().trim().min(1, "Remarks are required."),
  lines: z.array(jvLineInputSchema).min(2, "At least two lines are required."),
});

// --- Journal Vouchers -------------------------------------------------------

// List vouchers (filters: status, branch, q on voucher_no, date range).
router.get("/journal-vouchers", requireFinancialPermission(FINANCIAL_ACTIONS.journalVoucherView, { roles: STAGE2_FINANCIAL_ROLES }), async (req: Request, res: Response) => {
  try {
    const { status, branch, q, startDate, endDate } = req.query;
    const conditions: any[] = [];
    if (status) conditions.push(eq(journalVouchers.status, status as string));
    if (branch) conditions.push(eq(journalVouchers.branch, branch as string));
    if (startDate) conditions.push(gte(journalVouchers.voucherDate, new Date(startDate as string)));
    if (endDate) conditions.push(lte(journalVouchers.voucherDate, new Date(endDate as string)));
    if (q && String(q).trim()) {
      conditions.push(ilike(journalVouchers.voucherNo, `%${String(q).trim()}%`));
    }
    const results = await db
      .select()
      .from(journalVouchers)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(journalVouchers.voucherDate), desc(journalVouchers.createdAt));
    res.json(results);
  } catch (error) {
    console.error("Error fetching journal vouchers:", error);
    sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to fetch journal vouchers" });
  }
});

// Voucher detail with its lines.
router.get("/journal-vouchers/:id", requireFinancialPermission(FINANCIAL_ACTIONS.journalVoucherView, { roles: STAGE2_FINANCIAL_ROLES }), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [voucher] = await db.select().from(journalVouchers).where(eq(journalVouchers.id, id)).limit(1);
    if (!voucher) return sendError(res, notFound("Journal voucher not found."));
    const lines = await db
      .select()
      .from(journalVoucherLines)
      .where(eq(journalVoucherLines.voucherId, id))
      .orderBy(asc(journalVoucherLines.lineNo));
    res.json({ ...voucher, lines });
  } catch (error) {
    console.error("Error fetching journal voucher:", error);
    sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to fetch journal voucher" });
  }
});

// Create a DRAFT voucher (+ lines). Drafts may be incomplete/unbalanced; the
// balance and account-head checks are enforced at POST time, not here.
router.post(
  "/journal-vouchers",
  requireFinancialPermission(FINANCIAL_ACTIONS.journalVoucherCreate, { roles: STAGE2_FINANCIAL_ROLES }),
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const data = jvCreateSchema.parse(req.body);

      for (const line of data.lines) {
        if (Number(line.debit) > 0 && Number(line.credit) > 0) {
          return sendError(res, badRequest("A line cannot be both a debit and a credit."));
        }
      }

      const totalDebit = data.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const totalCredit = data.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
      const voucherNo = data.voucherNo || generateVoucherNo();

      const result = await withFinancialTransaction(async (tx) => {
        const [voucher] = await tx
          .insert(journalVouchers)
          .values({
            voucherNo,
            voucherDate: data.voucherDate ?? new Date(),
            status: "DRAFT",
            remarks: data.remarks,
            branch: data.branch ?? null,
            totalDebit: totalDebit.toFixed(2),
            totalCredit: totalCredit.toFixed(2),
            createdByUserId: userId,
          })
          .returning();

        let lines: Array<typeof journalVoucherLines.$inferSelect> = [];
        if (data.lines.length > 0) {
          lines = await tx
            .insert(journalVoucherLines)
            .values(
              data.lines.map((l, idx) => ({
                voucherId: voucher.id,
                accountHeadId: l.accountHeadId,
                debit: (Number(l.debit) || 0).toFixed(2),
                credit: (Number(l.credit) || 0).toFixed(2),
                narration: l.narration ?? null,
                lineNo: l.lineNo ?? idx + 1,
              })),
            )
            .returning();
        }
        return { ...voucher, lines };
      });

      await AuditLogService.record({
        actorUserId: userId,
        action: FINANCIAL_ACTIONS.journalVoucherCreate,
        module: AUDIT_MODULE,
        entityType: "journal_voucher",
        entityId: String(result.id),
        after: { voucherNo: result.voucherNo, status: result.status, lineCount: result.lines.length },
        req,
      });

      res.status(201).json(result);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return sendError(res, conflict("A journal voucher with this number already exists."));
      }
      console.error("Error creating journal voucher:", error);
      sendError(res, error);
    }
  },
);

// Post a DRAFT voucher: balanced, atomic, writes ledger rows, locks the voucher.
router.post(
  "/journal-vouchers/:id/post",
  requireFinancialPermission(FINANCIAL_ACTIONS.journalVoucherPost, { roles: STAGE2_FINANCIAL_ROLES }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      const result = await withFinancialTransaction(async (tx) => {
        const [voucher] = await tx
          .select()
          .from(journalVouchers)
          .where(eq(journalVouchers.id, id))
          .limit(1)
          .for("update");
        if (!voucher) throw notFound("Journal voucher not found.");
        if (voucher.status !== "DRAFT") {
          throw conflict(`Only draft vouchers can be posted (this one is ${voucher.status}).`);
        }
        if (!voucher.remarks || !voucher.remarks.trim()) {
          throw new ApiError(400, "VALIDATION_ERROR", "Remarks are required before posting.");
        }

        const voucherLines = await tx
          .select()
          .from(journalVoucherLines)
          .where(eq(journalVoucherLines.voucherId, id))
          .orderBy(asc(journalVoucherLines.lineNo));

        const postingLines: PostingLine[] = voucherLines.map((l) => ({
          accountHeadId: l.accountHeadId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          narration: l.narration,
          voucherLineId: l.id,
        }));

        const entries = await postBalancedLedger(tx, {
          lines: postingLines,
          voucherId: voucher.id,
          referenceId: voucher.id,
          referenceType: "journal_voucher",
          branch: voucher.branch,
          remarks: voucher.remarks,
          userId,
          date: voucher.voucherDate ?? new Date(),
          category: "Journal Voucher",
        });

        const totalDebit = entries
          .filter((e) => e.entryType === "Debit")
          .reduce((s, e) => s + Number(e.amount), 0);
        const totalCredit = entries
          .filter((e) => e.entryType === "Credit")
          .reduce((s, e) => s + Number(e.amount), 0);

        const now = new Date();
        const [updated] = await tx
          .update(journalVouchers)
          .set({
            status: "POSTED",
            postedAt: now,
            postedByUserId: userId,
            totalDebit: totalDebit.toFixed(2),
            totalCredit: totalCredit.toFixed(2),
            updatedAt: now,
          })
          .where(eq(journalVouchers.id, id))
          .returning();

        return { voucher: updated, entryCount: entries.length };
      });

      await AuditLogService.recordTransition({
        actorUserId: userId,
        action: FINANCIAL_ACTIONS.journalVoucherPost,
        module: AUDIT_MODULE,
        entityType: "journal_voucher",
        entityId: String(id),
        previousStatus: "DRAFT",
        nextStatus: "POSTED",
        after: {
          voucherNo: result.voucher.voucherNo,
          totalDebit: result.voucher.totalDebit,
          totalCredit: result.voucher.totalCredit,
          entryCount: result.entryCount,
        },
        req,
      });

      res.json(result.voucher);
    } catch (error) {
      console.error("Error posting journal voucher:", error);
      sendError(res, error);
    }
  },
);

// Cancel a voucher. A DRAFT is simply marked CANCELLED; a POSTED voucher has all
// of its posted ledger rows reversed first (so the ledger stays balanced).
router.post(
  "/journal-vouchers/:id/cancel",
  requireFinancialPermission(FINANCIAL_ACTIONS.journalVoucherCancel, { roles: STAGE2_FINANCIAL_ROLES }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const { reason } = reasonSchema.parse(req.body);

      const result = await withFinancialTransaction(async (tx) => {
        const [voucher] = await tx
          .select()
          .from(journalVouchers)
          .where(eq(journalVouchers.id, id))
          .limit(1)
          .for("update");
        if (!voucher) throw notFound("Journal voucher not found.");
        if (voucher.status === "CANCELLED") {
          throw conflict("This voucher is already cancelled.");
        }

        let reversedCount = 0;
        if (voucher.status === "POSTED") {
          const posted = await tx
            .select()
            .from(ledgerEntries)
            .where(and(eq(ledgerEntries.voucherId, id), eq(ledgerEntries.status, "Posted")));
          if (posted.length > 0) {
            const mirrors = await reverseLedgerEntries(tx, posted, { userId, reason });
            reversedCount = mirrors.length;
          }
        }

        const now = new Date();
        const [updated] = await tx
          .update(journalVouchers)
          .set({
            status: "CANCELLED",
            cancelledAt: now,
            cancelledByUserId: userId,
            cancelReason: reason,
            updatedAt: now,
          })
          .where(eq(journalVouchers.id, id))
          .returning();

        return { voucher: updated, previousStatus: voucher.status, reversedCount };
      });

      await AuditLogService.recordTransition({
        actorUserId: userId,
        action: FINANCIAL_ACTIONS.journalVoucherCancel,
        module: AUDIT_MODULE,
        entityType: "journal_voucher",
        entityId: String(id),
        previousStatus: result.previousStatus,
        nextStatus: "CANCELLED",
        reason,
        after: { voucherNo: result.voucher.voucherNo, reversedEntries: result.reversedCount },
        req,
      });

      res.json(result.voucher);
    } catch (error) {
      console.error("Error cancelling journal voucher:", error);
      sendError(res, error);
    }
  },
);

// --- Office General Ledger --------------------------------------------------

/** Shared WHERE for the office ledger list/summary/export. Office ledger is the
 *  subset of ledger_entries linked to a chart-of-accounts head. */
function buildLedgerConditions(query: Request["query"]) {
  const { startDate, endDate, accountHeadId, branch, referenceType, status, q } = query;
  const conditions: any[] = [isNotNull(ledgerEntries.accountHeadId)];
  if (startDate) conditions.push(gte(ledgerEntries.date, new Date(startDate as string)));
  // "To" is inclusive of the whole day (a bare date parsed to its midnight before).
  if (endDate) {
    const end = /^\d{4}-\d{2}-\d{2}$/.test(String(endDate))
      ? sql`${ledgerEntries.date} < (${String(endDate)}::date + 1)`
      : lte(ledgerEntries.date, new Date(endDate as string));
    conditions.push(end);
  }
  if (accountHeadId) conditions.push(eq(ledgerEntries.accountHeadId, accountHeadId as string));
  if (branch) conditions.push(eq(ledgerEntries.branch, branch as string));
  if (referenceType) conditions.push(eq(ledgerEntries.referenceType, referenceType as string));
  if (status) conditions.push(eq(ledgerEntries.status, status as string));
  if (q && String(q).trim()) {
    const term = `%${String(q).trim()}%`;
    conditions.push(or(ilike(ledgerEntries.description, term), ilike(ledgerEntries.remarks, term)));
  }
  return conditions;
}

// List ledger rows (chronological) joined to their account head, with the
// amount split into debit/credit for the frontend's running-balance table.
router.get("/ledger", requireFinancialPermission(FINANCIAL_ACTIONS.ledgerView, { roles: STAGE2_FINANCIAL_ROLES }), async (req: Request, res: Response) => {
  try {
    const conditions = buildLedgerConditions(req.query);
    const rows = await db
      .select({
        id: ledgerEntries.id,
        date: ledgerEntries.date,
        entryType: ledgerEntries.entryType,
        amount: ledgerEntries.amount,
        currency: ledgerEntries.currency,
        description: ledgerEntries.description,
        category: ledgerEntries.category,
        status: ledgerEntries.status,
        referenceId: ledgerEntries.referenceId,
        referenceType: ledgerEntries.referenceType,
        voucherId: ledgerEntries.voucherId,
        branch: ledgerEntries.branch,
        remarks: ledgerEntries.remarks,
        accountHeadId: ledgerEntries.accountHeadId,
        accountHeadCode: accountHeads.code,
        accountHeadName: accountHeads.name,
      })
      .from(ledgerEntries)
      .leftJoin(accountHeads, sql`${ledgerEntries.accountHeadId} = ${accountHeads.id}::text`)
      .where(and(...conditions))
      .orderBy(asc(ledgerEntries.date), asc(ledgerEntries.createdAt));

    const result = rows.map((r) => ({
      ...r,
      debit: r.entryType === "Debit" ? r.amount : "0.00",
      credit: r.entryType === "Credit" ? r.amount : "0.00",
    }));
    res.json(result);
  } catch (error) {
    console.error("Error fetching office ledger:", error);
    sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to fetch ledger" });
  }
});

// Totals + per-account-head breakdown over the filtered set.
router.get("/ledger/summary", requireFinancialPermission(FINANCIAL_ACTIONS.ledgerView, { roles: STAGE2_FINANCIAL_ROLES }), async (req: Request, res: Response) => {
  try {
    const conditions = buildLedgerConditions(req.query);
    const rows = await db
      .select({
        entryType: ledgerEntries.entryType,
        amount: ledgerEntries.amount,
        accountHeadId: ledgerEntries.accountHeadId,
        accountHeadCode: accountHeads.code,
        accountHeadName: accountHeads.name,
      })
      .from(ledgerEntries)
      .leftJoin(accountHeads, sql`${ledgerEntries.accountHeadId} = ${accountHeads.id}::text`)
      .where(and(...conditions));

    let totalDebit = 0;
    let totalCredit = 0;
    const byHead = new Map<string, { accountHeadId: string; code: string | null; name: string | null; debit: number; credit: number }>();
    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      const isDebit = r.entryType === "Debit";
      if (isDebit) totalDebit += amt;
      else totalCredit += amt;
      const key = r.accountHeadId ?? "unassigned";
      const agg = byHead.get(key) ?? {
        accountHeadId: key,
        code: r.accountHeadCode,
        name: r.accountHeadName,
        debit: 0,
        credit: 0,
      };
      if (isDebit) agg.debit += amt;
      else agg.credit += amt;
      byHead.set(key, agg);
    }

    res.json({
      totals: {
        debit: totalDebit.toFixed(2),
        credit: totalCredit.toFixed(2),
        difference: (totalDebit - totalCredit).toFixed(2),
        count: rows.length,
      },
      byAccountHead: Array.from(byHead.values()).map((h) => ({
        accountHeadId: h.accountHeadId,
        code: h.code,
        name: h.name,
        debit: h.debit.toFixed(2),
        credit: h.credit.toFixed(2),
        balance: (h.debit - h.credit).toFixed(2),
      })),
    });
  } catch (error) {
    console.error("Error building ledger summary:", error);
    sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to build ledger summary" });
  }
});

// CSV export — same filters, RBAC-gated and audited.
router.get(
  "/ledger/export",
  requireFinancialPermission(FINANCIAL_ACTIONS.ledgerExport, { roles: STAGE2_FINANCIAL_ROLES }),
  async (req: Request, res: Response) => {
    try {
      const conditions = buildLedgerConditions(req.query);
      const rows = await db
        .select({
          date: ledgerEntries.date,
          code: accountHeads.code,
          name: accountHeads.name,
          description: ledgerEntries.description,
          entryType: ledgerEntries.entryType,
          amount: ledgerEntries.amount,
          status: ledgerEntries.status,
          referenceType: ledgerEntries.referenceType,
          branch: ledgerEntries.branch,
          remarks: ledgerEntries.remarks,
        })
        .from(ledgerEntries)
        .leftJoin(accountHeads, sql`${ledgerEntries.accountHeadId} = ${accountHeads.id}::text`)
        .where(and(...conditions))
        .orderBy(asc(ledgerEntries.date), asc(ledgerEntries.createdAt));

      const count = sendCsvExport(res, {
        module: "office_ledger",
        range: { from: req.query.startDate as string | undefined, to: req.query.endDate as string | undefined },
        columns: [
          { header: "Date", value: (r) => r.date?.toISOString?.() ?? r.date },
          { header: "Account Code", value: (r) => r.code },
          { header: "Account Name", value: (r) => r.name },
          { header: "Description", value: (r) => r.description },
          { header: "Debit", value: (r) => (r.entryType === "Debit" ? r.amount : "0.00") },
          { header: "Credit", value: (r) => (r.entryType === "Credit" ? r.amount : "0.00") },
          { header: "Status", value: (r) => r.status },
          { header: "Reference", value: (r) => r.referenceType },
          { header: "Branch", value: (r) => r.branch },
          { header: "Remarks", value: (r) => r.remarks },
        ],
        rows,
      });

      await AuditLogService.record({
        actorUserId: getUserId(req),
        action: FINANCIAL_ACTIONS.ledgerExport,
        module: AUDIT_MODULE,
        entityType: "office_ledger_export",
        entityId: "csv",
        after: { rowCount: count, filters: req.query },
        req,
      });
    } catch (error) {
      console.error("Error exporting office ledger:", error);
      if (!res.headersSent) {
        sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to export ledger" });
      }
    }
  },
);

// Manual balanced journal — posts directly to the ledger (no voucher document).
// Entries share a generated reference id so they can be reversed as a group.
router.post(
  "/ledger",
  requireFinancialPermission(FINANCIAL_ACTIONS.ledgerPost, { roles: STAGE2_FINANCIAL_ROLES }),
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const data = manualJournalSchema.parse(req.body);
      const manualJournalId = randomUUID();

      const entries = await withFinancialTransaction((tx) =>
        postBalancedLedger(tx, {
          lines: data.lines.map((l) => ({
            accountHeadId: l.accountHeadId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            narration: l.narration,
          })),
          voucherId: null,
          referenceId: manualJournalId,
          referenceType: "manual_journal",
          branch: data.branch ?? null,
          remarks: data.remarks,
          userId,
          date: data.date ?? new Date(),
          category: "Manual Journal",
        }),
      );

      await AuditLogService.record({
        actorUserId: userId,
        action: FINANCIAL_ACTIONS.ledgerPost,
        module: AUDIT_MODULE,
        entityType: "manual_journal",
        entityId: manualJournalId,
        after: { entryCount: entries.length, remarks: data.remarks },
        req,
      });

      res.status(201).json({ manualJournalId, entries });
    } catch (error) {
      console.error("Error posting manual journal:", error);
      sendError(res, error);
    }
  },
);

// Reverse a posted manual-journal group. Voucher-sourced rows must be reversed
// by cancelling their voucher, so the voucher lifecycle stays authoritative.
router.post(
  "/ledger/:id/reverse",
  requireFinancialPermission(FINANCIAL_ACTIONS.ledgerReverse, { roles: STAGE2_FINANCIAL_ROLES }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const { reason } = reasonSchema.parse(req.body);

      const result = await withFinancialTransaction(async (tx) => {
        const [entry] = await tx.select().from(ledgerEntries).where(eq(ledgerEntries.id, id)).limit(1);
        if (!entry) throw notFound("Ledger entry not found.");
        if (entry.status !== "Posted") {
          throw conflict(`Only posted entries can be reversed (this one is ${entry.status}).`);
        }
        if (entry.voucherId) {
          throw conflict("This entry belongs to a journal voucher; cancel the voucher to reverse it.");
        }
        if (entry.referenceType !== "manual_journal" || !entry.referenceId) {
          throw conflict("This entry cannot be reversed individually.");
        }

        const group = await tx
          .select()
          .from(ledgerEntries)
          .where(
            and(
              eq(ledgerEntries.referenceId, entry.referenceId),
              eq(ledgerEntries.referenceType, "manual_journal"),
              eq(ledgerEntries.status, "Posted"),
            ),
          )
          .orderBy(asc(ledgerEntries.id))
          .for("update");

        if (group.length === 0) {
          throw conflict("This manual journal has already been reversed.");
        }

        const mirrors = await reverseLedgerEntries(tx, group, { userId, reason });
        return { reversedCount: mirrors.length, entries: mirrors, referenceId: entry.referenceId };
      });

      await AuditLogService.record({
        actorUserId: userId,
        action: FINANCIAL_ACTIONS.ledgerReverse,
        module: AUDIT_MODULE,
        entityType: "manual_journal",
        entityId: String(result.referenceId),
        reason,
        after: { reversedEntries: result.reversedCount },
        req,
      });

      res.json(result);
    } catch (error) {
      console.error("Error reversing ledger entry:", error);
      sendError(res, error);
    }
  },
);

// Posted ledger rows are immutable. These endpoints exist to make that explicit
// (and to guide callers to reversal) rather than silently allowing edits.
router.patch(
  "/ledger/:id",
  requireFinancialPermission(FINANCIAL_ACTIONS.ledgerReverse, { roles: STAGE2_FINANCIAL_ROLES }),
  async (_req: Request, res: Response) => {
    sendError(res, conflict("Ledger entries are immutable. Post a reversing entry instead of editing."));
  },
);

router.delete(
  "/ledger/:id",
  requireFinancialPermission(FINANCIAL_ACTIONS.ledgerReverse, { roles: STAGE2_FINANCIAL_ROLES }),
  async (_req: Request, res: Response) => {
    sendError(res, conflict("Ledger entries are immutable. Post a reversing entry instead of deleting."));
  },
);

export default router;
