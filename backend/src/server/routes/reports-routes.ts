import { Router, type Express } from "express";
import { getDepartmentFilterUserIds } from "./dashboard-routes";
import { normalizeRole } from "./utils/role-utils";
import { db, pool } from "./db";
import { mapToCanonical } from "./utils/gm-bv-state-machine";
import { resolveStoredOrDerivedGmType } from "../shared/gm-sales-constants";
import { deriveQuarterKey, getGmCommissionQuarterSummary, syncGmCommissionLedger } from "./services/gm-commission.service";
import { z } from "zod";
import {
  loanRequests,
  customers,
  opportunities,
  followUps,
  vasProgressSnapshots,
  users,
  userActivities,
  gmEntries,
  invoices,
  refundGmEntries,
  ledgerEntries,
  insertBvReportSchema,
  insertLoanReportSchema,
  insertVasReportSchema,
  insertGmReportSchema,
  loanReports,
  vasReports,
  gmReports,
  officeVas,
  productPostingInvoices,
} from "@shared/schema";
import { eq, and, gte, lte, sql, count, ilike, or, desc, inArray } from "drizzle-orm";
import { bvReportsRepository, ensureBvReportsSchema } from "./repositories/bv-reports.repository";
import {
  loanReportsRepository,
  vasReportsRepository,
  gmReportsRepository,
} from "./repositories/generic-report.repository";
import { isManagerialRole } from "./utils/role-utils";
import { sendError, errorEnvelope, badRequest, unauthorized, forbidden, notFound, sendApiError } from "./utils/api-error";
import { requireReportPermission, resolveReportRoles } from "./middleware/report-permission";
import { requireFinancialPermission, FINANCIAL_ACTIONS, FINANCIAL_VIEW_ROLES } from "./middleware/financial-permission";
import { ActivityLogService } from "./services/activity-service";
import { exportTimestamp } from "./utils/export-filename";
import { getBvReportData, type BvReportFilters } from "./services/bv-report.service";
import {
  getDayTargetReport,
  buildDayTargetCsv,
  type DayTargetQuery,
} from "./services/day-target.service";

const router = Router();

// ===== Stage 8 — GM/BV financial reconciliation (read-only) =====
// The GM model has no shared customer_id FK across gm_entries / invoices /
// refund_gm_entries, so the reliable join key is the NORMALIZED company name.
// Honest by design: when a source has no matching financial records the figures
// are 0, never fabricated.
const reconNorm = (s: string) =>
  `regexp_replace(lower(coalesce(${s}, '')), '[^a-z0-9]', '', 'g')`;

router.get(
  "/reports/gm-bv-reconciliation",
  requireFinancialPermission(FINANCIAL_ACTIONS.gmBvReconciliationView, { roles: FINANCIAL_VIEW_ROLES }),
  async (req, res) => {
  try {
    if (!(req as any).user) return res.status(401).json({ error: "Not authenticated" });

    const where: string[] = ["coalesce(g.is_deleted, false) = false"];
    const params: any[] = [];
    const add = (clause: string, val: any) => {
      params.push(val);
      where.push(clause.replace("$$", `$${params.length}`));
    };

    if (req.query.dateFrom) add("g.created_at >= $$", new Date(String(req.query.dateFrom)));
    if (req.query.dateTo) add("g.created_at <= $$", new Date(String(req.query.dateTo)));
    if (req.query.userId) add("g.sales_person_id::text = $$::text", String(req.query.userId));
    if (req.query.customer)
      add(
        `${reconNorm("g.company_name")} like $$`,
        `%${String(req.query.customer).toLowerCase().replace(/[^a-z0-9]/g, "")}%`,
      );
    if (req.query.status) add("g.status = $$", String(req.query.status));
    if (req.query.department) add("u.department = $$", String(req.query.department));

    const reconSql = `
      with gm as (
        select g.*, u.department as sales_department, u.name as sales_user_name
          from drm.gm_entries g
          left join drm.users u on u.id::text = g.sales_person_id::text
         where ${where.join(" and ")}
         order by g.created_at desc
         limit 1000
      ),
      inv as (
        select ${reconNorm("customer_name")} as ckey,
               sum(coalesce(total,0)::numeric) as invoiced,
               sum(case when status = 'Paid' then coalesce(total,0)::numeric else 0 end) as received
          from drm.invoices
         group by ${reconNorm("customer_name")}
      ),
      led as (
        select reference_id,
               sum(coalesce(amount,0)::numeric) as ledger_amount
          from drm.ledger_entries
         where reference_type = 'gm_entry'
         group by reference_id
      ),
      ref as (
        select ${reconNorm("company_name")} as ckey,
               sum(coalesce(amount,0)::numeric) as refunded
          from drm.refund_gm_entries
         where status = 'approved'
         group by ${reconNorm("company_name")}
      )
      select gm.id, gm.drm_id, gm.order_id, gm.company_name, gm.status,
             gm.approval_status, gm.withdrawal_status, gm.account_manager_status,
             gm.sales_person_name, gm.sales_user_name, gm.sales_department,
             gm.created_at,
             coalesce(gm.amount_pkr, 0)::numeric as gm_amount_pkr,
             coalesce(gm.amount_usd, 0)::numeric as gm_amount_usd,
             coalesce(inv.invoiced, 0)::numeric as invoiced,
             coalesce(inv.received, 0)::numeric as received,
             coalesce(led.ledger_amount, 0)::numeric as ledger_amount,
             coalesce(ref.refunded, 0)::numeric as refunded
        from gm
        left join inv on inv.ckey = ${reconNorm("gm.company_name")}
        left join led on led.reference_id = gm.id
        left join ref on ref.ckey = ${reconNorm("gm.company_name")}
    `;

    const { rows } = await pool.query(reconSql, params);
    const EPS = 0.01;
    const items = rows.map((r: any) => {
      const gmAmount = Number(r.gm_amount_pkr) || 0;
      const invoiced = Number(r.invoiced) || 0;
      const received = Number(r.received) || 0;
      const ledger = Number(r.ledger_amount) || 0;
      const refunded = Number(r.refunded) || 0;
      const due = Math.max(0, invoiced - received);
      const canonical = mapToCanonical(r);
      const flags: string[] = [];
      if (invoiced > 0 && Math.abs(gmAmount - invoiced) > EPS) flags.push("gm_vs_invoice_mismatch");
      if (Math.abs(invoiced - (received + due)) > EPS) flags.push("invoice_balance_mismatch");
      if (ledger > 0 && Math.abs(ledger - received) > EPS) flags.push("ledger_vs_received_mismatch");
      if (refunded > received + EPS) flags.push("refund_exceeds_received");
      return {
        gmId: r.id,
        drmId: r.drm_id,
        projectLink: r.order_id || null,
        customer: r.company_name,
        salesPerson: r.sales_user_name || r.sales_person_name,
        department: r.sales_department,
        status: r.status,
        canonicalStatus: canonical,
        createdAt: r.created_at,
        gmAmount,
        gmAmountUsd: Number(r.gm_amount_usd) || 0,
        invoicedAmount: invoiced,
        receivedAmount: received,
        dueAmount: due,
        ledgerAmount: ledger,
        refundAmount: refunded,
        mismatchFlags: flags,
        hasMismatch: flags.length > 0,
      };
    });

    const totals = items.reduce(
      (acc: any, i: any) => {
        acc.gm += i.gmAmount; acc.invoiced += i.invoicedAmount;
        acc.received += i.receivedAmount; acc.due += i.dueAmount;
        acc.ledger += i.ledgerAmount; acc.refund += i.refundAmount;
        if (i.hasMismatch) acc.mismatches += 1;
        return acc;
      },
      { gm: 0, invoiced: 0, received: 0, due: 0, ledger: 0, refund: 0, mismatches: 0 },
    );

    res.json({ success: true, matchBasis: "normalized_company_name", count: items.length, totals, items });
  } catch (error: any) {
    console.error("Error in gm-bv-reconciliation:", error);
    res.status(500).json({ error: "Failed to build reconciliation report" });
  }
});

type ReportType = "loan" | "vas" | "gm" | "bv";

interface ReportMetrics {
  totalTasks: number;
  valueOfServiceSold: number;
  successRate: number | null;
  followUpsCompleted: number | null;
  missedLeads: number | null;
}

