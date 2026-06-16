import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "./db";
import { 
  accountHeads, officeExpenses, officeVas, cheques, businessCustomers, invoices, customers,
  insertAccountHeadSchema, insertOfficeExpenseSchema, insertOfficeVasSchema,
  insertChequeSchema, insertBusinessCustomerSchema
} from "@shared/schema";
import { eq, desc, and, gte, lte, ilike, or, notIlike, inArray } from "drizzle-orm";
import { sendError, sendApiError } from "./utils/api-error";
import {
  requireFinancialPermission,
  FINANCIAL_ACTIONS,
} from "./middleware/financial-permission";
import { AuditLogService } from "./services/audit-log.service";
import { pickWritable } from "./utils/financial-validation";
import { sendCsvExport } from "./utils/financial-export";

const router = Router();

const AUDIT_MODULE = "office_accounts";

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

// Account Heads
router.get("/account-heads", async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    
    const results = category
      ? await db.select().from(accountHeads).where(eq(accountHeads.category, category as any)).orderBy(accountHeads.code)
      : await db.select().from(accountHeads).orderBy(accountHeads.code);
    
    res.json(results);
  } catch (error) {
    console.error("Error fetching account heads:", error);
    sendApiError(res, { status: 500, code: "INTERNAL_ERROR", message: "Failed to fetch account heads" });
  }
});

router.post(
  "/account-heads",
  requireFinancialPermission(FINANCIAL_ACTIONS.accountHeadCreate),
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const data = insertAccountHeadSchema.parse(req.body);

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
      console.error("Error creating account head:", error);
      sendError(res, error);
    }
  },
);

router.delete(
  "/account-heads/:id",
  requireFinancialPermission(FINANCIAL_ACTIONS.accountHeadDelete),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const reason = getDeleteReason(req);
      const [deleted] = await db.delete(accountHeads).where(eq(accountHeads.id, id)).returning();

      await AuditLogService.record({
        actorUserId: getUserId(req),
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

export default router;
