import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "./db";
import { 
  accountHeads, officeExpenses, officeVas, cheques, businessCustomers, invoices, customers,
  ledgerEntries, journalVouchers, journalVoucherLines,
  insertAccountHeadSchema, insertOfficeExpenseSchema, insertOfficeVasSchema,
  insertChequeSchema, insertBusinessCustomerSchema
} from "@shared/schema";
import { eq, desc, asc, and, gte, lte, ilike, or, notIlike, inArray, isNotNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { sendError, sendApiError, ApiError, badRequest, conflict, notFound } from "./utils/api-error";
import {
  requireFinancialPermission,
  FINANCIAL_ACTIONS,
} from "./middleware/financial-permission";
import { ROLES } from "./utils/role-utils";
import { withFinancialTransaction } from "./utils/financial-transaction";
import { AuditLogService } from "./services/audit-log.service";
import { pickWritable } from "./utils/financial-validation";
import { sendCsvExport } from "./utils/financial-export";

const router = Router();

const AUDIT_MODULE = "office_accounts";

/**
 * Stage 2 write/post/export role policy (Patch 4 spec G). Wider than the Stage 1
 * default ([admin, account_manager]) so a Super HOD can manage Office Accounts.
 * Ordinary users still cannot create/post/reverse/export (fails closed).
 */
const STAGE2_FINANCIAL_ROLES = [ROLES.ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPER_HOD];

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

// List — backward-compatible array shape (consumed by chart-of-accounts.tsx and
// office-trial-balance.tsx). Optional filters: category, type, status, parent, q.
router.get("/account-heads", async (req: Request, res: Response) => {
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
  requireFinancialPermission(FINANCIAL_ACTIONS.accountHeadCreate),
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
  requireFinancialPermission(FINANCIAL_ACTIONS.accountHeadDelete),
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

// Office Expenses
router.get("/expenses", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, office, accountingHead } = req.query;
    let conditions = [];
    
    if (startDate) {
      conditions.push(gte(officeExpenses.expenseDate, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(officeExpenses.expenseDate, new Date(endDate as string)));
    }
    if (office) {
      const officeArray = (office as string).split(",").filter(Boolean);
      if (officeArray.length > 0) {
        conditions.push(inArray(officeExpenses.office, officeArray));
      }
    }
    if (accountingHead) {
      const headArray = (accountingHead as string).split(",").filter(Boolean);
      if (headArray.length > 0) {
        conditions.push(inArray(officeExpenses.expenseHead, headArray));
      }
    }
    
    const results = await db.select().from(officeExpenses)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(officeExpenses.createdAt));
    
    res.json(results);
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
      const conditions = [];

      if (startDate) {
        conditions.push(gte(officeExpenses.expenseDate, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(officeExpenses.expenseDate, new Date(endDate as string)));
      }
      if (office) {
        const officeArray = (office as string).split(",").filter(Boolean);
        if (officeArray.length > 0) {
          conditions.push(inArray(officeExpenses.office, officeArray));
        }
      }
      if (accountingHead) {
        const headArray = (accountingHead as string).split(",").filter(Boolean);
        if (headArray.length > 0) {
          conditions.push(inArray(officeExpenses.expenseHead, headArray));
        }
      }

      const results = await db.select().from(officeExpenses)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(officeExpenses.createdAt));

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
          { header: "Expense Date", value: (r) => r.expenseDate?.toISOString?.() ?? r.expenseDate },
        ],
        rows: results,
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
      const userId = getUserId(req);
      const data = insertOfficeExpenseSchema.parse(req.body);

      const [result] = await db.insert(officeExpenses).values({
        ...data,
        createdByUserId: userId,
      }).returning();

      await AuditLogService.record({
        actorUserId: userId,
        action: FINANCIAL_ACTIONS.expenseCreate,
        module: AUDIT_MODULE,
        entityType: "office_expense",
        entityId: String(result.id),
        after: { amount: result.amount, currency: result.currency, expenseHead: result.expenseHead, office: result.office },
        req,
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating expense:", error);
      sendError(res, error);
    }
  },
);

router.delete(
  "/expenses/:id",
  requireFinancialPermission(FINANCIAL_ACTIONS.expenseDelete),
  async (req: Request, res: Response) => {
    try {
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
    const { startDate, endDate, search } = req.query;
    let conditions = [];
    
    if (startDate) {
      conditions.push(gte(invoices.issueDate, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(invoices.issueDate, new Date(endDate as string)));
    }
    if (search) {
      conditions.push(ilike(invoices.customerName, `%${search}%`));
    }
    
    // Exclude Alibaba related companies
    conditions.push(notIlike(invoices.customerName, '%alibaba%'));
    
    // Only show paid invoices since they asked for "amount paid"
    conditions.push(eq(invoices.status, 'Paid'));
    
    const results = await db.select().from(invoices)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(invoices.issueDate));
      
    const mapped = results.map(inv => {
      let method = "-";
      try {
        const p = JSON.parse(inv.notes || '{}');
        method = p.paymentMethod || "-";
      } catch (e) {}
      
      return {
        id: inv.id,
        companyName: inv.customerName,
        amount: inv.total,
        currency: inv.currency || "USD",
        method: method,
        vasDate: inv.paidAt || inv.issueDate,
        createdAt: inv.createdAt
      };
    });
    
    res.json(mapped);
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
router.get("/cheques", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status, search } = req.query;
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
    const { search } = req.query;
    let conditions = [];
    
    if (search) {
      conditions.push(or(
        ilike(customers.companyName, `%${search}%`),
        ilike(customers.phone, `%${search}%`),
        ilike(customers.cnic, `%${search}%`),
        ilike(customers.ntn, `%${search}%`)
      ));
    }
    
    const results = await db.select().from(customers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(customers.createdAt));
      
    // Fetch live invoices to calculate real totalPaid and totalDue
    const allInvoices = await db.select().from(invoices);
    
    // Create a map of customer id/name to amounts
    const companyTotals = allInvoices.reduce((acc, inv) => {
       // Match by customerId first, then by customerName fallback
       const matchKey = inv.customerId || (inv.customerName || '').toLowerCase().trim();
       if (!matchKey) return acc;
       
       if (!acc[matchKey]) {
           acc[matchKey] = { paid: 0, due: 0 };
       }
       const amount = parseFloat(inv.total as string) || 0;
       if (inv.status === 'Paid') {
           acc[matchKey].paid += amount;
       } else if (inv.status === 'Pending' || inv.status === 'Sent' || inv.status === 'Overdue') {
           acc[matchKey].due += amount;
       }
       return acc;
    }, {} as Record<string, { paid: number, due: number }>);
    
    // Map the results to include real live data
    const liveResults = results.map(customer => {
       const nameMatch = (customer.companyName || '').toLowerCase().trim();
       const liveTotals = companyTotals[customer.id] || companyTotals[nameMatch];
       
       return {
           id: customer.id,
           companyName: customer.companyName,
           phone: customer.phone,
           cnic: customer.cnic,
           ntn: customer.ntn,
           createdAt: customer.createdAt,
           totalPaid: liveTotals ? liveTotals.paid.toString() : "0",
           totalDue: liveTotals ? liveTotals.due.toString() : "0"
       };
    });
    
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
      entryDate: date,
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
    entryDate: now,
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
router.get("/journal-vouchers", async (req: Request, res: Response) => {
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
router.get("/journal-vouchers/:id", async (req: Request, res: Response) => {
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
        const [voucher] = await tx.select().from(journalVouchers).where(eq(journalVouchers.id, id)).limit(1);
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
        const [voucher] = await tx.select().from(journalVouchers).where(eq(journalVouchers.id, id)).limit(1);
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
  if (endDate) conditions.push(lte(ledgerEntries.date, new Date(endDate as string)));
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
router.get("/ledger", async (req: Request, res: Response) => {
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
      .leftJoin(accountHeads, eq(ledgerEntries.accountHeadId, accountHeads.id))
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
router.get("/ledger/summary", async (req: Request, res: Response) => {
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
      .leftJoin(accountHeads, eq(ledgerEntries.accountHeadId, accountHeads.id))
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
        .leftJoin(accountHeads, eq(ledgerEntries.accountHeadId, accountHeads.id))
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
          );

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