interface ReportData {
  type: ReportType;
  dateRange: { from: string; to: string };
  metrics: ReportMetrics;
  chartData: { date: string; value: number; count: number }[];
  details: any[];
  totals?: {
    totalAdvance: number;
    totalRemaining: number;
  };
  meta: {
    from: string;
    to: string;
    timezone: string;
  };
}

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const clampPercentage = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseDateRange(from?: string, to?: string) {
  const defaultTo = endOfDay(new Date());
  const defaultFrom = startOfDay(new Date(defaultTo));
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const parsedFrom = from ? startOfDay(new Date(from)) : defaultFrom;
  const parsedTo = to ? endOfDay(new Date(to)) : defaultTo;

  if (Number.isNaN(parsedFrom.getTime()) || Number.isNaN(parsedTo.getTime())) {
    throw new Error("Invalid date range");
  }

  const fromDate = parsedFrom <= parsedTo ? parsedFrom : parsedTo;
  const toDate = parsedFrom <= parsedTo ? parsedTo : parsedFrom;

  return {
    fromDate,
    toDate,
    meta: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      timezone: tz,
    },
  };
}

const bvPayloadSchema = insertBvReportSchema;
const bvUpdateSchema = bvPayloadSchema.partial();
const loanPayloadSchema = insertLoanReportSchema.extend({
  reportDate: z.union([z.string(), z.date()]).optional(),
});
const vasPayloadSchema = insertVasReportSchema.extend({
  reportDate: z.union([z.string(), z.date()]).optional(),
  valueSold: z.coerce.number().min(0).default(0),
  successRate: z.coerce.number().min(0).max(100).default(0),
  totalTasks: z.coerce.number().min(0).default(0),
  followUpsDone: z.coerce.number().min(0).default(0),
  missedLeads: z.coerce.number().min(0).default(0),
});
const gmPayloadSchema = insertGmReportSchema.extend({
  reportDate: z.union([z.string(), z.date()]).optional(),
});

/**
 * True when the caller's (active) role may approve/reject BV reports — i.e. may
 * set a report to Approved or Rejected. Mirrors the role resolution used by the
 * report-permission guard.
 */
function isBvApprover(req: any): boolean {
  const callerRole = normalizeRole((req.user as any)?.activeRoleId ?? req.user?.roleId);
  return resolveReportRoles("bv_report", "approve").includes(callerRole);
}

/**
 * Resolve the BV row-scope for the caller, identical to the report dispatcher:
 * executives → own only, global admins → no scope (null), managers →
 * department/team list (optionally narrowed to a requested userId).
 */
async function resolveBvScope(req: any): Promise<string[] | null> {
  const user = req.user;
  const isPrivileged = isManagerialRole(user.roleId);
  const isGlobalAdmin = ["admin", "super_admin", "super_hod", "hod"].includes(normalizeRole(user.roleId));
  const queryUserId =
    typeof req.query.userId === "string" && req.query.userId !== "all" ? req.query.userId : null;
  if (!isPrivileged) return [user.userId];
  if (isGlobalAdmin) return queryUserId ? [queryUserId] : null;
  const allowedIds = await getDepartmentFilterUserIds(req);
  if (queryUserId) {
    return allowedIds && allowedIds.includes(queryUserId)
      ? [queryUserId]
      : ["00000000-0000-0000-0000-000000000000"];
  }
  return allowedIds;
}

const BV_STATUSES = ["Draft", "Submitted", "Approved", "Rejected"] as const;

/**
 * Parse BV report query filters. Fails closed: an out-of-range status, or a
 * legacy/unsupported filter (package/method), is a 400 — never silently ignored.
 */
function parseBvFilters(
  req: any,
): { ok: true; filters: BvReportFilters } | { ok: false; error: string } {
  const q = req.query;
  for (const key of ["package", "method"]) {
    if (typeof q[key] === "string" && q[key].trim() !== "") {
      return { ok: false, error: `Unsupported filter: ${key}` };
    }
  }
  const filters: BvReportFilters = {};
  if (typeof q.status === "string" && q.status !== "" && q.status !== "all") {
    if (!(BV_STATUSES as readonly string[]).includes(q.status)) {
      return { ok: false, error: `Invalid status: ${q.status}` };
    }
    filters.status = q.status;
  }
  if (typeof q.company === "string" && q.company.trim() !== "") {
    filters.company = q.company.trim();
  }
  if (typeof q.branch === "string" && q.branch.trim() !== "" && q.branch !== "all") {
    filters.branch = q.branch.trim();
  }
  return { ok: true, filters };
}

/** Pagination params for the BV list (clamped 1..500). Export ignores these. */
function parseBvPaging(req: any): { page?: number; limit?: number } {
  const out: { page?: number; limit?: number } = {};
  const rawLimit = req.query.limit;
  if (typeof rawLimit === "string" && rawLimit !== "") {
    const n = Number(rawLimit);
    if (Number.isFinite(n)) out.limit = Math.min(500, Math.max(1, Math.floor(n)));
  }
  const rawPage = req.query.page;
  if (typeof rawPage === "string" && rawPage !== "") {
    const n = Number(rawPage);
    if (Number.isFinite(n)) out.page = Math.max(1, Math.floor(n));
  }
  return out;
}

/** Date params accepting startDate/endDate aliases (from/to take precedence). */
function bvDateParams(req: any): { from?: string; to?: string } {
  const q = req.query;
  const from =
    typeof q.from === "string" ? q.from : typeof q.startDate === "string" ? q.startDate : undefined;
  const to =
    typeof q.to === "string" ? q.to : typeof q.endDate === "string" ? q.endDate : undefined;
  return { from, to };
}

router.post("/bv-reports", requireReportPermission("bv_report", "create"), async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    if (!req.user) return sendError(res, unauthorized("Not authenticated"));
    const parsed = bvPayloadSchema.parse(req.body);
    if (["Approved", "Rejected"].includes(parsed.status) && !isBvApprover(req)) {
      return res
        .status(403)
        .json(errorEnvelope("FORBIDDEN", "Only approvers can create BV reports with Approved or Rejected status."));
    }
    console.debug(`[${requestId}] create bv-report`, {
      userId: req.user.userId,
      customerId: parsed.customerId,
      reportDate: parsed.reportDate?.toISOString?.(),
      status: parsed.status,
      titleLength: parsed.title?.length,
    });
    const report = await bvReportsRepository.create(req.user.userId, {
      ...parsed,
      reportDate: parsed.reportDate ?? new Date(),
    });
    await ActivityLogService.log({
      userId: req.user.userId,
      action: "bv_report.create",
      resourceType: "bv_report",
      resourceId: report.id,
      details: JSON.stringify({ status: report.status, title: report.title }),
    });
    return res.status(201).json({ success: true, data: report });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error);
    }
    if (error?.code === "INVALID_CUSTOMER" || error?.message === "INVALID_CUSTOMER" || error?.code === "23503") {
      return res.status(400).json(errorEnvelope("INVALID_CUSTOMER", "Customer not found"));
    }
    console.error(`Failed to create BV report [${requestId}]`, {
      requestId,
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      stack: error?.stack,
    });
    const status = error?.code === "ECONNREFUSED" ? 503 : 500;
    return res.status(status).json(errorEnvelope("INTERNAL_ERROR", "Failed to create BV report"));
  }
});

router.get("/bv-reports", requireReportPermission("bv_report", "view"), async (req, res) => {
  try {
    if (!req.user) return sendError(res, unauthorized("Not authenticated"));
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const { fromDate, toDate } = parseDateRange(from, to);
    const filterUserIds = await resolveBvScope(req);
    const items = await bvReportsRepository.list(filterUserIds, fromDate, toDate);
    return res.json({ success: true, items });
  } catch (error) {
    console.error("Failed to list BV reports", error);
    return res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to list BV reports"));
  }
});

router.get("/bv-reports/:id", requireReportPermission("bv_report", "view"), async (req, res) => {
  try {
    if (!req.user) return sendError(res, unauthorized("Not authenticated"));
    const filterUserIds = await resolveBvScope(req);
    const report = await bvReportsRepository.findById(filterUserIds, req.params.id);
    if (!report) return sendError(res, notFound("Not found"));
    return res.json({ success: true, data: report });
  } catch (error) {
    console.error("Failed to fetch BV report", error);
    return res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to fetch BV report"));
  }
});

const bvUpdateHandler = async (req: any, res: any) => {
  try {
    if (!req.user) return sendError(res, unauthorized("Not authenticated"));
    const parsed = bvUpdateSchema.parse(req.body);
    const approver = isBvApprover(req);
    if (parsed.status && ["Approved", "Rejected"].includes(parsed.status) && !approver) {
      return res
        .status(403)
        .json(errorEnvelope("FORBIDDEN", "Only approvers can set Approved or Rejected status."));
    }
    const current = await bvReportsRepository.findById(null, req.params.id);
    if (!current) return sendError(res, notFound("Not found"));
    if (["Approved", "Rejected"].includes(current.status) && !approver) {
      return res
        .status(403)
        .json(errorEnvelope("FORBIDDEN", "This BV report is finalized and can no longer be edited."));
    }
    const updated = await bvReportsRepository.update(req.user.userId, req.params.id, parsed);
    if (!updated) return sendError(res, notFound("Not found"));
    await ActivityLogService.log({
      userId: req.user.userId,
      action: "bv_report.update",
      resourceType: "bv_report",
      resourceId: req.params.id,
      details: JSON.stringify({ status: updated.status }),
    });
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error);
    }
    if (error?.code === "INVALID_CUSTOMER" || error?.message === "INVALID_CUSTOMER" || error?.code === "23503") {
      return res.status(400).json(errorEnvelope("INVALID_CUSTOMER", "Customer not found"));
    }
    console.error("Failed to update BV report", error);
    return res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to update BV report"));
  }
};
router.put("/bv-reports/:id", requireReportPermission("bv_report", "edit"), bvUpdateHandler);
// Patch 2 Stage 7 — PATCH is an alias for PUT (identical edit semantics + guards).
router.patch("/bv-reports/:id", requireReportPermission("bv_report", "edit"), bvUpdateHandler);

router.post("/bv-reports/:id/approve", requireReportPermission("bv_report", "approve"), async (req, res) => {
  try {
    if (!req.user) return sendError(res, unauthorized("Not authenticated"));
    const current = await bvReportsRepository.findById(null, req.params.id);
    if (!current) return sendError(res, notFound("Not found"));
    if (current.status !== "Submitted") {
      return res
        .status(409)
        .json(errorEnvelope("INVALID_TRANSITION", "Only Submitted BV reports can be approved."));
    }
    const updated = await bvReportsRepository.setStatus(req.params.id, "Approved", {
      actorId: req.user.userId,
    });
    await ActivityLogService.log({
      userId: req.user.userId,
      action: "bv_report.approve",
      resourceType: "bv_report",
      resourceId: req.params.id,
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to approve BV report", error);
    return res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to approve BV report"));
  }
});

router.post("/bv-reports/:id/reject", requireReportPermission("bv_report", "approve"), async (req, res) => {
  try {
    if (!req.user) return sendError(res, unauthorized("Not authenticated"));
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) {
      return res
        .status(400)
        .json(errorEnvelope("VALIDATION_ERROR", "A non-empty rejection reason is required."));
    }
    const current = await bvReportsRepository.findById(null, req.params.id);
    if (!current) return sendError(res, notFound("Not found"));
    if (current.status !== "Submitted") {
      return res
        .status(409)
        .json(errorEnvelope("INVALID_TRANSITION", "Only Submitted BV reports can be rejected."));
    }
    const updated = await bvReportsRepository.setStatus(req.params.id, "Rejected", {
      actorId: req.user.userId,
      reason,
    });
    await ActivityLogService.log({
      userId: req.user.userId,
      action: "bv_report.reject",
      resourceType: "bv_report",
      resourceId: req.params.id,
      details: JSON.stringify({ reason }),
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to reject BV report", error);
    return res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to reject BV report"));
  }
});

function buildReportCrud(path: string, repo: any, schema: z.AnyZodObject) {
  const baseNumeric: Record<string, z.ZodTypeAny> = {
    totalTasks: z.coerce.number().min(0).default(0),
    valueSold: z.coerce.number().min(0).default(0),
    successRate: z.coerce.number().min(0).max(100).default(0),
    followUpsDone: z.coerce.number().min(0).default(0),
    missedLeads: z.coerce.number().min(0).default(0),
  };
  const numericExtras: Record<string, z.ZodTypeAny> = { ...baseNumeric };
  if (path === "loan-reports") {
    numericExtras.totalApplications = z.coerce.number().min(0).default(0);
    numericExtras.approvedLoans = z.coerce.number().min(0).default(0);
    numericExtras.rejectedLoans = z.coerce.number().min(0).default(0);
    numericExtras.pendingLoans = z.coerce.number().min(0).default(0);
    numericExtras.totalLoanAmount = z.coerce.number().min(0).default(0);
    numericExtras.disbursedAmount = z.coerce.number().min(0).default(0);
  }
  const payload = schema
    .extend({ reportDate: z.union([z.string(), z.date()]).optional() })
    .extend(numericExtras);
  router.post(`/${path}`, async (req, res) => {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      if (!req.user) return sendError(res, unauthorized("Not authenticated"));
      const parsed = payload.parse(req.body);
      console.log(`[${requestId}] create ${path}`, {
        userId: req.user.userId,
        keys: Object.keys(req.body || {}),
      });
      const data = await repo.create(req.user.userId, {
        ...parsed,
        reportDate: parsed.reportDate ? new Date(parsed.reportDate) : new Date(),
      });
      return res.status(201).json({ success: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return sendError(res, error);
      }
      if (error?.code === "INVALID_CUSTOMER" || error?.message === "INVALID_CUSTOMER") {
        return res.status(400).json(errorEnvelope("INVALID_CUSTOMER", "Customer not found"));
      }
      console.error(`Failed to create ${path}`, {
        requestId,
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        stack: error?.stack,
      });
      const status = error?.code === "23505" ? 409 : 500;
      const code = error?.code === "23505" ? "CONFLICT" : "INTERNAL_ERROR";
      return res.status(status).json(errorEnvelope(code, `Failed to create ${path}`));
    }
  });

  router.get(`/${path}`, async (req, res) => {
    try {
      if (!req.user) return sendError(res, unauthorized("Not authenticated"));
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const { fromDate, toDate } = parseDateRange(from, to);
      const items = await repo.list(req.user.userId, fromDate, toDate);
      return res.json({ success: true, items });
    } catch (error) {
      console.error(`Failed to list ${path}`, error);
      return res.status(500).json(errorEnvelope("INTERNAL_ERROR", `Failed to list ${path}`));
    }
  });

  router.get(`/${path}/:id`, async (req, res) => {
    try {
      if (!req.user) return sendError(res, unauthorized("Not authenticated"));
      const data = await repo.getById(req.user.userId, req.params.id);
      if (!data) return sendError(res, notFound("Not found"));
      return res.json({ success: true, data });
    } catch (error) {
      console.error(`Failed to fetch ${path}`, error);
      return res.status(500).json(errorEnvelope("INTERNAL_ERROR", `Failed to fetch ${path}`));
    }
  });

  router.put(`/${path}/:id`, async (req, res) => {
    try {
      if (!req.user) return sendError(res, unauthorized("Not authenticated"));
      const parsed = payload.partial().parse(req.body);
      const data = await repo.update(req.user.userId, req.params.id, parsed);
      if (!data) return sendError(res, notFound("Not found"));
      return res.json({ success: true, data });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return sendError(res, error);
      }
      console.error(`Failed to update ${path}`, error);
      return res.status(500).json(errorEnvelope("INTERNAL_ERROR", `Failed to update ${path}`));
    }
  });
}

buildReportCrud("loan-reports", loanReportsRepository, loanPayloadSchema);
buildReportCrud("vas-reports", vasReportsRepository, vasPayloadSchema);
buildReportCrud("gm-reports", gmReportsRepository, insertGmReportSchema);

async function getLoanReport(userIds: string[] | null, fromDate: Date, toDate: Date): Promise<ReportData> {
  const whereConditions = [
    gte(loanRequests.createdAt, fromDate),
    lte(loanRequests.createdAt, toDate)
  ];
  if (userIds && userIds.length > 0) {
    whereConditions.push(inArray(loanRequests.userId, userIds));
  }

  const loans = await db
    .select()
    .from(loanRequests)
    .where(and(...whereConditions));

  const totalLoans = loans.length;
  const approvedLoans = loans.filter(l => l.status === "HODApproved" || l.status === "Completed");
  const totalValue = loans.reduce((sum, l) => sum + parseFloat(l.amount), 0);
  const pendingLoans = loans.filter(l => l.status === "Pending" || l.status === "ManagerApproved");
  const rejectedLoans = loans.filter(l => l.status === "Rejected");
  const totalRemaining = loans.reduce((sum, l) => sum + parseFloat(l.remainingAmount), 0);

  const relatedUserIds = Array.from(
    new Set(
      loans.flatMap(l => [
        l.userId,
        l.managerApprovedByUserId,
        l.hodApprovedByUserId
      ].filter(Boolean) as string[])
    )
  );
  const userNames: Record<string, string> = {};
  if (relatedUserIds.length > 0) {
    const usersResult = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, relatedUserIds));
    usersResult.forEach(u => {
      userNames[u.id] = u.name ?? '';
    });
  }

  const chartData = generateChartData(loans, fromDate, toDate, 'amount');
  const loanReportConditions = [
    gte(loanReports.reportDate, fromDate),
    lte(loanReports.reportDate, toDate)
  ];
  if (userIds && userIds.length > 0) {
    loanReportConditions.push(inArray(loanReports.userId, userIds));
  }

  const customReports = await db
    .select()
    .from(loanReports)
    .where(and(...loanReportConditions));
  const combinedValue = totalValue + customReports.reduce((s, r) => s + Number(r.valueSold || 0), 0);
  const combinedDetails = [
    ...loans.map(l => ({
      id: l.id,
      employeeName: userNames[l.userId] || "N/A",
      amount: l.amount,
      detail: l.detail,
      status: l.status,
      date: l.createdAt,
      installmentAmount: l.installmentAmount,
      remainingAmount: l.remainingAmount,
      managerName: l.managerApprovedByUserId ? (userNames[l.managerApprovedByUserId] || "N/A") : null,
      hodName: l.hodApprovedByUserId ? (userNames[l.hodApprovedByUserId] || "N/A") : null,
    })),
    ...customReports.map(r => ({
      id: r.id,
      employeeName: "Custom Report",
      amount: r.valueSold ?? 0,
      detail: r.title || r.summary || "",
      status: r.status,
      date: r.reportDate,
      installmentAmount: 0,
      remainingAmount: 0,
      managerName: null,
      hodName: null,
    })),
  ];

  return {
    type: "loan",
    dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
    meta: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      timezone: tz,
    },
    metrics: {
      totalTasks: totalLoans + customReports.length,
      valueOfServiceSold: combinedValue,
      successRate: (totalLoans + customReports.length) > 0 ? clampPercentage((approvedLoans.length / (totalLoans + customReports.length)) * 100) : 0,
      followUpsCompleted: approvedLoans.length,
      missedLeads: rejectedLoans.length,
    },
    chartData,
    details: combinedDetails,
    totals: {
      totalAdvance: combinedValue,
      totalRemaining,
    },
  };
}

async function getVasReport(userIds: string[] | null, fromDate: Date, toDate: Date): Promise<ReportData> {
  // Fetch from office_vas instead of vas_progress_snapshots
  const vasConditions = [
    gte(officeVas.vasDate, fromDate),
    lte(officeVas.vasDate, toDate)
  ];
  if (userIds && userIds.length > 0) {
    vasConditions.push(inArray(officeVas.createdByUserId, userIds));
  }

  const vasEntries = await db
    .select()
    .from(officeVas)
    .where(and(...vasConditions));

  // Fetch approved invoices from productPostingInvoices
  const invoiceConditions = [
    gte(productPostingInvoices.updatedAt, fromDate),
    lte(productPostingInvoices.updatedAt, toDate),
    inArray(productPostingInvoices.status, ['PENDING_ACCOUNT', 'APPROVED']) // HOD approved
  ];
  if (userIds && userIds.length > 0) {
    invoiceConditions.push(inArray(productPostingInvoices.salesExecId, userIds));
  }

  const invoiceEntriesRaw = await db
    .select()
    .from(productPostingInvoices)
    .where(and(...invoiceConditions));

  // Fetch approved standard invoices
  const stdInvoiceConditions = [
    gte(invoices.updatedAt, fromDate),
    lte(invoices.updatedAt, toDate),
    inArray(invoices.status, ['Paid', 'APPROVED'] as any) // Account approved
  ];
  if (userIds && userIds.length > 0) {
    stdInvoiceConditions.push(inArray(invoices.createdByUserId, userIds));
  }

  const stdInvoiceEntriesRaw = await db
    .select()
    .from(invoices)
    .where(and(...stdInvoiceConditions));

  // Combine them
  const combinedDetails: any[] = [
    ...vasEntries.map(v => ({
      id: v.id,
      companyName: v.companyName,
      amount: v.amount,
      method: v.method,
      date: v.vasDate,
      notes: v.notes,
      type: "VAS",
      userId: v.createdByUserId || null,
    })),
    ...invoiceEntriesRaw.map(i => ({
      id: i.id,
      companyName: i.companyName || i.projectName || 'Invoice',
      amount: i.amount,
      method: i.paymentMethod || "BankTransfer",
      date: i.updatedAt,
      notes: `Invoice Status: ${i.status}`,
      type: "Invoice",
      userId: i.salesExecId || null,
    })),
    ...stdInvoiceEntriesRaw.map(i => ({
      id: i.id,
      companyName: i.customerName || 'Standard Invoice',
      amount: i.total,
      method: i.paymentMethod || "BankTransfer",
      date: i.updatedAt,
      notes: `Invoice Status: ${i.status}`,
      type: "Invoice",
      userId: i.createdByUserId || null,
    }))
  ];

  // Sort by date descending
  combinedDetails.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  // MD-18: attach each row's owning user's GM commission%/reward/final-commission
  // for the quarter containing that row's date. The VAS report itself has no
  // link to gm_entries (confirmed by research before this was written), so
  // these columns show the GM commission engine's (MD-16(c)) period-level
  // summary for that beneficiary/quarter — not a per-row VAS-transaction
  // commission, which was never a defined concept here. Batched per unique
  // (userId, quarterKey) pair to avoid an N+1 query pattern.
  const vasCommissionSummaryCache = new Map<string, Awaited<ReturnType<typeof getGmCommissionQuarterSummary>>>();
  const vasSyncedUserIds = new Set<string>();
  for (const row of combinedDetails) {
    if (!row.userId || !row.date) continue;
    const quarterKey = deriveQuarterKey(new Date(row.date));
    const cacheKey = `${row.userId}:${quarterKey}`;
    if (!vasCommissionSummaryCache.has(cacheKey)) {
      if (!vasSyncedUserIds.has(row.userId)) {
        vasSyncedUserIds.add(row.userId);
        await syncGmCommissionLedger(row.userId).catch((err) => console.error("[VAS report] GM commission sync failed:", err));
      }
      const summary = await getGmCommissionQuarterSummary(row.userId, quarterKey).catch(() => null);
      if (summary) vasCommissionSummaryCache.set(cacheKey, summary);
    }
    const summary = vasCommissionSummaryCache.get(cacheKey);
    row.commissionPercent = summary ? summary.effectiveRatePercent : 0;
    row.reward = summary ? summary.approvedReward : 0;
    row.finalCommission = summary ? summary.finalCommission : 0;
  }

  const totalValue = combinedDetails.reduce((sum, item) => sum + Number(item.amount), 0);
  const chartData = generateChartData(combinedDetails.map(d => ({ ...d, createdAt: d.date })), fromDate, toDate, 'amount');

  return {
    type: "vas",
    dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
    meta: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      timezone: tz,
    },
    metrics: {
      totalTasks: combinedDetails.length,
      valueOfServiceSold: totalValue,
      successRate: 100, // Not applicable for simple list
      followUpsCompleted: invoiceEntriesRaw.length + stdInvoiceEntriesRaw.length, // repurposing as invoice count for display if needed
      missedLeads: vasEntries.length, // repurposing as vas count
    },
    chartData,
    details: combinedDetails,
    totals: {
      totalAdvance: totalValue,
      totalRemaining: 0
    }
  };
}

async function getGmReport(userIds: string[] | null, fromDate: Date, toDate: Date): Promise<ReportData> {
  const conditions = [
    gte(gmEntries.createdAt, fromDate),
    lte(gmEntries.createdAt, toDate)
  ];

  if (userIds && userIds.length > 0) {
    conditions.push(
      or(
        inArray(gmEntries.salesPersonId, userIds),
        inArray(gmEntries.createdBy, userIds)
      )!
    );
  }

  const entries = await db
    .select()
    .from(gmEntries)
    .where(and(...conditions))
    .orderBy(desc(gmEntries.createdAt));

  const totalValue = entries.reduce((sum, e) => sum + Number(e.amountUsd || 0), 0);
  const chartData = generateChartData(entries.map(e => ({ ...e, createdAt: e.createdAt })), fromDate, toDate, 'amountUsd');

  return {
    type: "gm",
    dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
    meta: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      timezone: tz,
    },
    metrics: {
      totalTasks: entries.length,
      valueOfServiceSold: totalValue,
      successRate: 100,
      followUpsCompleted: 0,
      missedLeads: 0,
    },
    chartData,
    details: entries.map(e => ({
      id: e.id,
      companyName: e.companyName,
      package: e.packageType,
      kwa: "-", // Placeholder as not in schema
      psa: "-", // Placeholder as not in schema
      packageAmount: e.finalOrderUsd || e.amountUsd,
      method: e.paymentStatus || "BankTransfer", // Default to BankTransfer if missing
      bvSubmitDate: "-", // Placeholder
      bvDate: "-", // Placeholder
      person: e.salesPersonName,
      rcNew: e.entryType,
      date: e.createdAt,
      gmType: resolveStoredOrDerivedGmType(e),
    })),
  };
}

function generateChartData(data: any[], fromDate: Date, toDate: Date, valueField?: string) {
  const chartMap = new Map<string, { value: number; count: number }>();

  const current = new Date(fromDate);
  while (current <= toDate) {
    const dateKey = current.toISOString().split('T')[0];
    chartMap.set(dateKey, { value: 0, count: 0 });
    current.setDate(current.getDate() + 1);
  }

  data.forEach(item => {
    const dateKey = new Date(item.createdAt).toISOString().split('T')[0];
    if (chartMap.has(dateKey)) {
      const existing = chartMap.get(dateKey)!;
      existing.count += 1;
      if (valueField && item[valueField]) {
        existing.value += parseFloat(item[valueField]);
      }
    }
  });

  return Array.from(chartMap.entries()).map(([date, data]) => ({
    date,
    value: data.value,
    count: data.count,
  }));
}

function buildReportCsv(report: ReportData) {
  const lines: string[] = [];

  lines.push(`Report Type,${report.type.toUpperCase()}`);
  lines.push(`From,${report.meta.from}`);
  lines.push(`To,${report.meta.to}`);
  lines.push(`Timezone,${report.meta.timezone}`);
  lines.push("");
  lines.push("Metric,Value");
  lines.push(`Total Tasks,${report.metrics.totalTasks}`);
  lines.push(`Value Sold,${report.metrics.valueOfServiceSold}`);
  lines.push(`Success Rate,${report.metrics.successRate == null ? "N/A" : `${report.metrics.successRate}%`}`);
  lines.push(`Follow-ups Done,${report.metrics.followUpsCompleted == null ? "N/A" : report.metrics.followUpsCompleted}`);
  lines.push(`Missed Leads,${report.metrics.missedLeads == null ? "N/A" : report.metrics.missedLeads}`);

  lines.push("");
  lines.push("Date,Count,Value");
  report.chartData.forEach((row) => {
    lines.push(`${row.date},${row.count},${row.value}`);
  });

  if (report.details.length > 0) {
    lines.push("");
    switch (report.type) {
      case "loan": {
        lines.push("Date,Employee,Advance,Installment,Remaining,Status,Manager,HOD");
        report.details.forEach((item: any) => {
          lines.push(
            `${new Date(item.date).toISOString().split("T")[0]},` +
            `"${item.employeeName ?? ""}",` +
            `${item.amount ?? 0},` +
            `${item.installmentAmount ?? 0},` +
            `${item.remainingAmount ?? 0},` +
            `"${item.status ?? ""}",` +
            `"${item.managerName ?? ""}",` +
            `"${item.hodName ?? ""}"`
          );
        });
        break;
      }
      case "vas": {
        lines.push("Period,Amount,Target,Achievement%");
        report.details.forEach((item: any) => {
          const achievement =
            item.targetAmount && Number(item.targetAmount) > 0
              ? Math.round((Number(item.amount || 0) / Number(item.targetAmount)) * 100)
              : 0;
          lines.push(
            `${item.month}/${item.year},${item.amount ?? 0},${item.targetAmount ?? 0},${achievement}`
          );
        });
        break;
      }
      case "bv": {
        lines.push("Date,Title,Company,Author,Status,Total Tasks,Value Sold,Success Rate,Follow-ups,Missed Leads");
        report.details.forEach((item: any) => {
          lines.push(
            `${item.date ? new Date(item.date).toISOString().split("T")[0] : ""},` +
            `"${item.title ?? ""}",` +
            `"${item.companyName ?? ""}",` +
            `"${item.authorName ?? ""}",` +
            `"${item.status ?? ""}",` +
            `${item.totalTasks ?? 0},` +
            `${item.valueSold ?? 0},` +
            `${item.successRate ?? 0},` +
            `${item.followUpsDone ?? 0},` +
            `${item.missedLeads ?? 0}`
          );
        });
        break;
      }
      case "gm": {
        lines.push("Date,Company,Account,Grade");
        report.details.forEach((item: any) => {
          lines.push(
            `${new Date(item.date).toISOString().split("T")[0]},` +
            `"${item.companyName ?? ""}",` +
            `"${item.accountName ?? ""}",` +
            `"${item.grade ?? ""}"`
          );
        });
        break;
      }
      default:
        break;
    }
  }

  return lines.join("\n");
}

// Patch 2 Stage 5 — Daily Target Report (real data source).
// Replaces the former 501 stub. Reports each in-scope employee's assigned target,
// real approved-GM achievement, and live activity counts over a date window. No
// fabricated rows or metrics: missing targets are surfaced honestly as null +
// missingData. Gated by the report-permission matrix + row-scope. Registered
// BEFORE the /reports/:type catch-alls so it always wins routing for "day-target".

// Parse + validate query params. Dates are REQUIRED (the report is meaningless
// without a window). Returns a typed error message on any validation failure.
function parseDayTargetParams(
  req: any,
): { value: Omit<DayTargetQuery, "filterUserIds"> } | { error: string } {
  const startDate = (req.query.startDate ?? req.query.from) as string | undefined;
  const endDate = (req.query.endDate ?? req.query.to) as string | undefined;
  if (!startDate || !endDate) return { error: "Start date and end date are both required." };
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()))
    return { error: "Enter a valid start date and end date." };
  if (s.getTime() > e.getTime()) return { error: "Start date must be on or before the end date." };

  const fromDate = new Date(s);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(e);
  toDate.setHours(23, 59, 59, 999);

  let page = parseInt(String(req.query.page ?? "1"), 10);
  let limit = parseInt(String(req.query.limit ?? "25"), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = 25;
  if (limit > 200) limit = 200;

  const str = (v: any) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
  return {
    value: {
      fromDate,
      toDate,
      startDateStr: String(startDate).slice(0, 10),
      endDateStr: String(endDate).slice(0, 10),
      userId: req.query.userId && req.query.userId !== "all" ? String(req.query.userId) : null,
      ourTeam: req.query.ourTeam === "true" || req.query.ourTeam === true,
      department: str(req.query.department),
      role: str(req.query.role),
      targetType: str(req.query.targetType),
      page,
      limit,
    },
  };
}

// Row-scope for the daily target report. Mirrors resolveBvScope but fixes two
// holes the architect flagged: (1) account_manager has allowedIds === null (global
// in getDepartmentFilterUserIds) so a userId filter must return [userId], never the
// empty sentinel; (2) hr/hr_manager are granted view in the matrix but are not
// managerial — they get all-users here so the grant is meaningful. ourTeam only
// ever narrows, never widens, since the result is always bounded by `allowed`.
async function resolveDayTargetScope(req: any): Promise<string[] | null> {
  const user = req.user;
  const role = normalizeRole(user.activeRoleId ?? user.roleId);
  const queryUserId =
    typeof req.query.userId === "string" && req.query.userId !== "all" && req.query.userId !== ""
      ? req.query.userId
      : null;
  const ourTeam = req.query.ourTeam === "true" || req.query.ourTeam === true;

  const isGlobalAdmin = ["admin", "super_admin", "super_hod", "hod"].includes(role);
  const isHrViewer = ["hr", "hr_manager"].includes(role);

  let allowed: string[] | null;
  if (isGlobalAdmin || isHrViewer) {
    allowed = null; // all users
  } else if (!isManagerialRole(role)) {
    allowed = [String(user.userId)]; // executive: self only
  } else {
    allowed = await getDepartmentFilterUserIds(req); // team; account_manager → null (global)
  }

  if (queryUserId) {
    if (allowed === null) return [queryUserId];
    return allowed.includes(queryUserId)
      ? [queryUserId]
      : ["00000000-0000-0000-0000-000000000000"]; // not in scope → empty result
  }
  if (allowed === null) return null; // global admin / hr → all users
  if (ourTeam) return allowed; // manager → explicit team
  return [String(user.userId)]; // manager/executive default → self
}

router.get(
  "/reports/day-target",
  requireReportPermission("day_target", "view"),
  async (req, res) => {
    try {
      if (!req.user) return sendError(res, unauthorized("Not authenticated"));
      const parsed = parseDayTargetParams(req);
      if ("error" in parsed) {
        return res.status(400).json(errorEnvelope("VALIDATION_ERROR", parsed.error));
      }
      const filterUserIds = await resolveDayTargetScope(req);
      const report = await getDayTargetReport({ ...parsed.value, filterUserIds });
      return res.json(report);
    } catch (error) {
      console.error("Error fetching day-target report:", error);
      return res
        .status(500)
        .json(errorEnvelope("INTERNAL_ERROR", "Failed to fetch the daily target report"));
    }
  },
);

router.get(
  "/reports/day-target/export",
  requireReportPermission("day_target", "export"),
  async (req, res) => {
    try {
      if (!req.user) return sendError(res, unauthorized("Not authenticated"));
      const parsed = parseDayTargetParams(req);
      if ("error" in parsed) {
        return res.status(400).json(errorEnvelope("VALIDATION_ERROR", parsed.error));
      }
      const filterUserIds = await resolveDayTargetScope(req);
      // Export the full filtered result set (not just one page), honoring scope.
      const report = await getDayTargetReport({
        ...parsed.value,
        filterUserIds,
        page: 1,
        limit: 1_000_000,
      });
      const format = (typeof req.query.format === "string" ? req.query.format : "csv").toLowerCase();
      const suffix = `day_target_${report.filters.startDate}_${report.filters.endDate}_${exportTimestamp()}`;

      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="${suffix}.json"`);
        await ActivityLogService.log({
          userId: req.user.userId,
          action: "day_target.export",
          resourceType: "report",
          resourceId: "day_target",
          details: JSON.stringify({ format, from: report.filters.startDate, to: report.filters.endDate, count: report.rows.length }),
        });
        return res.send(JSON.stringify(report, null, 2));
      }

      if (format !== "csv") {
        return res.status(400).json(errorEnvelope("VALIDATION_ERROR", "Unsupported export format. Use csv or json."));
      }

      const csv = buildDayTargetCsv(report);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${suffix}.csv"`);
      await ActivityLogService.log({
        userId: req.user.userId,
        action: "day_target.export",
        resourceType: "report",
        resourceId: "day_target",
        details: JSON.stringify({ format, from: report.filters.startDate, to: report.filters.endDate, count: report.rows.length }),
      });
      return res.send(csv);
    } catch (error) {
      console.error("Error exporting day-target report:", error);
      return res
        .status(500)
        .json(errorEnvelope("INTERNAL_ERROR", "Failed to export the daily target report"));
    }
  },
);

// Patch 2 Stage 7 — BV Report canonical source (bv_reports). Registered BEFORE
// the /reports/:type catch-alls so it always wins for "bv". Gated by the BV
// report permission matrix + row-scope; metrics come from bv-report.service.
router.get("/reports/bv", requireReportPermission("bv_report", "view"), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { from, to } = bvDateParams(req);
    let parsedRange;
    try {
      parsedRange = parseDateRange(from, to);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || "Invalid date range" });
    }
    const filterResult = parseBvFilters(req);
    if (!filterResult.ok) {
      return res.status(400).json({ error: filterResult.error });
    }
    const { fromDate, toDate } = parsedRange;
    const filterUserIds = await resolveBvScope(req);
    const report = await getBvReportData(filterUserIds, fromDate, toDate, {
      ...filterResult.filters,
      ...parseBvPaging(req),
    });
    res.json(report);
  } catch (error) {
    console.error("Error fetching BV report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

router.get("/reports/bv/export", requireReportPermission("bv_report", "export"), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const format = (req.query.format as string) || "csv";
    const { from, to } = bvDateParams(req);
    let parsedRange;
    try {
      parsedRange = parseDateRange(from, to);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || "Invalid date range" });
    }
    const filterResult = parseBvFilters(req);
    if (!filterResult.ok) {
      return res.status(400).json({ error: filterResult.error });
    }
    const { fromDate, toDate } = parsedRange;
    const filterUserIds = await resolveBvScope(req);
    // Export reflects the same filters as the list but is never paginated, so the
    // exported row count always equals report.pagination.total / reportCount.
    const report = await getBvReportData(filterUserIds, fromDate, toDate, filterResult.filters);
    const userPart =
      typeof req.query.userId === "string" && req.query.userId && req.query.userId !== "all"
        ? `_user-${req.query.userId.slice(0, 8)}`
        : "_user-all";
    const statusPart = filterResult.filters.status
      ? `_${filterResult.filters.status.toLowerCase()}`
      : "";
    const suffix = `bv_report_${report.meta.from.slice(0, 10)}_${report.meta.to.slice(0, 10)}${userPart}${statusPart}_${exportTimestamp()}`;

    if (format === "csv") {
      const csvContent = buildReportCsv(report);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${suffix}.csv"`);
      await ActivityLogService.log({
        userId: req.user.userId,
        action: "bv_report.export",
        resourceType: "bv_report",
        resourceId: "bv",
        details: JSON.stringify({ format, from: report.meta.from, to: report.meta.to, count: report.reportCount }),
      });
      res.send(csvContent);
    } else if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${suffix}.json"`);
      await ActivityLogService.log({
        userId: req.user.userId,
        action: "bv_report.export",
        resourceType: "bv_report",
        resourceId: "bv",
        details: JSON.stringify({ format, from: report.meta.from, to: report.meta.to, count: report.reportCount }),
      });
      res.json(report);
    } else {
      res.status(400).json({ error: "Unsupported export format" });
    }
  } catch (error) {
    console.error("Error exporting BV report:", error);
    res.status(500).json({ error: "Failed to export report" });
  }
});

router.get("/reports/:type", async (req, res, next) => {
  const reportType = req.params.type as string;
  const specificRoutes = ["user-activities", "ledger", "gm-entries", "refund-entries", "invoice-entries", "users-list", "summary"];
  if (specificRoutes.includes(reportType)) {
    return next();
  }

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!["loan", "vas", "gm"].includes(reportType)) {
      return res.status(400).json({ error: "Invalid report type" });
    }

    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    let parsedRange;
    try {
      parsedRange = parseDateRange(from, to);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || "Invalid date range" });
    }
    const { fromDate, toDate } = parsedRange;

    const isPrivileged = isManagerialRole(user.roleId);
    const isGlobalAdmin = ["admin", "super_admin", "super_hod", "hod"].includes(normalizeRole(user.roleId));
    const queryUserId = typeof req.query.userId === "string" && req.query.userId !== "all" ? req.query.userId : null;
    
    let filterUserIds: string[] | null = null;
    if (!isPrivileged) {
      filterUserIds = [user.userId];
    } else if (isGlobalAdmin) {
      filterUserIds = queryUserId ? [queryUserId] : null;
    } else {
      const allowedIds = await getDepartmentFilterUserIds(req);
      if (queryUserId) {
        filterUserIds = allowedIds && allowedIds.includes(queryUserId) ? [queryUserId] : ['00000000-0000-0000-0000-000000000000'];
      } else {
        filterUserIds = allowedIds;
      }
    }

    let report: ReportData;
    switch (reportType) {
      case "loan":
        report = await getLoanReport(filterUserIds, fromDate, toDate);
        break;
      case "vas":
        report = await getVasReport(filterUserIds, fromDate, toDate);
        break;
      case "gm":
        report = await getGmReport(filterUserIds, fromDate, toDate);
        break;
      default:
        return res.status(400).json({ error: "Invalid report type" });
    }

    res.json(report);
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

router.get("/reports/:type/export", async (req, res, next) => {
  const reportType = req.params.type as string;
  const specificRoutes = ["user-activities", "ledger", "gm-entries", "refund-entries", "invoice-entries", "users-list", "summary"];
  if (specificRoutes.includes(reportType)) {
    return next();
  }

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const format = req.query.format as string || "csv";
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;

    let parsedRange;
    try {
      parsedRange = parseDateRange(from, to);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || "Invalid date range" });
    }
    const { fromDate, toDate } = parsedRange;

    const isPrivileged = isManagerialRole(user.roleId);
    const isGlobalAdmin = ["admin", "super_admin", "super_hod", "hod"].includes(normalizeRole(user.roleId));
    let filterUserIds: string[] | null = null;
    if (!isPrivileged) {
      filterUserIds = [user.userId];
    } else if (isGlobalAdmin) {
      filterUserIds = null;
    } else {
      filterUserIds = await getDepartmentFilterUserIds(req);
    }

    let report: ReportData;
    switch (reportType) {
      case "loan":
        report = await getLoanReport(filterUserIds, fromDate, toDate);
        break;
      case "vas":
        report = await getVasReport(filterUserIds, fromDate, toDate);
        break;
      case "gm":
        report = await getGmReport(filterUserIds, fromDate, toDate);
        break;
      default:
        return res.status(400).json({ error: "Invalid report type" });
    }

    const suffix = `${reportType}_report_${report.meta.from.slice(0, 10)}_${report.meta.to.slice(0, 10)}`;

    if (format === "csv") {
      const csvContent = buildReportCsv(report);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${suffix}.csv"`);
      res.send(csvContent);
    } else if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${suffix}.json"`);
      res.json(report);
    } else {
      res.status(400).json({ error: "Unsupported export format" });
    }
  } catch (error) {
    console.error("Error exporting report:", error);
    res.status(500).json({ error: "Failed to export report" });
  }
});

router.post("/reports/:type/email", async (req, res, next) => {
  const reportType = req.params.type as string;
  const specificRoutes = ["user-activities", "ledger", "gm-entries", "refund-entries", "invoice-entries", "users-list", "summary"];
  if (specificRoutes.includes(reportType)) {
    return next();
  }

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { recipient, includeDetails } = req.body;

    res.json({
      success: true,
      message: `Report will be sent to ${recipient || user.email}`,
      note: "Email integration pending - report data prepared successfully"
    });
  } catch (error) {
    console.error("Error emailing report:", error);
    res.status(500).json({ error: "Failed to email report" });
  }
});

router.get("/reports/summary", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    let parsedRange;
    try {
      parsedRange = parseDateRange(from, to);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || "Invalid date range" });
    }
    const { fromDate, toDate } = parsedRange;

    const isPrivileged = isManagerialRole(user.roleId);
    const isGlobalAdmin = ["admin", "super_admin", "super_hod", "hod"].includes(normalizeRole(user.roleId));
    let filterUserIds: string[] | null = null;
    if (!isPrivileged) {
      filterUserIds = [user.userId];
    } else if (isGlobalAdmin) {
      filterUserIds = null;
    } else {
      filterUserIds = await getDepartmentFilterUserIds(req);
    }

    const [loanReport, vasReport, gmReport, bvReport] = await Promise.all([
      getLoanReport(filterUserIds, fromDate, toDate),
      getVasReport(filterUserIds, fromDate, toDate),
      getGmReport(filterUserIds, fromDate, toDate),
      getBvReportData(filterUserIds, fromDate, toDate),
    ]);

    res.json({
      loan: loanReport.metrics,
      vas: vasReport.metrics,
      gm: gmReport.metrics,
      bv: bvReport.metrics,
      dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// User Activity Report
router.get("/reports/user-activities", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isPrivileged = isManagerialRole(req.user.roleId);
    const { userId, department, actionType, from, to, search, page = "1", pageSize = "20" } = req.query;

    const conditions = [];

    const requestedUserId = userId as string | undefined;
    if (!isPrivileged) {
      if (requestedUserId && requestedUserId !== req.user.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      conditions.push(eq(userActivities.userId, req.user.userId));
    } else if (requestedUserId) {
      conditions.push(eq(userActivities.userId, requestedUserId));
    }
    if (department) {
      conditions.push(eq(userActivities.department, department as string));
    }
    if (actionType) {
      conditions.push(eq(userActivities.actionType, actionType as any));
    }
    if (from) {
      conditions.push(gte(userActivities.activityDate, new Date(from as string)));
    }
    if (to) {
      conditions.push(lte(userActivities.activityDate, new Date(to as string)));
    }
    if (search) {
      conditions.push(
        or(
          ilike(userActivities.userName, `%${search}%`),
          sql`${userActivities.companyName} ILIKE ${'%' + search + '%'}`,
          sql`${userActivities.actionDescription} ILIKE ${'%' + search + '%'}`
        )
      );
    }

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // STUBBED: user_activities table missing, returning empty result to prevent crash
    const activities: any[] = [];
    const countResult = [{ count: 0 }];

    /*
    const [activities, countResult] = await Promise.all([
      db.select()
        .from(userActivities)
        .where(whereClause)
        .orderBy(desc(userActivities.activityDate))
        .limit(pageSizeNum)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(userActivities)
        .where(whereClause)
    ]);
    */

    res.json({
      data: activities,
      total: Number(countResult[0]?.count || 0),
      page: pageNum,
      pageSize: pageSizeNum
    });
  } catch (error: any) {
    console.error("Error fetching user activities:", error);
    res.status(500).json({ error: error.message });
  }
});

// Ledger Report with summary
router.get("/reports/ledger", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const isPrivileged = isManagerialRole(user.roleId);
    const { company, from, to, page = "1", pageSize = "20" } = req.query;

    const conditions = [];

    if (!isPrivileged) {
      conditions.push(eq(ledgerEntries.createdByUserId, user.userId));
    }

    if (company) {
      conditions.push(ilike(ledgerEntries.description, `%${company}%`));
    }
    if (from) {
      conditions.push(gte(ledgerEntries.entryDate, new Date(from as string)));
    }
    if (to) {
      conditions.push(lte(ledgerEntries.entryDate, new Date(to as string)));
    }
    const contact = req.query.contact as string | undefined;
    const ntn = req.query.ntn as string | undefined;

    if (contact || ntn) {
      // If filtering by contact or ntn, we might need more complex logic, but for now 
      // let's assume they are stored in description or we can filter by joining if needed.
      // However, to keep it simple and robust, we'll check description/notes for these identifiers.
      const orConditions = [];
      if (contact) orConditions.push(ilike(ledgerEntries.description, `%${contact}%`));
      if (ntn) orConditions.push(ilike(ledgerEntries.description, `%${ntn}%`));
      if (orConditions.length > 0) conditions.push(or(...orConditions));
    }

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [entries, countResult] = await Promise.all([
      db.select()
        .from(ledgerEntries)
        .where(whereClause)
        .orderBy(desc(ledgerEntries.entryDate))
        .limit(pageSizeNum)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(ledgerEntries)
        .where(whereClause)
    ]);

    // Calculate summary based on category field (GM, Invoice, Refund, Donation, etc.)
    const summaryResult = await db.select({
      totalGM: sql<number>`COALESCE(SUM(CASE WHEN category ILIKE '%GM%' THEN amount ELSE 0 END), 0)`,
      totalRefund: sql<number>`COALESCE(SUM(CASE WHEN category ILIKE '%Refund%' THEN amount ELSE 0 END), 0)`,
      totalInvoice: sql<number>`COALESCE(SUM(CASE WHEN category ILIKE '%Invoice%' THEN amount ELSE 0 END), 0)`,
      totalDonation: sql<number>`COALESCE(SUM(CASE WHEN category ILIKE '%Donation%' THEN amount ELSE 0 END), 0)`,
    }).from(ledgerEntries).where(whereClause);

    res.json({
      data: entries,
      total: Number(countResult[0]?.count || 0),
      page: pageNum,
      pageSize: pageSizeNum,
      summary: {
        totalGM: Number(summaryResult[0]?.totalGM || 0),
        totalRefund: Number(summaryResult[0]?.totalRefund || 0),
        totalInvoice: Number(summaryResult[0]?.totalInvoice || 0),
        totalDonation: Number(summaryResult[0]?.totalDonation || 0),
        outstandingDues: Number(summaryResult[0]?.totalInvoice || 0) - Number(summaryResult[0]?.totalGM || 0)
      }
    });
  } catch (error: any) {
    console.error("Error fetching ledger report:", error);
    res.status(500).json({ error: error.message });
  }
});

// GM Entries Report
router.get("/reports/gm-entries", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const isPrivileged = isManagerialRole(user.roleId);
    const { company, office, from, to, page = "1", pageSize = "20" } = req.query;

    const conditions = [];

    if (!isPrivileged) {
      conditions.push(
        or(
          eq(gmEntries.salesPersonId, user.userId),
          eq(gmEntries.createdBy, user.userId)
        )
      );
    }

    if (company) {
      conditions.push(ilike(gmEntries.companyName, `%${company}%`));
    }
    if (from) {
      conditions.push(gte(gmEntries.createdAt, new Date(from as string)));
    }
    if (to) {
      conditions.push(lte(gmEntries.createdAt, new Date(to as string)));
    }

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [entries, countResult, totalResult] = await Promise.all([
      db.select()
        .from(gmEntries)
        .where(whereClause)
        .orderBy(desc(gmEntries.createdAt))
        .limit(pageSizeNum)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(gmEntries)
        .where(whereClause),
      db.select({ total: sql<number>`COALESCE(SUM(amount_usd), 0)` })
        .from(gmEntries)
        .where(whereClause)
    ]);

    res.json({
      data: entries,
      total: Number(countResult[0]?.count || 0),
      totalAmount: Number(totalResult[0]?.total || 0),
      page: pageNum,
      pageSize: pageSizeNum
    });
  } catch (error: any) {
    console.error("Error fetching GM entries report:", error);
    res.status(500).json({ error: error.message });
  }
});

// Refund Report
router.get("/reports/refund-entries", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const isPrivileged = isManagerialRole(user.roleId);
    const { company, from, to, page = "1", pageSize = "20" } = req.query;

    const conditions = [];

    if (!isPrivileged) {
      conditions.push(eq(refundGmEntries.createdByUserId, user.userId));
    }

    if (company) {
      conditions.push(ilike(refundGmEntries.companyName, `%${company}%`));
    }
    if (from) {
      conditions.push(gte(refundGmEntries.createdAt, new Date(from as string)));
    }
    if (to) {
      conditions.push(lte(refundGmEntries.createdAt, new Date(to as string)));
    }

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [entries, countResult, totalResult] = await Promise.all([
      db.select()
        .from(refundGmEntries)
        .where(whereClause)
        .orderBy(desc(refundGmEntries.createdAt))
        .limit(pageSizeNum)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(refundGmEntries)
        .where(whereClause),
      db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(refundGmEntries)
        .where(whereClause)
    ]);

    res.json({
      data: entries,
      total: Number(countResult[0]?.count || 0),
      totalAmount: Number(totalResult[0]?.total || 0),
      page: pageNum,
      pageSize: pageSizeNum
    });
  } catch (error: any) {
    console.error("Error fetching refund entries report:", error);
    res.status(500).json({ error: error.message });
  }
});

// Invoice Report
router.get("/reports/invoice-entries", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const isPrivileged = isManagerialRole(user.roleId);
    const { company, from, to, status, page = "1", pageSize = "20" } = req.query;

    const conditions = [];

    if (!isPrivileged) {
      conditions.push(eq(invoices.createdByUserId, user.userId));
    }

    if (company) {
      conditions.push(ilike(invoices.customerName, `%${company}%`));
    }
    if (from) {
      conditions.push(gte(invoices.issueDate, new Date(from as string)));
    }
    if (to) {
      conditions.push(lte(invoices.issueDate, new Date(to as string)));
    }
    if (status) {
      conditions.push(eq(invoices.status, status as any));
    }

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [entries, countResult, totalResult] = await Promise.all([
      db.select()
        .from(invoices)
        .where(whereClause)
        .orderBy(desc(invoices.issueDate))
        .limit(pageSizeNum)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(invoices)
        .where(whereClause),
      db.select({ total: sql<number>`COALESCE(SUM(total), 0)` })
        .from(invoices)
        .where(whereClause)
    ]);

    res.json({
      data: entries,
      total: Number(countResult[0]?.count || 0),
      totalAmount: Number(totalResult[0]?.total || 0),
      page: pageNum,
      pageSize: pageSizeNum
    });
  } catch (error: any) {
    console.error("Error fetching invoice entries report:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/reports/users-list", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isPrivileged = isManagerialRole(req.user.roleId);
    if (!isPrivileged) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      branch: users.branch
    }).from(users);

    res.json(allUsers);
  } catch (error: any) {
    console.error("Error fetching users list:", error);
    res.status(500).json({ error: error.message });
  }
});

// CSV Export for reports
router.get("/reports/:reportType/export-csv", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const isPrivileged = isManagerialRole(user.roleId);
    const { reportType } = req.params;
    const { company, from, to } = req.query;

    // Data-scope note (documented, not changed): this export already scopes by
    // isPrivileged (any manager sees all records of this type; an individual
    // contributor sees only their own, via the same eq(createdBy/salesPersonId,
    // user.userId) condition used by each branch's view). That is the correct,
    // already-established audience for this general-purpose staff export — it
    // is NOT an Office-Accounts-only surface, so FINANCIAL_VIEW_ROLES (admin/
    // account_manager/super_hod only) would wrongly break existing access for
    // every other department's managers/executives exporting their own team's
    // data. The genuine gap here (P00's "weakest financial export surface")
    // was the missing audit trail, added below.
    void ActivityLogService.log({
      userId: user.userId,
      action: "reports.export_csv",
      resourceType: "report_export",
      resourceId: reportType,
      details: JSON.stringify({ company: company ?? null, from: from ?? null, to: to ?? null, scopedToSelf: !isPrivileged }),
    });

    let data: any[] = [];
    let filename = "";
    let headers = "";

    const fromDate = from ? new Date(from as string) : undefined;
    const toDate = to ? new Date(to as string) : undefined;

    if (reportType === "gm-entries") {
      const conditions = [];
      if (!isPrivileged) {
        conditions.push(
          or(
            eq(gmEntries.salesPersonId, user.userId),
            eq(gmEntries.createdBy, user.userId)
          )
        );
      }
      if (company) conditions.push(ilike(gmEntries.companyName, `%${company}%`));
      if (fromDate) conditions.push(gte(gmEntries.createdAt, fromDate));
      if (toDate) conditions.push(lte(gmEntries.createdAt, toDate));

      data = await db.select().from(gmEntries).where(conditions.length > 0 ? and(...conditions) : undefined);
      headers = "ID,Company,Amount USD,Status,Entry Type,Date,Sales Person";
      filename = "gm_report.csv";

      const csvContent = headers + "\n" + data.map(e =>
        `${e.id},"${e.companyName}",${e.amountUsd},${e.status},${e.entryType},${e.createdAt?.toISOString().split('T')[0]},${e.salesPersonName || ''}`
      ).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csvContent);

    } else if (reportType === "refund-entries") {
      const conditions = [];
      if (!isPrivileged) conditions.push(eq(refundGmEntries.createdByUserId, user.userId));
      if (company) conditions.push(ilike(refundGmEntries.companyName, `%${company}%`));
      if (fromDate) conditions.push(gte(refundGmEntries.createdAt, fromDate));
      if (toDate) conditions.push(lte(refundGmEntries.createdAt, toDate));

      data = await db.select().from(refundGmEntries).where(conditions.length > 0 ? and(...conditions) : undefined);
      headers = "ID,Company,Person Name,Amount,Amount Type,Status,Date,Created By";
      filename = "refund_report.csv";

      const csvContent = headers + "\n" + data.map(e =>
        `${e.id},"${e.companyName}","${e.personName}",${e.amount},${e.amountType},${e.status},${e.createdAt?.toISOString().split('T')[0]},${e.createdByUserId}`
      ).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csvContent);

    } else if (reportType === "invoice-entries") {
      const conditions = [];
      if (!isPrivileged) conditions.push(eq(invoices.createdByUserId, user.userId));
      if (company) conditions.push(ilike(invoices.customerName, `%${company}%`));
      if (fromDate) conditions.push(gte(invoices.issueDate, fromDate));
      if (toDate) conditions.push(lte(invoices.issueDate, toDate));

      data = await db.select().from(invoices).where(conditions.length > 0 ? and(...conditions) : undefined);
      headers = "ID,Invoice Number,Customer,Total,Currency,Status,Issue Date,Created By";
      filename = "invoice_report.csv";

      const csvContent = headers + "\n" + data.map(e =>
        `${e.id},"${e.invoiceNumber}","${e.customerName}",${e.total},${e.currency},${e.status},${e.issueDate?.toISOString().split('T')[0]},${e.createdByUserId}`
      ).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csvContent);

    } else if (reportType === "ledger") {
      const conditions = [];
      if (!isPrivileged) conditions.push(eq(ledgerEntries.createdByUserId, user.userId));
      if (company) conditions.push(ilike(ledgerEntries.description, `%${company}%`));
      if (fromDate) conditions.push(gte(ledgerEntries.entryDate, fromDate));
      if (toDate) conditions.push(lte(ledgerEntries.entryDate, toDate));

      data = await db.select().from(ledgerEntries).where(conditions.length > 0 ? and(...conditions) : undefined);
      headers = "ID,Description,Entry Type,Category,Reference ID,Amount,Currency,Date,Created By";
      filename = "ledger_report.csv";

      const csvContent = headers + "\n" + data.map(e =>
        `${e.id},"${e.description}",${e.entryType},${e.category},${e.referenceId || ''},${e.amount},${e.currency},${e.entryDate?.toISOString().split('T')[0]},${e.createdByUserId}`
      ).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csvContent);

    } else {
      res.status(400).json({ error: "Invalid report type" });
    }
  } catch (error: any) {
    console.error("Error exporting CSV:", error);
    res.status(500).json({ error: error.message });
  }
});

export function registerReportsRoutes(app: Express) {
  app.use("/api", router);
}

export default router;
