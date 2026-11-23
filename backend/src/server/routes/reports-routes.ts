import { Router, type Express } from "express";
import { getDepartmentFilterUserIds } from "./dashboard-routes";
import { normalizeRole, ROLES } from "../utils/role-utils";
import { db, pool } from "../db";
import { mapToCanonical } from "../utils/gm-bv-state-machine";
import { resolveStoredOrDerivedGmType } from "../../shared/gm-sales-constants";
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
  targetSystemUserTargets,
} from "@shared/schema";
import { eq, and, gte, lte, sql, count, ilike, or, desc, inArray } from "drizzle-orm";
import { bvReportsRepository, ensureBvReportsSchema } from "../repositories/bv-reports.repository";
import {
  loanReportsRepository,
  vasReportsRepository,
  gmReportsRepository,
} from "../repositories/generic-report.repository";
import { isManagerialRole } from "../utils/role-utils";

/** Columns that exist on all deployed DBs (invoice_number may be absent until ensure runs). */
const productPostingInvoiceVasFields = {
  id: productPostingInvoices.id,
  companyName: productPostingInvoices.companyName,
  projectName: productPostingInvoices.projectName,
  amount: productPostingInvoices.amount,
  paymentMethod: productPostingInvoices.paymentMethod,
  updatedAt: productPostingInvoices.updatedAt,
  status: productPostingInvoices.status,
  salesExecId: productPostingInvoices.salesExecId,
  accountsApprovedAt: productPostingInvoices.accountsApprovedAt,
};

/** Omit schema-only columns (e.g. quotation_id) that may not exist until ensure runs. */
const standardInvoiceVasFields = {
  id: invoices.id,
  customerName: invoices.customerName,
  total: invoices.total,
  paymentMethod: invoices.paymentMethod,
  updatedAt: invoices.updatedAt,
  status: invoices.status,
  createdByUserId: invoices.createdByUserId,
  currency: invoices.currency,
  dollarRate: invoices.dollarRate,
  items: invoices.items, // item names -> Department Wise Summary (new-app invoices)
  paidAt: invoices.paidAt,
};
// Paid invoices are dated by paid_at; new-app approvals may not stamp paid_at, so fall
// back to updated_at. (Migrated old-DRM invoices all have updated_at = import day, which
// put every old VAS invoice on 2026-11-04 instead of its real payment date.)
const invoicePaidDate = sql`COALESCE(${invoices.paidAt}, ${invoices.updatedAt})`;
import { sendError, errorEnvelope, badRequest, unauthorized, forbidden, notFound, sendApiError } from "../utils/api-error";
import { requireReportPermission, resolveReportRoles } from "./middleware/report-permission";
import { requireFinancialPermission, FINANCIAL_ACTIONS, FINANCIAL_VIEW_ROLES } from "./middleware/financial-permission";
import { ActivityLogService } from "./services/activity-service";
import { exportTimestamp } from "../utils/export-filename";
import { getBvReportData, type BvReportFilters } from "./services/bv-report.service";
import {
  getDayTargetReport,
  buildDayTargetCsv,
  type DayTargetQuery,
} from "./services/day-target.service";
import { loadRoleTitles, userRoleInfo } from "../utils/user-role-titles";

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
    if (req.query.status) add("g.status::text = $$", String(req.query.status));
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
        left join led on led.reference_id::text = gm.id::text
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
    totalComm?: number;
    totalReward?: number;
    totalVas?: number;
    totalKwa?: number;
  };
  meta: {
    from: string;
    to: string;
    timezone: string;
  };
  reportCount?: number;
  personAchievement?: { personId: string; targetName: string; targetQuota: number | null; achievedCount: number }[];
  // BV Report (?scope=company), single user selected: the old DRM footer row.
  footer?: BvLegacyFooter | null;
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
  // Use the role the user is *acting as* (sidebar role switcher), not only the
  // base account role — otherwise "Acting as: account_manager" still scoped like
  // a sales executive and the BV Pending list came back empty.
  const actingRole = normalizeRole((req.user as any)?.activeRoleId ?? user.roleId);
  const queryUserId =
    typeof req.query.userId === "string" && req.query.userId !== "all" ? req.query.userId : null;

  if (actingRole === ROLES.SALES_MANAGER) return [user.userId];

  const companyWideBvRoles = [
    "admin",
    "super_admin",
    "super_hod",
    "hod",
    ROLES.ACCOUNT_MANAGER,
  ];
  if (companyWideBvRoles.includes(actingRole)) {
    return queryUserId ? [queryUserId] : null;
  }

  const isPrivileged = isManagerialRole(actingRole);
  if (!isPrivileged) return [user.userId];

  const allowedIds = await getDepartmentFilterUserIds(req);
  if (queryUserId) {
    return (allowedIds === null || allowedIds.includes(queryUserId))
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

function mapLegacyAdvanceStatus(row: { status?: string | null; manager?: string | null; hod?: string | null }): string {
  const s = String(row.status ?? "").trim();
  if (s === "Rejected" || s === "Complete" || s === "Completed") return s === "Complete" ? "Completed" : s;
  if (String(row.hod ?? "").trim() === "Approved") return "HODApproved";
  if (String(row.manager ?? "").trim() === "Approved") return "ManagerApproved";
  return s || "Pending";
}

/** Old webxl_addvance_salary rows not linked to drm.loan_requests (migration gaps). */
async function legacyAdvanceLoanDetails(userIds: string[] | null, userNames: Record<string, string>): Promise<any[]> {
  const params: unknown[] = [];
  let userWhere = "";
  if (userIds && userIds.length > 0) {
    params.push(userIds);
    userWhere = `AND m.modern_id = ANY($${params.length}::text[])`;
  }
  const r = await pool.query(
    `SELECT a.id::text AS legacy_id, m.modern_id AS user_id, a.salary, a.instalment, a.detail, a.remaning,
            a.status, a.manager, a.hod, a.create_date, u.name AS legacy_name
       FROM legacy_archive.webxl_addvance_salary a
       JOIN legacy_archive.webxl_user u ON u.user_id = a.user_id
       JOIN migration_meta.migration_legacy_ids m
         ON m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.legacy_id = a.user_id
      WHERE m.modern_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM migration_meta.migration_legacy_ids ml
           WHERE ml.legacy_table = 'webxl_addvance_salary' AND ml.legacy_id = a.id::text
        )
        ${userWhere}`,
    params,
  );
  return r.rows.map((a: any) => {
    const uid = String(a.user_id);
    const amount = parseFloat(String(a.salary ?? "0")) || 0;
    const installment = parseFloat(String(a.instalment ?? "0")) || 0;
    const remaining = parseFloat(String(a.remaning ?? "0")) || 0;
    const created = a.create_date && /^\d{4}-\d{2}/.test(String(a.create_date))
      ? new Date(String(a.create_date).replace(" ", "T"))
      : new Date();
    return {
      id: `legacy-adv-${a.legacy_id}`,
      userId: uid,
      employeeName: userNames[uid] || a.legacy_name || "N/A",
      amount,
      detail: a.detail ?? "",
      status: mapLegacyAdvanceStatus(a),
      date: created,
      installmentAmount: installment,
      remainingAmount: remaining,
      managerName: null,
      hodName: null,
      source: "legacy",
    };
  });
}

async function getLoanReport(userIds: string[] | null, fromDate: Date, toDate: Date): Promise<ReportData> {
  // Old DRM's Advance Salary List shows every loan (no date window), newest first.
  // The page has no date picker, so the from/to range is not applied to loans.
  const whereConditions: any[] = [];
  if (userIds && userIds.length > 0) {
    whereConditions.push(inArray(loanRequests.userId, userIds));
  }

  const loans = await db
    .select()
    .from(loanRequests)
    .where(whereConditions.length ? and(...whereConditions) : undefined)
    .orderBy(desc(loanRequests.createdAt));

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
  const legacyExtra = await legacyAdvanceLoanDetails(userIds, userNames);
  const combinedValue =
    totalValue + legacyExtra.reduce((s, r) => s + Number(r.amount || 0), 0)
    + customReports.reduce((s, r) => s + Number(r.valueSold || 0), 0);
  const combinedDetails = [
    ...loans.map(l => ({
      id: l.id,
      userId: l.userId,
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
    ...legacyExtra,
    ...customReports.map(r => ({
      id: r.id,
      userId: r.userId ?? null,
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
  ].sort((a, b) => new Date(b.date as Date).getTime() - new Date(a.date as Date).getTime());

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
      totalRepaid: combinedValue - totalRemaining,
    },
  };
}

/**
 * VAS Report -> "Department Wise Summary" (old DRM vasreport): the value of each
 * paid invoice split across the departments of its items.
 *  - Old-DRM invoices: webxl_dep_project_comm per invoice - items[i] (pkr) and deps[i]
 *    (department id -> webxl_department name) line up by position; the invoice value is
 *    split in proportion to item pkr (equally when all items are 0). Items without a
 *    department -> "Unknown" (same as the old report).
 *  - New-app invoices: by item name, using the department that item name was most
 *    often routed to in the old data; otherwise "Unknown".
 *  - Product-posting invoices: "Product Posting".
 */
// Old item name -> department map is static archive data; rebuild at most every 10 min.
let vasNameToDepCache: { at: number; map: Map<string, string> } | null = null;

async function vasDepartmentSummary(
  rows: { invoiceId: string; source: string; value: number; itemNames: string[] }[],
): Promise<{ department: string; amount: number }[]> {
  const totals = new Map<string, number>();
  const add = (dep: string, amt: number) => totals.set(dep, (totals.get(dep) ?? 0) + amt);
  const invoiceRows = rows.filter((r) => r.source === "invoice" && r.value !== 0);
  for (const r of rows) if (r.source === "product_posting_invoice" && r.value !== 0) add("Product Posting", r.value);
  if (invoiceRows.length === 0) return Array.from(totals, ([department, amount]) => ({ department, amount }));

  const depNames = new Map<string, string>();
  const byInvoice = new Map<string, { pkr: number; dep: string | null }[]>();
  const nameToDep = new Map<string, string>();
  try {
    const { rows: deps } = await pool.query(
      `SELECT id::text AS id, btrim(name) AS name FROM legacy_archive.webxl_department`,
    );
    for (const d of deps) depNames.set(String(d.id), String(d.name).replace(/\s+/g, " ").trim());
    const { rows: comm } = await pool.query(
      `SELECT m.modern_id, c.items, c.deps
         FROM migration_meta.migration_legacy_ids m
         JOIN legacy_archive.webxl_dep_project_comm c ON c.inv_id = m.legacy_id
        WHERE m.legacy_table = 'webxl_invoice' AND m.modern_id = ANY($1::text[])`,
      [invoiceRows.map((r) => r.invoiceId)],
    );
    for (const c of comm) {
      let items: any[] = [];
      let depList: any[] = [];
      try { items = JSON.parse(c.items || "[]"); } catch { items = []; }
      try { depList = JSON.parse(c.deps || "[]"); } catch { depList = []; }
      const list = byInvoice.get(c.modern_id) ?? [];
      const n = Math.max(items.length, depList.length);
      for (let i = 0; i < n; i++) {
        const depId = depList[i]?.dep != null ? String(depList[i].dep) : null;
        list.push({ pkr: Number(items[i]?.pkr) || 0, dep: depId ? depNames.get(depId) ?? null : null });
      }
      byInvoice.set(c.modern_id, list);
    }
    if (invoiceRows.some((r) => !byInvoice.has(r.invoiceId)) && vasNameToDepCache && Date.now() - vasNameToDepCache.at < 600_000) {
      for (const [k, v] of Array.from(vasNameToDepCache.map)) nameToDep.set(k, v);
    } else if (invoiceRows.some((r) => !byInvoice.has(r.invoiceId))) {
      // item name -> most common old department (for invoices created in the new app)
      const { rows: allComm } = await pool.query(`SELECT items, deps FROM legacy_archive.webxl_dep_project_comm`);
      const counts = new Map<string, Map<string, number>>();
      for (const c of allComm) {
        let items: any[] = [];
        let depList: any[] = [];
        try { items = JSON.parse(c.items || "[]"); } catch { continue; }
        try { depList = JSON.parse(c.deps || "[]"); } catch { continue; }
        items.forEach((it: any, idx: number) => {
          const project = String(it?.project ?? "").trim().toLowerCase();
          const dep = depList[idx]?.dep != null ? String(depList[idx].dep) : "";
          if (!project || !dep) return;
          const m = counts.get(project) ?? new Map<string, number>();
          m.set(dep, (m.get(dep) ?? 0) + 1);
          counts.set(project, m);
        });
      }
      for (const [project, m] of Array.from(counts)) {
        const best = Array.from(m).sort((a, b) => b[1] - a[1])[0];
        const name = best ? depNames.get(best[0]) : undefined;
        if (name) nameToDep.set(project, name);
      }
      vasNameToDepCache = { at: Date.now(), map: new Map(nameToDep) };
    }
  } catch (err) {
    console.error("[vas-report] department summary lookup failed", err);
  }

  for (const r of invoiceRows) {
    let parts = byInvoice.get(r.invoiceId);
    if (!parts || parts.length === 0) {
      parts = (r.itemNames.length ? r.itemNames : [""]).map((nm) => ({
        pkr: 0,
        dep: nameToDep.get(nm.trim().toLowerCase()) ?? null,
      }));
    }
    const weightSum = parts.reduce((s, p) => s + p.pkr, 0);
    for (const p of parts) {
      const share = weightSum > 0 ? p.pkr / weightSum : 1 / parts.length;
      add(p.dep || "Unknown", r.value * share);
    }
  }
  return Array.from(totals, ([department, amount]) => ({ department, amount: Math.round(amount * 100) / 100 }))
    .filter((d) => d.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
}

export async function getVasReport(userIds: string[] | null, fromDate: Date, toDate: Date): Promise<ReportData> {
  // Reports module's own VAS Report — source of truth is `vas_reports`, the
  // table the "+ New VAS Report" form (POST /api/vas-reports) actually saves
  // to. Deliberately independent from the unrelated Office Account -> VAS
  // feature (`office_vas` table / /api/office/vas), which has its own page
  // and must not be touched by this report.
  const vasConditions = [
    gte(vasReports.reportDate, fromDate),
    lte(vasReports.reportDate, toDate),
  ];
  if (userIds && userIds.length > 0) {
    vasConditions.push(inArray(vasReports.userId, userIds));
  }

  const rows = await db
    .select()
    .from(vasReports)
    .where(and(...vasConditions))
    .orderBy(desc(vasReports.reportDate));

  // Only fields actually stored on vas_reports are surfaced here. No
  // company/amount/method/commission values are fabricated — the current
  // form/table has no such fields (see customerId note below).
  const vasReportDetails: any[] = rows.map(r => ({
    id: r.id,
    title: r.title,
    // vas_reports has no company/method concept — left null (rendered as
    // "—") rather than fabricated, unlike the merged invoice rows below
    // which have real company/method values.
    company: null,
    method: null,
    status: r.status,
    date: r.reportDate,
    createdAt: r.reportDate,
    summary: r.summary,
    notes: r.notes,
    totalTasks: Number(r.totalTasks) || 0,
    valueSold: Number(r.valueSold) || 0,
    successRate: Number(r.successRate) || 0,
    followUpsDone: Number(r.followUpsDone) || 0,
    missedLeads: Number(r.missedLeads) || 0,
    // Raw stored value only — not resolved to a customer name. vas_reports.customer_id
    // is a `varchar` column while customers.id is `uuid`; joining them would be an
    // unverified type cast, so it's left as-is rather than risk a bad lookup.
    customerId: r.customerId,
    userId: r.userId,
    source: "vas_reports",
  }));

  // Per explicit request: also surface the selected user's invoices that have
  // been approved by Account, alongside their vas_reports entries. "Approved
  // by Account" uses the exact status values the real approval endpoints set
  // (verified against account-routes.ts / product-posting-workflow-routes.ts,
  // not guessed):
  //   - product_posting_invoices: status 'APPROVED' only — 'PENDING_ACCOUNT'
  //     means HOD approved, still awaiting Account, so it's excluded. Dated
  //     by accounts_approved_at, which the approval endpoint stamps.
  //   - invoices: status 'Paid' — the only Account-approved value in the
  //     invoice_status enum ('Approved' does not exist in it). Dated by
  //     updated_at because the approval transition does not populate paid_at.
  // totalTasks/successRate/followUpsDone/missedLeads are genuinely not
  // tracked per-invoice, so they're left `null` (rendered as "—") rather than
  // a fabricated 0.
  const productInvoiceConditions = [
    eq(productPostingInvoices.status, "APPROVED"),
    gte(productPostingInvoices.accountsApprovedAt, fromDate),
    lte(productPostingInvoices.accountsApprovedAt, toDate),
  ];
  if (userIds && userIds.length > 0) {
    productInvoiceConditions.push(inArray(productPostingInvoices.salesExecId, userIds));
  }
  const approvedProductInvoices = await db
    .select(productPostingInvoiceVasFields)
    .from(productPostingInvoices)
    .where(and(...productInvoiceConditions));

  const standardInvoiceConditions = [
    eq(invoices.status, "Paid"),
    sql`${invoicePaidDate} >= ${fromDate}`,
    sql`${invoicePaidDate} <= ${toDate}`,
  ];
  if (userIds && userIds.length > 0) {
    standardInvoiceConditions.push(inArray(invoices.createdByUserId, userIds));
  }
  const approvedStandardInvoices = await db
    .select(standardInvoiceVasFields)
    .from(invoices)
    .where(and(...standardInvoiceConditions));
  // Old-DRM invoices were migrated with currency "USD", but their totals are already
  // PKR (legacy grand_total; doller_rate was only informational) - never convert them.
  const legacyInvoiceIds = new Set<string>();
  if (approvedStandardInvoices.length > 0) {
    const { rows: legacyRows } = await pool.query(
      `SELECT modern_id FROM migration_meta.migration_legacy_ids
        WHERE legacy_table = 'webxl_invoice' AND modern_id = ANY($1::text[])`,
      [approvedStandardInvoices.map((i) => i.id)],
    );
    for (const r of legacyRows) legacyInvoiceIds.add(String(r.modern_id));
  }

  const invoiceDetails: any[] = [
    ...approvedProductInvoices.map(i => ({
      id: i.id,
      title: `Invoice: ${i.companyName || i.projectName || "Untitled"}`,
      company: i.companyName || i.projectName || null,
      method: i.paymentMethod || null,
      status: i.status,
      date: i.accountsApprovedAt,
      createdAt: i.accountsApprovedAt,
      summary: null,
      notes: null,
      totalTasks: null,
      // Unlike `invoices`, product_posting_invoices has no stored exchange
      // rate anywhere (confirmed: other code that unions this table hardcodes
      // its rate as NULL) — there is no real USD->PKR rate to apply, so this
      // is left as the raw stored amount rather than guessing one.
      // A "Free" payment method means no money actually changed hands, so its
      // value for this report is 0 regardless of whatever amount the invoice
      // record happens to carry.
      valueSold: (i.paymentMethod || "").toLowerCase() === "free" ? 0 : (Number(i.amount) || 0),
      successRate: null,
      followUpsDone: null,
      missedLeads: null,
      customerId: null,
      userId: i.salesExecId,
      source: "product_posting_invoice",
    })),
    ...approvedStandardInvoices.map(i => ({
      id: i.id,
      title: `Invoice: ${i.customerName || "Untitled"}`,
      company: i.customerName || null,
      method: i.paymentMethod || null,
      status: i.status,
      date: i.paidAt ?? i.updatedAt,
      createdAt: i.paidAt ?? i.updatedAt,
      summary: null,
      notes: null,
      totalTasks: null,
      // invoices stores its own currency + the USD->PKR rate that applied at
      // invoice time (dollar_rate) — converting with that real, per-row rate
      // (amount_usd * dollar_rate, the same formula already used elsewhere in
      // account-routes.ts) rather than a guessed/global rate. Only applied
      // when the invoice is actually in USD.
      // A "Free" payment method means no money actually changed hands, so its
      // value for this report is 0 regardless of whatever amount the invoice
      // record happens to carry.
      valueSold: (i.paymentMethod || "").toLowerCase() === "free"
        ? 0
        : (i.currency === "USD" && !legacyInvoiceIds.has(String(i.id))
            ? (Number(i.total) || 0) * (Number(i.dollarRate) || 0)
            : (Number(i.total) || 0)),
      successRate: null,
      followUpsDone: null,
      missedLeads: null,
      customerId: null,
      userId: i.createdByUserId,
      source: "invoice",
    })),
  ];

  const combinedDetails: any[] = [...vasReportDetails, ...invoiceDetails].sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );

  // Commission is intentionally NOT attached here. Neither vas_reports nor
  // these invoices have a defined commission rule — see
  // services/gm-commission.service.ts (stub) and the investigation notes for
  // what business rule would need to be specified before any commission
  // figure could be shown without being fabricated.

  const totalValue = combinedDetails.reduce((sum, item) => sum + (item.valueSold ?? 0), 0);
  const totalTasksSum = combinedDetails.reduce((sum, item) => sum + (item.totalTasks ?? 0), 0);
  const followUpsSum = combinedDetails.reduce((sum, item) => sum + (item.followUpsDone ?? 0), 0);
  const missedLeadsSum = combinedDetails.reduce((sum, item) => sum + (item.missedLeads ?? 0), 0);
  // Averaged only over rows that actually carry a success rate (vas_reports
  // entries) — invoice rows have no such concept and would otherwise
  // silently drag the average down.
  const successRateRows = combinedDetails.filter(item => item.successRate != null);
  const avgSuccessRate = successRateRows.length > 0
    ? successRateRows.reduce((sum, item) => sum + item.successRate, 0) / successRateRows.length
    : null;

  const chartData = generateChartData(combinedDetails, fromDate, toDate, 'valueSold');

  const itemNamesById = new Map<string, string[]>();
  for (const inv of approvedStandardInvoices as any[]) {
    let list: any[] = [];
    try { list = Array.isArray(inv.items) ? inv.items : JSON.parse(inv.items || "[]"); } catch { list = []; }
    itemNamesById.set(inv.id, list.map((it: any) => String(it?.name ?? it?.project ?? "")).filter(Boolean));
  }
  const departmentSummary = await vasDepartmentSummary(
    invoiceDetails.map((d) => ({
      invoiceId: String(d.id),
      source: d.source,
      value: Number(d.valueSold) || 0,
      itemNames: itemNamesById.get(String(d.id)) ?? [],
    })),
  );

  return {
    type: "vas",
    departmentSummary,
    dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
    meta: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      timezone: tz,
    },
    metrics: {
      totalTasks: totalTasksSum,
      valueOfServiceSold: totalValue,
      successRate: avgSuccessRate,
      followUpsCompleted: followUpsSum,
      missedLeads: missedLeadsSum,
    },
    chartData,
    details: combinedDetails,
    totals: {
      totalAdvance: totalValue,
      totalRemaining: 0
    }
  };
}

// "User Reports" sidebar group's VAS Report (plain /reports/vas, no ?scope=
// company) intentionally kept on its original office_vas + invoices behavior,
// unchanged from before the vas_reports fix — a separate, pre-existing report
// the business still relies on as-is. Only the "Reports" sidebar group's VAS
// Report (/reports/vas?scope=company) uses the vas_reports-backed
// getVasReport() above. Do not merge these two back together without an
// explicit decision to retire one of them.
async function getVasReportLegacyOfficeVas(userIds: string[] | null, fromDate: Date, toDate: Date): Promise<ReportData> {
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
    .select(productPostingInvoiceVasFields)
    .from(productPostingInvoices)
    .where(and(...invoiceConditions));

  // Fetch approved standard invoices
  const stdInvoiceConditions = [
    sql`${invoicePaidDate} >= ${fromDate}`,
    sql`${invoicePaidDate} <= ${toDate}`,
    inArray(invoices.status, ["Paid"]) // Account-approved standard invoices (enum has no APPROVED)
  ];
  if (userIds && userIds.length > 0) {
    stdInvoiceConditions.push(inArray(invoices.createdByUserId, userIds));
  }

  const stdInvoiceEntriesRaw = await db
    .select(standardInvoiceVasFields)
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
      date: i.paidAt ?? i.updatedAt,
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
        await syncGmCommissionLedger(row.userId).catch((err: any) => console.error("[VAS report] GM commission sync failed:", err));
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

async function getGmReport(userIds: string[] | null, fromDate: Date, toDate: Date, onlyAccountApproved = false): Promise<ReportData> {
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

  let entries = await db
    .select()
    .from(gmEntries)
    .where(and(...conditions))
    .orderBy(desc(gmEntries.createdAt));

  // gm_entries' real approval pipeline, BV dates, and HOD/Accountant stage
  // statuses live in columns that exist in the live Postgres table but were
  // never added to the Drizzle schema (confirmed via
  // information_schema.columns, not guessed) — hod_approved_at,
  // gm_bv_submitted_at, gm_bv_date, pay_date, hod_status, accountant_status,
  // plus the approval_status/account_manager_status/final_status trio used
  // below for the "Account approved" filter. Fetched once, used for both.
  const extraById = new Map<string, {
    status: string | null;
    approval_status: string | null;
    account_manager_status: string | null;
    final_status: string | null;
    hod_approved_at: Date | null;
    gm_bv_submitted_at: Date | null;
    gm_bv_date: Date | null;
    pay_date: Date | null;
    hod_status: string | null;
    accountant_status: string | null;
  }>();
  if (entries.length > 0) {
    const ids = entries.map(e => e.id);
    const extraRows = await pool.query<{
      id: string;
      status: string | null;
      approval_status: string | null;
      account_manager_status: string | null;
      final_status: string | null;
      hod_approved_at: Date | null;
      gm_bv_submitted_at: Date | null;
      gm_bv_date: Date | null;
      pay_date: Date | null;
      hod_status: string | null;
      accountant_status: string | null;
    }>(
      // gm_entries has no pay_date column (selecting it made this whole
      // report fail with a 500); old-DRM GMs keep it on webxl_verify_gm.
      `SELECT id, status, approval_status, account_manager_status, final_status,
              hod_approved_at, gm_bv_submitted_at, gm_bv_date,
              (SELECT CASE WHEN v.pay_date ~ '^[1-9]\\d{3}-\\d{2}-\\d{2}' THEN left(v.pay_date, 10)::timestamp END
                 FROM migration_meta.migration_legacy_ids m
                 JOIN legacy_archive.webxl_verify_gm v
                   ON v._source_table = 'webxl_verify_gm' AND v._legacy_pk = m.legacy_id
                WHERE m.modern_table = 'gm_entries' AND m.legacy_table = 'webxl_verify_gm'
                  AND m.modern_id = gm_entries.id::text
                LIMIT 1) AS pay_date,
              hod_status, accountant_status
         FROM drm.gm_entries WHERE id::text = ANY($1::text[])`,
      [ids]
    );
    for (const r of extraRows.rows) extraById.set(r.id, r);
  }

  if (onlyAccountApproved && entries.length > 0) {
    // "Approved by Account" = the canonical GM/BV state machine's APPROVED (or
    // PROJECT_CREATED, which is APPROVED-plus-a-linked-project — same approval
    // event), resolved via the existing mapToCanonical helper (verified
    // against gm-bv-state-machine.ts and the real approval endpoints in
    // gm-pool-routes.ts/account-routes.ts, not guessed).
    entries = entries.filter(e => {
      const extra = extraById.get(e.id);
      if (!extra) return false;
      const canonical = mapToCanonical({
        status: extra.status,
        approval_status: extra.approval_status,
        account_manager_status: extra.account_manager_status,
        final_status: extra.final_status,
      });
      return canonical === "APPROVED" || canonical === "PROJECT_CREATED";
    });
  }

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
    details: entries.map(e => {
      const extra = extraById.get(e.id);
      return {
        id: e.id,
        memberId: e.memberId,
        companyName: e.companyName,
        package: e.packageType,
        // KWA and PSA have no matching column anywhere on gm_entries (checked
        // the live table's full column list, not just the Drizzle schema) —
        // left as "-" rather than guessing which other field might mean this.
        kwa: "-",
        psa: "-",
        // Unchanged — GmReportTable (user-reports.tsx) already reads this field
        // for its own "Package Amount" column; left as-is for that page.
        packageAmount: e.finalOrderUsd || e.amountUsd,
        // New, separate fields for gm-report.tsx's P.A/Discount/Extra Discount
        // columns — the catalog sticker price before any discount, and the
        // two discount components, per gmEntries' own schema comment
        // ("amountUsd is packagePriceUsd - alibabaDiscountUsd").
        packagePriceUsd: e.packagePriceUsd,
        discount: e.alibabaDiscountUsd,
        extraDiscount: e.extraDiscountUsd,
        method: e.paymentStatus || "BankTransfer", // Default to BankTransfer if missing
        payDate: extra?.pay_date || null,
        bvSubmitDate: extra?.gm_bv_submitted_at || null,
        bvDate: extra?.gm_bv_date || null,
        person: e.salesPersonName,
        rcNew: e.entryType,
        accountantStatus: extra?.accountant_status || null,
        hodStatus: extra?.hod_status || null,
        date: e.createdAt,
        // gm-report.tsx's GM View splits these into two columns. hod_approved_at
        // is the real column the HOD-approval endpoint stamps (confirmed in
        // gm-pool-routes.ts) — gmEntries.approvedAt (Drizzle-typed) is a
        // different, separate column and was the wrong one to use here.
        gmCreationDate: e.createdAt,
        hodApprovedDate: extra?.hod_approved_at || null,
        lastUpdateDate: e.updatedAt,
        gmType: resolveStoredOrDerivedGmType(e),
      };
    }),
  };
}

// "Reports" sidebar group's BV Report (?scope=company) — a different view from
// the bv_reports-backed verification workflow "User Reports" -> BV Report uses.
// The requested column layout (Company/Package/Price/.../Rc-New/Type/Receive
// Date) matches gm_entries (package sales), confirmed by the fact that the
// already-shipped /reports/bv-system page uses this exact same source and
// column set. Several of its columns there are hardcoded placeholders
// (Method="0x 1000", Pay=0, BV="Total Rc") — NOT reused here.
//
// Pay/BV/Method were cross-checked against func (1).php's legacy "View Gm BV
// Reports" section (line ~22355 onward): there, Pay is the row's *pay date*
// (not an amount), BV is the BV-verification *date* (webxl_gmaccount.bvDate),
// and Method is the payment-status text (webxl_verify_gm.status, values like
// "Online Paid"/"Cash Received"). Confirmed live: gm_entries.payment_status
// already holds exactly that ("Cash Received"), and the raw pay_date/
// gm_bv_date columns (not in the Drizzle schema, same as getGmReport's
// extraById fetch) are real, if sparsely populated so far.
//
// Comm: func (1).php's $tconversion formula (line ~22534 onward) is a deeply
// nested, repeatedly-duplicated cascade, but every branch collapses to the
// same net rule once the redundant achievement-threshold gating (which
// computes the identical value on every branch — confirmed by reading all of
// them) is stripped out: a package-name base rate, overridden to a flat 1000
// when the sale is not "New" (Rc/Ec). Ported exactly for the three package
// buckets the legacy code hardcodes (Basic/GGS Digital/GGS Lite/Basic
// Plus/Standard); other packages needed `getTarget()['conversion']` from the
// legacy per-definition rate table, which has no modern equivalent — "-" for
// those rather than a guess. Dropout-based overrides are also skipped: that
// column doesn't exist on gm_entries at all.
//
// Reward/VAS/KWA: legacy read these off the *target definition* assigned to
// the user (webxl_terget, via webxl_setterget). The modern equivalent,
// target_system_user_targets, really is joinable by user_id — checked live,
// some rows do carry a real UUID there (not every row is a stray name/role
// string, which is what made the bv-system page's "pick first row" approach
// unreliable). Matched here by salesPersonId + the target's date range
// actually covering the entry's date, picking the most recently-started
// match. Today this returns "-" for every current row (no admin has created
// a target for these specific salespeople's UUIDs yet, confirmed live) — the
// join itself is real and will surface real numbers the moment a Set Target
// entry exists for that user, not fabricated placeholders.
function packageBaseCommission(packageType: string | null, entryType: string | null): number | null {
  const isNew = (entryType || "").toLowerCase() === "new";
  switch (packageType) {
    case "Basic":
      return isNew ? 3000 : 1000;
    case "GGS Digital":
    case "GGS Lite":
      return isNew ? 2500 : 1000;
    case "Basic Plus":
    case "Standard":
      return isNew ? 5000 : 1000;
    default:
      return null;
  }
}

// gm_entries.pay_date (the raw column) is written by nothing — checked live,
// every row has it null. The real payment date lives per-installment instead,
// in the installments jsonb array (installments: [{ dollar, pkr, dollarRate,
// chequeNo, payDate }], populated by the actual GM payment-entry flow).
// Multiple installments can carry different dates; the latest one is "when
// this entry was last paid".
function latestInstallmentPayDate(installments: unknown): Date | null {
  if (!Array.isArray(installments)) return null;
  let latest: Date | null = null;
  for (const inst of installments) {
    const raw = (inst as any)?.payDate;
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    if (!latest || d > latest) latest = d;
  }
  return latest;
}

async function getBvReportCompanyWide(
  userIds: string[] | null,
  fromDate: Date,
  toDate: Date,
  // "confirmed" (default, main BV Report): entries with a real gm_bv_date.
  // "submitted" (BV Pending page, default): any entry ever submitted for BV
  // (gm_bv_submitted_at set), confirmed or not — the user's full BV worklist.
  // "pending": account team has not set account_bv_date yet (Dollar System
  // "Company & BV Date Details" — same as rows still missing BV date).
  // "submitted": customer/submission activity or still awaiting account BV date.
  options: { bvFilter?: "confirmed" | "pending" | "submitted" } = {},
): Promise<ReportData> {
  const conditions = [
    gte(gmEntries.createdAt, fromDate),
    lte(gmEntries.createdAt, toDate),
    eq(gmEntries.isDeleted, false),
  ];
  if (userIds && userIds.length > 0) {
    // sales_person_id is uuid in DB; schema maps it as varchar — cast for PG.
    conditions.push(
      sql`${gmEntries.salesPersonId}::text = ANY(ARRAY[${sql.join(
        userIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::text[])`,
    );
  }

  const allEntries = await db
    .select()
    .from(gmEntries)
    .where(and(...conditions))
    .orderBy(desc(gmEntries.createdAt));

  const extraById = new Map<string, {
    gm_bv_date: Date | null;
    pay_date: Date | null;
    gm_bv_submitted_at: Date | null;
    account_bv_date: Date | null;
    customer_id: string | null;
  }>();
  if (allEntries.length > 0) {
    const ids = allEntries.map((e) => e.id);
    const extraRows = await pool.query<{
      id: string;
      gm_bv_date: Date | null;
      pay_date: Date | null;
      gm_bv_submitted_at: Date | null;
      account_bv_date: Date | null;
      customer_id: string | null;
    }>(
      // gm_entries has no pay_date column: old-DRM GMs keep it on webxl_verify_gm.
      `SELECT id, gm_bv_date,
              (SELECT CASE WHEN v.pay_date ~ '^\\d{4}-\\d{2}-\\d{2}' AND v.pay_date NOT LIKE '0000%'
                           THEN left(v.pay_date, 10)::timestamp END
                 FROM migration_meta.migration_legacy_ids m
                 JOIN legacy_archive.webxl_verify_gm v
                   ON v._source_table = 'webxl_verify_gm' AND v._legacy_pk = m.legacy_id
                WHERE m.modern_table = 'gm_entries' AND m.legacy_table = 'webxl_verify_gm'
                  AND m.modern_id = gm_entries.id::text
                LIMIT 1) AS pay_date,
              gm_bv_submitted_at, account_bv_date,
              COALESCE(
                customer_id::text,
                (SELECT c.id::text FROM drm.customers c
                   WHERE lower(trim(c.company_name)) = lower(trim(gm_entries.company_name))
                   LIMIT 1)
              ) AS customer_id
         FROM drm.gm_entries WHERE id::text = ANY($1::text[])`,
      [ids],
    );
    for (const r of extraRows.rows) extraById.set(r.id, r);
  }

  const bvFilter = options.bvFilter ?? "confirmed";
  const entries = allEntries.filter((e) => {
    const extra = extraById.get(e.id);
    const hasGmBvDate = Boolean(extra?.gm_bv_date);
    const hasAccountBvDate = Boolean(extra?.account_bv_date);
    const hasSubmission = Boolean(extra?.gm_bv_submitted_at);
    if (bvFilter === "confirmed") return hasGmBvDate || hasAccountBvDate;
    if (bvFilter === "pending") return !hasAccountBvDate;
    return hasSubmission || !hasAccountBvDate;
  });

  const abPayByGmId = new Map<string, Date | null>();
  if (entries.length > 0) {
    const entryIds = entries.map((e) => e.id);
    const abRows = await pool.query<{ id: string; ab_pay_date: Date | null }>(
      `SELECT gm_entry_id::text AS id,
              MAX(paid_date) AS ab_pay_date
         FROM drm.ab_payments
        WHERE gm_entry_id::text = ANY($1::text[])
          AND COALESCE(is_deleted, false) = false
          AND status = 'paid'
        GROUP BY gm_entry_id`,
      [entryIds],
    );
    for (const r of abRows.rows) abPayByGmId.set(r.id, r.ab_pay_date);
  }

  const salesPersonIds = Array.from(new Set(entries.map((e) => e.salesPersonId).filter(Boolean))) as string[];
  const targetsByUser = new Map<string, (typeof targetSystemUserTargets.$inferSelect)[]>();
  if (salesPersonIds.length > 0) {
    const targetRows = await db
      .select()
      .from(targetSystemUserTargets)
      .where(inArray(targetSystemUserTargets.userId, salesPersonIds));
    for (const t of targetRows) {
      const list = targetsByUser.get(t.userId) ?? [];
      list.push(t);
      targetsByUser.set(t.userId, list);
    }
  }
  function matchTarget(salesPersonId: string | null, entryDate: Date) {
    if (!salesPersonId) return null;
    const rows = targetsByUser.get(salesPersonId) ?? [];
    const matching = rows.filter((t) => {
      const afterStart = !t.startDate || new Date(t.startDate) <= entryDate;
      const beforeEnd = !t.endDate || new Date(t.endDate) >= entryDate;
      return afterStart && beforeEnd;
    });
    matching.sort((a, b) => {
      const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
      return bStart - aStart;
    });
    return matching[0] ?? null;
  }

  // Achievement vs assigned target quota (func.php's T.No# concept) — for each
  // salesperson's currently-active target (matched as of today, same
  // targetsByUser/date-range logic as per-row matching), count how many of
  // their BV-dated entries fall inside that target's own date range. Not
  // scoped to package (confirmed live: Set Target's real UI assigns a target
  // by user only, with no package field at all — matching by package would
  // just never match anything real).
  const personAchievement: { personId: string; targetName: string; targetQuota: number | null; achievedCount: number }[] = [];
  for (const personId of salesPersonIds) {
    const target = matchTarget(personId, new Date());
    if (!target) continue;
    const rangeStart = target.startDate ? new Date(target.startDate) : null;
    const rangeEnd = target.endDate ? new Date(target.endDate) : null;
    const achievedCount = entries.filter(
      (e) =>
        e.salesPersonId === personId &&
        (!rangeStart || e.createdAt >= rangeStart) &&
        (!rangeEnd || e.createdAt <= rangeEnd),
    ).length;
    personAchievement.push({
      personId,
      targetName: target.targetName,
      targetQuota: Number(target.target) || null,
      achievedCount,
    });
  }

  const totalValue = entries.reduce((sum, e) => sum + Number(e.amountUsd || 0), 0);
  const chartData = generateChartData(entries, fromDate, toDate, "amountUsd");

  const details = entries.map((e) => {
    const extra = extraById.get(e.id);
    const target = matchTarget(e.salesPersonId, e.createdAt);
    const comm = packageBaseCommission(e.packageType, e.entryType);
    return {
      id: e.id,
      gmEntryId: e.id,
      customerId: extra?.customer_id ?? null,
      companyName: e.companyName,
      package: e.packageType,
      // Catalog/sticker price, falling back to the real order amount when the
      // sticker price wasn't recorded on this entry (both are real columns).
      price: e.packagePriceUsd ?? e.amountUsd,
      // Real per-sale extra discount (legacy "ExtraDisc++" column).
      extraDisc: e.extraDiscountUsd ?? 0,
      comm: comm ?? "-",
      // 0, not "-", when no target record exists for this salesperson yet —
      // explicit product decision (still a real 0, not a guess: it reflects
      // "no reward/vas/kwa assigned", same as the value would be if a target
      // row existed with these fields left at their own schema default of 0).
      reward: target ? Number(target.reward) : 0,
      vas: target ? Number(target.vas) : 0,
      kwa: target ? Number(target.kwa) : 0,
      // Real payment-status text (confirmed live: "Cash Received" etc.) —
      // the legacy report's own "Method" column source.
      method: e.paymentStatus || "-",
      personName: e.salesPersonName,
      // Real salesperson uuid — needed (not just the display name) to look up
      // or create that person's own commission-verification record.
      personId: e.salesPersonId,
      // Real pay date (legacy "Pay" column), not an amount — the latest
      // installment payDate when recorded, falling back to the gm_entries
      // pay_date column (currently always empty, but a real column in case
      // it's ever written), "-" only when genuinely nothing was recorded.
      pay: latestInstallmentPayDate(e.installments) ?? extra?.pay_date ?? null,
      // Real BV-submission date (legacy "BV Submit" column).
      bvSubmit: extra?.gm_bv_submitted_at || null,
      // Account-confirmed BV date (Dollar System), else customer GM BV date.
      bv: extra?.account_bv_date || extra?.gm_bv_date || null,
      accountBvDate: extra?.account_bv_date || null,
      rcNew: e.entryType,
      // Legacy BV Pending table: Payment Received = verify_gm create_date;
      // here that is the GM entry's created_at (date portion in UI).
      paymentReceived: e.createdAt,
      // Legacy Ab Pay Date = verify_gm pay_date → ab_payments.paid_date when paid.
      abPayDate: abPayByGmId.get(e.id) ?? extra?.pay_date ?? null,
      // Drives the existing Select Status dropdown (New/Renew/Expire/Rc-Up) —
      // real gm_entries.entry_type, though in current data every row is "New".
      status: e.entryType,
      type: e.canonicalGmType || e.entryType,
      date: e.createdAt,
    };
  });

  const sumNumeric = (key: "price" | "comm" | "reward" | "vas" | "kwa") =>
    details.reduce((sum, d) => sum + (typeof d[key] === "number" ? (d[key] as number) : Number(d[key]) || 0), 0);

  return {
    type: "bv",
    dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
    meta: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      timezone: tz,
    },
    metrics: {
      totalTasks: entries.length,
      valueOfServiceSold: totalValue,
      successRate: null,
      followUpsCompleted: 0,
      missedLeads: 0,
    },
    chartData,
    details,
    totals: {
      totalAdvance: totalValue,
      totalRemaining: 0,
      totalComm: sumNumeric("comm"),
      totalReward: sumNumeric("reward"),
      totalVas: sumNumeric("vas"),
      totalKwa: sumNumeric("kwa"),
    },
    reportCount: entries.length,
    personAchievement,
  };
}

// "BV Pending EC/NC Only" (?scope=pending) — old-DRM parity.
//
// Migrated gm_entries carry no BV state (gm_bv_date / account_bv_date /
// gm_bv_submitted_at are empty on every copied row), so the modern rules can't
// reproduce the old page. For GMs that came from the old DRM this reads the
// archived tables directly and applies func.php's `user_id_gm_bv_view2` rules:
//   base: webxl_verify_gm with acc_disc_status/ceo_disc_status 'Approved',
//         create_date in [from, to] (end day INCLUSIVE — PHP compared the
//         datetime text to 'Y-m-d', which silently dropped the last day),
//         package not Kwa/Ai/Cat (MySQL ci compare; NULL package excluded),
//         optional user_id = selected user's old webxl_user id.
//   pending (Pending Bv checkbox): the company has a webxl_gmaccount row with
//         empty bvDate whose create_data is in [from, to]; BV Date = Pending.
//   normal: the first webxl_gmaccount row for (com_id, user_id) has a bvDate
//         within [from, to].
//   BV Submit = first gmaccount row's user_bv_date for the company;
//   Person = name of the company's assignee (webxl_company.assignId).
// GMs created in the new app (not mapped from webxl_verify_gm) still come from
// getBvReportCompanyWide's modern logic; mapped ones are dropped from that half
// so nothing is counted twice.
// Rc/New label — same mapping as the Create GM page's gmTypeLabel
// (frontend/src/pages/account-gm-entries.tsx GM_TYPE_BY_CODE): codes from the
// old DRM (webxl_verify_gm.renwal / migrated entry_type) become labels, blank
// or unknown codes -> "None", and text labels new entries already store pass
// through unchanged.
const GM_TYPE_BY_CODE: Record<string, string> = { "1": "New", "0": "Rc", "2": "Ec", "3": "Rc-Up", "4": "Kwa" };
function gmTypeLabel(raw: unknown): string {
  const v = String(raw ?? "").trim();
  if (v === "") return "None";
  if (/^\d+$/.test(v)) return GM_TYPE_BY_CODE[v] ?? "None";
  return v;
}

// Old dates are Pakistan wall-clock text. Return them as offset-less ISO
// ("YYYY-MM-DDTHH:mm:ss"), which browsers parse as local time, so the page
// prints the same day/time the old DRM showed regardless of timezone.
function legacyWallClock(value: string | null | undefined): string | null {
  const s = (value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s) || s.startsWith("0000")) return null;
  const time = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(s) ? s.slice(11, 19) : "00:00:00";
  return `${s.slice(0, 10)}T${time}`;
}

function localYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function getBvPendingLegacyReport(
  userIds: string[] | null,
  fromDate: Date,
  toDate: Date,
  pendingOnly: boolean,
): Promise<ReportData> {
  const startYmd = localYmd(fromDate);
  const endYmd = localYmd(toDate);

  // Selected modern user uuid(s) -> old webxl_user ids. A user with no old id
  // matches no legacy rows (empty array), null = no user filter ("All").
  let legacyUserIds: string[] | null = null;
  if (userIds && userIds.length > 0) {
    const mapped = await pool.query<{ legacy_id: string }>(
      `SELECT legacy_id FROM migration_meta.migration_legacy_ids
        WHERE modern_table = 'users' AND legacy_table = 'webxl_user' AND modern_id = ANY($1::text[])`,
      [userIds],
    );
    legacyUserIds = mapped.rows.map((r) => r.legacy_id);
  }

  const [legacyResult, modern] = await Promise.all([
    pool.query<{
      legacy_id: string;
      com_id: string;
      package: string | null;
      price: string | null;
      status: string | null;
      renwal: string | null;
      create_date: string | null;
      pay_date: string | null;
      cname: string | null;
      contact: string | null;
      phone: string | null;
      person_name: string | null;
      person_id: string | null;
      customer_id: string | null;
      gm_entry_id: string | null;
      user_bv_date: string | null;
      bv_date: string | null;
      ab_paid_date: string | null;
    }>(
      `WITH base AS (
         SELECT v._legacy_pk, v.com_id, v.user_id, v.package, v.price, v.status, v.renwal,
                v.create_date, v.pay_date
           FROM legacy_archive.webxl_verify_gm v
          WHERE lower(rtrim(v.acc_disc_status)) = 'approved'
            AND lower(rtrim(v.ceo_disc_status)) = 'approved'
            AND v.create_date >= $1::text AND v.create_date < ($2::date + 1)::text
            AND v.package IS NOT NULL
            AND lower(rtrim(v.package)) NOT IN ('kwa', 'ai', 'cat')
            AND ($3::text[] IS NULL OR v.user_id = ANY($3::text[]))
       ),
       ga AS (
         SELECT g._legacy_pk::bigint AS gid, g.com_id, g.user_id, g."bvDate" AS bv_date,
                g.user_bv_date, g.create_data
           FROM legacy_archive.webxl_gmaccount g
          WHERE g.com_id IN (SELECT com_id FROM base)
       ),
       ga_first_com AS (
         SELECT DISTINCT ON (com_id) com_id, user_bv_date FROM ga ORDER BY com_id, gid
       ),
       ga_first_com_user AS (
         SELECT DISTINCT ON (com_id, user_id) com_id, user_id, bv_date FROM ga ORDER BY com_id, user_id, gid
       ),
       ga_pending AS (
         SELECT DISTINCT com_id FROM ga
          WHERE COALESCE(bv_date, '') IN ('', '0000-00-00')
            AND create_data >= $1::text AND create_data < ($2::date + 1)::text
       ),
       cd AS (
         SELECT DISTINCT ON (d.com_id) d.com_id, d.phone
           FROM legacy_archive.webxl_com_detail d
          WHERE d.com_id IN (SELECT com_id FROM base)
          ORDER BY d.com_id, d._legacy_pk::bigint
       )
       SELECT b._legacy_pk AS legacy_id, b.com_id, b.package, b.price, b.status, b.renwal,
              b.create_date, b.pay_date,
              c.cname, c.contact, cd.phone,
              u.name AS person_name, mu.modern_id AS person_id,
              mc.modern_id AS customer_id, mg.modern_id AS gm_entry_id,
              f.user_bv_date, fu.bv_date,
              (SELECT MAX(ap.paid_date)::text FROM drm.ab_payments ap
                WHERE mg.modern_id IS NOT NULL AND ap.gm_entry_id = mg.modern_id::uuid
                  AND ap.status = 'paid' AND COALESCE(ap.is_deleted, false) = false) AS ab_paid_date
         FROM base b
         LEFT JOIN legacy_archive.webxl_company c
           ON c._source_table = 'webxl_company' AND c._legacy_pk = b.com_id
         LEFT JOIN cd ON cd.com_id = b.com_id
         LEFT JOIN legacy_archive.webxl_user u
           ON u._source_table = 'webxl_user' AND u._legacy_pk = c."assignId"
         LEFT JOIN migration_meta.migration_legacy_ids mu
           ON mu.entity_type = 'user' AND mu.legacy_table = 'webxl_user' AND mu.legacy_id = c."assignId"
         LEFT JOIN migration_meta.migration_legacy_ids mc
           ON mc.entity_type = 'customer' AND mc.legacy_table = 'webxl_company' AND mc.legacy_id = b.com_id
         LEFT JOIN migration_meta.migration_legacy_ids mg
           ON mg.entity_type = 'gm_entry' AND mg.legacy_table = 'webxl_verify_gm' AND mg.legacy_id = b._legacy_pk
         LEFT JOIN ga_first_com f ON f.com_id = b.com_id
         LEFT JOIN ga_first_com_user fu ON fu.com_id = b.com_id AND fu.user_id = b.user_id
        WHERE CASE WHEN $4::boolean
                   THEN b.com_id IN (SELECT com_id FROM ga_pending)
                   ELSE fu.bv_date ~ '^\\d{4}-\\d{2}-\\d{2}' AND fu.bv_date NOT LIKE '0000%'
                        AND left(fu.bv_date, 10) >= $1::text AND left(fu.bv_date, 10) <= $2::text
              END
        ORDER BY b._legacy_pk::bigint DESC`,
      [startYmd, endYmd, legacyUserIds, pendingOnly],
    ),
    getBvReportCompanyWide(userIds, fromDate, toDate, { bvFilter: pendingOnly ? "pending" : "submitted" }),
  ]);

  // Drop old-DRM GMs from the modern half — the legacy query above owns them.
  const modernIds = modern.details.map((d: any) => String(d.gmEntryId ?? d.id));
  const mappedIds = new Set<string>();
  if (modernIds.length > 0) {
    const mapped = await pool.query<{ modern_id: string }>(
      `SELECT modern_id FROM migration_meta.migration_legacy_ids
        WHERE modern_table = 'gm_entries' AND legacy_table = 'webxl_verify_gm' AND modern_id = ANY($1::text[])`,
      [modernIds],
    );
    for (const r of mapped.rows) mappedIds.add(r.modern_id);
  }
  const modernDetails = modern.details
    .filter((d: any) => !mappedIds.has(String(d.gmEntryId ?? d.id)))
    .map((d: any) => ({ ...d, rcNew: gmTypeLabel(d.rcNew), status: gmTypeLabel(d.status), source: "modern" }));

  const legacyDetails = legacyResult.rows.map((r) => {
    const rcNew = gmTypeLabel(r.renwal);
    const paymentReceived = legacyWallClock(r.create_date);
    const price = Number(r.price);
    return {
      id: r.gm_entry_id ?? `legacy-gm-${r.legacy_id}`,
      gmEntryId: r.gm_entry_id,
      legacyGmId: r.legacy_id,
      comId: r.com_id,
      customerId: r.customer_id,
      companyName: r.cname,
      mobile: `${r.contact ?? ""}/${r.phone ?? ""}`,
      package: r.package,
      price: Number.isFinite(price) ? price : 0,
      method: r.status || "-",
      personName: r.person_name,
      personId: r.person_id,
      bvSubmit: legacyWallClock(r.user_bv_date),
      // Pending mode prints "Pending" (null); normal mode the real bvDate.
      bv: pendingOnly ? null : legacyWallClock(r.bv_date),
      accountBvDate: pendingOnly ? null : legacyWallClock(r.bv_date),
      rcNew,
      paymentReceived,
      abPayDate: legacyWallClock(r.pay_date) ?? legacyWallClock(r.ab_paid_date),
      status: rcNew,
      type: rcNew,
      date: paymentReceived,
      source: "legacy",
    };
  });

  const details = [...legacyDetails, ...modernDetails];
  const totalValue = details.reduce((sum, d: any) => sum + (Number(d.price) || 0), 0);
  return {
    ...modern,
    metrics: { ...modern.metrics, totalTasks: details.length, valueOfServiceSold: totalValue },
    chartData: generateChartData(
      details.map((d: any) => ({ createdAt: d.date, price: d.price })),
      fromDate,
      toDate,
      "price",
    ),
    details,
    totals: { ...(modern.totals ?? { totalRemaining: 0 }), totalAdvance: totalValue },
    reportCount: details.length,
  };
}

// "Reports" sidebar BV Report (?scope=company) — old-DRM parity.
//
// Port of func.php's `user_id_gm_bv_view` ("View Gm BV Reports"). Migrated
// gm_entries have no BV dates, so old-DRM GMs are read from legacy_archive:
//   targets: webxl_setterget (terget_cat '1') whose [start_date, end_date]
//            covers the whole selected range, joined to webxl_terget for
//            package / conversion / price / reward / vas / kwa.
//   rows:    per target, approved webxl_verify_gm rows of the target's user and
//            package created from (start - 8 months) through the end date, kept
//            when the company has a webxl_gmaccount row for that user whose
//            bvDate falls in [start, end] (both inclusive, as in PHP's DATE()).
//            A user with two targets for the same package shows the GM twice,
//            exactly as the old page did.
//   Comm:    finalComm when set, else the PHP cascade (see legacyBvComm).
// The Select Status filter (old type_fillter = renwal code) is applied by the
// page on `status`, which carries the same gmTypeLabel as Rc/New.
// GMs created in the new app keep getBvReportCompanyWide's modern logic; GMs
// mapped from webxl_verify_gm are dropped from that half (no double count).
const LEGACY_DROPOUT_LABELS: Record<string, string> = {
  "1": "Basic Drop",
  "2": "Basic Plus Drop",
  "3": "Basic P/D",
  "4": "Basic Plus P/D",
  "5": "Pkg Update",
};

// PHP 8 loose `$value == $n` for a TEXT column: NULL == 0, numeric strings by
// value, '' never equals a number.
function phpLooseEq(value: string | null, n: number): boolean {
  if (value === null) return n === 0;
  const v = value.trim();
  return v !== "" && /^-?\d+(\.\d+)?$/.test(v) && Number(v) === n;
}

// date('Y-m-d', strtotime("$ymd +N month")) — PHP lets the day overflow into
// the next month, like JS Date does.
function phpAddMonths(ymd: string, months: number): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1 + months, d);
}

function legacyBvComm(
  r: { package: string | null; renwal: string | null; droupout: string | null; final_comm: string | null; conversion: string | null },
  ctx: { achieved: number; achievedLastMonth: number; target: number; inLastMonth: boolean },
): number | string {
  const fc = r.final_comm;
  // if ($row['finalComm'] >= 0 && $row['finalComm'] != '')
  if (fc !== null && fc !== "" && !(/^-?\d+(\.\d+)?$/.test(fc.trim()) && Number(fc) < 0)) {
    return Number.isFinite(Number(fc)) ? Number(fc) : fc;
  }
  const conv = Number(r.conversion) || 0;
  const pkg = r.package ?? "";
  const rcOrEc = phpLooseEq(r.renwal, 0) || phpLooseEq(r.renwal, 2);
  const isNew = phpLooseEq(r.renwal, 1);
  const dropout = (c: number) => {
    if (phpLooseEq(r.droupout, 1) || phpLooseEq(r.droupout, 2)) c = 5000;
    if (phpLooseEq(r.droupout, 3)) c = 3000;
    if (phpLooseEq(r.droupout, 4)) c = 5000;
    if (phpLooseEq(r.droupout, 5)) c = 6000;
    return c;
  };
  // Package-rate branch (Basic 3000 / GGS 2500 / Basic Plus & Standard 5000).
  const packageRule = () => {
    let c: number;
    if (pkg === "Basic") c = 3000;
    else if (pkg === "GGS Digital" || pkg === "GGS Lite") c = 2500;
    else if (pkg === "Basic Plus" || pkg === "Standard") c = 5000;
    else return conv;
    if (rcOrEc) c = dropout(1000);
    if (isNew) c = dropout(c);
    return c;
  };
  // Target-conversion branch.
  const conversionRule = () => {
    let c = conv;
    if (rcOrEc) {
      c = dropout(1000);
      if (pkg === "Verified Supplier") c = conv;
    }
    if (isNew) c = dropout(c);
    return c;
  };
  // The PHP nests the same two rules several times; every path reduces to:
  const { achieved, achievedLastMonth, target, inLastMonth } = ctx;
  if (achieved < target) {
    return achievedLastMonth >= target && inLastMonth ? conversionRule() : packageRule();
  }
  return achievedLastMonth < target && inLastMonth ? packageRule() : conversionRule();
}

// Old BV report footer (func.php user_id_gm_bv_view, <tfoot>) for one user:
//   "T.No# P/T/Team"  P = userABtargetAchiveCountNumPay(user, start, end)
//                       (gmaccount rows of the user joined to renwal=1 GMs of
//                       the company created in range), T = target_num of the
//                       LAST covering webxl_setterget row (/3 for a 1-month view),
//                       Team = userABtargetAchiveCountNumTotalPayDate (all
//                       renwal=1 GMs created in range).
//   "Achive (x%)"     round(P*100 / T of the last displayed row's target).
//   Reward            sum of the rows' target reward, replaced by 5000 / 0 when
//                       the target is reached (P>=T, x>=100) — see rewardOverride.
//   "Total Rc"        count of Rc (renwal 0) rows × 1000 (display only).
//   "Final Com"       P>=T ? round(Comm + Reward) : Comm (team bonus is always 0),
//                       plus the HOD-typed Reward AB on the page.
export type BvLegacyFooter = {
  personId: string;
  legacyUserId: string;
  targetName: string | null;
  achieved: number;
  targetQuota: number;
  teamTotal: number;
  achievePct: number;
  // null = use the Reward column sum; a number = the old override.
  rewardOverride: number | null;
  rewardInFinal: boolean;
  rcRate: number;
  totals: {
    price: number;
    extraDisc: number;
    comm: number;
    reward: number;
    vas: number;
    kwa: number;
    rcCount: number;
    rcAmount: number;
    finalCom: number;
  };
};

export async function getBvCompanyLegacyReport(
  userIds: string[] | null,
  fromDate: Date,
  toDate: Date,
): Promise<ReportData> {
  const startYmd = localYmd(fromDate);
  const endYmd = localYmd(toDate);
  // PHP: $last_m = start -8 month; $startDataLast = start -1 month;
  // $endDataLast = date('Y-m-31', end -1 month) (string, may be e.g. 09-31).
  const lastM = localYmd(phpAddMonths(startYmd, -8));
  const startLast = localYmd(phpAddMonths(startYmd, -1));
  const endLastBase = phpAddMonths(endYmd, -1);
  const endLast = `${localYmd(endLastBase).slice(0, 7)}-31`;
  // $howeverManyMonths: DateTime diff in whole months, forced to 1 when the
  // start and end month numbers match; a 1-month view uses target_num / 3.
  const [sy, sm, sd] = startYmd.split("-").map(Number);
  const [ey, em, ed] = endYmd.split("-").map(Number);
  let monthsDiff = (ey - sy) * 12 + (em - sm) - (ed < sd ? 1 : 0);
  if (sm === em) monthsDiff = 1;
  const targetDivisor = monthsDiff === 1 ? 3 : 1;

  let legacyUserIds: string[] | null = null;
  if (userIds && userIds.length > 0) {
    const mapped = await pool.query<{ legacy_id: string }>(
      `SELECT legacy_id FROM migration_meta.migration_legacy_ids
        WHERE modern_table = 'users' AND legacy_table = 'webxl_user' AND modern_id = ANY($1::text[])`,
      [userIds],
    );
    legacyUserIds = mapped.rows.map((r) => r.legacy_id);
  }
  // Achievement counts (userABtargetAchiveCountNumPay) are taken for the one
  // selected user; with "All" PHP passed 'All' as the user, so they are 0.
  const achievementUser = legacyUserIds && legacyUserIds.length === 1 ? legacyUserIds[0] : null;

  const footerStatsPromise = achievementUser
    ? pool.query<{
        achieved: string;
        team_total: string;
        target_num: string | null;
        terget_name: string | null;
        role_id: string | null;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM legacy_archive.webxl_gmaccount g
              JOIN legacy_archive.webxl_verify_gm v ON v.com_id = g.com_id
             WHERE g.user_id = $3 AND trim(v.renwal) = '1'
               AND left(v.create_date, 10) >= $1 AND left(v.create_date, 10) <= $2) AS achieved,
           (SELECT COUNT(*) FROM legacy_archive.webxl_verify_gm v
             WHERE trim(v.renwal) = '1'
               AND left(v.create_date, 10) >= $1 AND left(v.create_date, 10) <= $2) AS team_total,
           lt.target_num, lt.terget_name,
           (SELECT u."roleId" FROM legacy_archive.webxl_user u
             WHERE u._source_table = 'webxl_user' AND u._legacy_pk = $3) AS role_id
         FROM (SELECT 1) one
         LEFT JOIN LATERAL (
           SELECT st.target_num, t.terget_name
             FROM legacy_archive.webxl_setterget st
             LEFT JOIN legacy_archive.webxl_terget t
               ON t._source_table = 'webxl_terget' AND t._legacy_pk = st.terget_id
            WHERE rtrim(st.terget_cat) = '1' AND st.user_id = $3
              AND st.start_date <= $1 AND st.end_date >= $2
            ORDER BY st._legacy_pk::bigint DESC
            LIMIT 1
         ) lt ON true`,
        [startYmd, endYmd, achievementUser],
      )
    : Promise.resolve(null);

  const [legacyResult, modern] = await Promise.all([
    pool.query<{
      st_id: string;
      t_user: string;
      target_num: string | null;
      terget_name: string | null;
      conversion: string | null;
      t_price: string | null;
      reward: string | null;
      kwa: string | null;
      vas: string | null;
      legacy_id: string;
      com_id: string;
      package: string | null;
      extra_discount: string | null;
      status: string | null;
      renwal: string | null;
      droupout: string | null;
      final_comm: string | null;
      create_date: string | null;
      pay_date: string | null;
      bv_date: string | null;
      user_bv_date: string | null;
      cname: string | null;
      person_name: string | null;
      person_id: string | null;
      customer_id: string | null;
      gm_entry_id: string | null;
      achieved: string;
      achieved_last: string;
    }>(
      // MATERIALIZED: archive tables have no planner stats, and inlining tg
      // made PG re-scan webxl_setterget once per verify_gm row (~8 s).
      `WITH tg AS MATERIALIZED (
         SELECT st._legacy_pk AS st_id, st.user_id AS t_user, st.target_num,
                t.terget_name, COALESCE(t.package, '') AS t_package,
                t.conversion, t.price AS t_price, t.reward, t.kwa, t.vas
           FROM legacy_archive.webxl_setterget st
           LEFT JOIN legacy_archive.webxl_terget t
             ON t._source_table = 'webxl_terget' AND t._legacy_pk = st.terget_id
          WHERE rtrim(st.terget_cat) = '1'
            AND st.start_date <= $1::text AND st.end_date >= $2::text
            AND ($6::text[] IS NULL OR st.user_id = ANY($6::text[]))
       ),
       base AS (
         SELECT tg.*, v._legacy_pk AS legacy_id, v.com_id, v.user_id, v.package, v.extra_discount,
                v.status, v.renwal, v.droupout, v."finalComm" AS final_comm, v.create_date, v.pay_date
           FROM tg
           JOIN legacy_archive.webxl_verify_gm v
             ON v.user_id = tg.t_user AND lower(rtrim(v.package)) = lower(rtrim(tg.t_package))
          WHERE lower(rtrim(v.acc_disc_status)) = 'approved'
            AND lower(rtrim(v.ceo_disc_status)) = 'approved'
            AND left(v.create_date, 10) >= $3::text AND left(v.create_date, 10) <= $2::text
       ),
       ga AS (
         SELECT g._legacy_pk::bigint AS gid, g.com_id, g.user_id, g."bvDate" AS bv_date, g.user_bv_date
           FROM legacy_archive.webxl_gmaccount g
          WHERE g.com_id IN (SELECT com_id FROM base)
       ),
       bv AS (
         SELECT DISTINCT ON (com_id, user_id) com_id, user_id, bv_date
           FROM ga
          WHERE bv_date ~ '^\\d{4}-\\d{2}-\\d{2}'
            AND left(bv_date, 10) >= $1::text AND left(bv_date, 10) <= $2::text
          ORDER BY com_id, user_id, gid
       ),
       first_com AS (
         SELECT DISTINCT ON (com_id) com_id, user_bv_date FROM ga ORDER BY com_id, gid
       ),
       ach AS (
         SELECT COUNT(*) FILTER (WHERE left(v.create_date, 10) >= $1::text AND left(v.create_date, 10) <= $2::text) AS achieved,
                COUNT(*) FILTER (WHERE left(v.create_date, 10) >= $4::text AND left(v.create_date, 10) <= $5::text) AS achieved_last
           FROM legacy_archive.webxl_gmaccount g
           JOIN legacy_archive.webxl_verify_gm v ON v.com_id = g.com_id
          WHERE $7::text IS NOT NULL AND g.user_id = $7::text AND trim(v.renwal) = '1'
       )
       SELECT b.st_id, b.t_user, b.target_num, b.terget_name, b.conversion, b.t_price, b.reward, b.kwa, b.vas,
              b.legacy_id, b.com_id, b.package, b.extra_discount, b.status, b.renwal, b.droupout,
              b.final_comm, b.create_date, b.pay_date,
              bv.bv_date, f.user_bv_date,
              c.cname, u.name AS person_name,
              mu.modern_id AS person_id, mc.modern_id AS customer_id, mg.modern_id AS gm_entry_id,
              ge.final_comm AS app_final_comm,
              ach.achieved, ach.achieved_last
         FROM base b
         JOIN bv ON bv.com_id = b.com_id AND bv.user_id = b.user_id
         CROSS JOIN ach
         LEFT JOIN first_com f ON f.com_id = b.com_id
         LEFT JOIN legacy_archive.webxl_company c
           ON c._source_table = 'webxl_company' AND c._legacy_pk = b.com_id
         LEFT JOIN legacy_archive.webxl_user u
           ON u._source_table = 'webxl_user' AND u._legacy_pk = c."assignId"
         LEFT JOIN migration_meta.migration_legacy_ids mu
           ON mu.entity_type = 'user' AND mu.legacy_table = 'webxl_user' AND mu.legacy_id = b.user_id
         LEFT JOIN migration_meta.migration_legacy_ids mc
           ON mc.entity_type = 'customer' AND mc.legacy_table = 'webxl_company' AND mc.legacy_id = b.com_id
         LEFT JOIN migration_meta.migration_legacy_ids mg
           ON mg.entity_type = 'gm_entry' AND mg.legacy_table = 'webxl_verify_gm' AND mg.legacy_id = b.legacy_id
         -- commission edited in the new app (wins over the old finalComm / computed value)
         LEFT JOIN drm.gm_entries ge ON ge.id::text = mg.modern_id
        ORDER BY b.st_id::bigint, b.legacy_id::bigint DESC`,
      [startYmd, endYmd, lastM, startLast, endLast, legacyUserIds, achievementUser],
    ),
    getBvReportCompanyWide(userIds, fromDate, toDate),
  ]);

  const modernIds = modern.details.map((d: any) => String(d.gmEntryId ?? d.id));
  const mappedIds = new Set<string>();
  if (modernIds.length > 0) {
    const mapped = await pool.query<{ modern_id: string }>(
      `SELECT modern_id FROM migration_meta.migration_legacy_ids
        WHERE modern_table = 'gm_entries' AND legacy_table = 'webxl_verify_gm' AND modern_id = ANY($1::text[])`,
      [modernIds],
    );
    for (const r of mapped.rows) mappedIds.add(r.modern_id);
  }
  const modernDetails = modern.details
    .filter((d: any) => !mappedIds.has(String(d.gmEntryId ?? d.id)))
    .map((d: any) => ({ ...d, rcNew: gmTypeLabel(d.rcNew), status: gmTypeLabel(d.status), source: "modern" }));
  // Commission edited in the new app wins for new-app GMs too.
  if (modernDetails.length > 0) {
    const fc = await pool.query<{ id: string; final_comm: string | null }>(
      `SELECT id::text AS id, final_comm FROM drm.gm_entries WHERE id::text = ANY($1::text[]) AND final_comm IS NOT NULL`,
      [modernDetails.map((d: any) => String(d.gmEntryId ?? d.id))],
    );
    const byId = new Map(fc.rows.map((r) => [r.id, Number(r.final_comm)]));
    for (const d of modernDetails as any[]) {
      const v = byId.get(String(d.gmEntryId ?? d.id));
      if (v != null) { d.comm = v; d.commEdited = true; }
    }
  }

  // Old dates as plain 'YYYY-MM-DD' (what the old page printed); invalid -> null.
  const ymd = (s: string | null) => {
    const v = (s ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}/.test(v) && !v.startsWith("0000") ? v.slice(0, 10) : null;
  };
  const num = (s: string | null) => (Number.isFinite(Number(s)) ? Number(s) : 0);

  let lastTarget: { personId: string | null; targetName: string; targetQuota: number; achieved: number } | null = null;
  let lastRowTarget: number | null = null;
  let legacyRcCount = 0;
  const legacyDetails = legacyResult.rows.map((r, idx) => {
    const target = num(r.target_num) / targetDivisor;
    lastRowTarget = target;
    if (phpLooseEq(r.renwal, 0)) legacyRcCount++;
    const achieved = Number(r.achieved) || 0;
    const createdYmd = ymd(r.create_date) ?? "";
    const commEdited = (r as any).app_final_comm != null;
    const comm = commEdited
      ? Number((r as any).app_final_comm)
      : legacyBvComm(r, {
          achieved,
          achievedLastMonth: Number(r.achieved_last) || 0,
          target,
          inLastMonth: createdYmd >= startLast && createdYmd <= endLast,
        });
    lastTarget = { personId: r.person_id, targetName: r.terget_name ?? "", targetQuota: Math.round(target * 10) / 10, achieved };
    const rcNew = gmTypeLabel(r.renwal);
    return {
      // A GM can appear under two targets — keep React keys unique.
      id: `${r.gm_entry_id ?? `legacy-gm-${r.legacy_id}`}:${r.st_id}:${idx}`,
      gmEntryId: r.gm_entry_id,
      legacyGmId: r.legacy_id,
      comId: r.com_id,
      customerId: r.customer_id,
      companyName: r.cname,
      package: r.package,
      price: num(r.t_price),
      extraDisc: num(r.extra_discount),
      comm,
      commEdited,
      reward: num(r.reward),
      vas: num(r.vas),
      kwa: num(r.kwa),
      method: r.status || "-",
      personName: r.person_name,
      personId: r.person_id,
      pay: ymd(r.pay_date),
      bvSubmit: ymd(r.user_bv_date),
      bv: ymd(r.bv_date),
      accountBvDate: ymd(r.bv_date),
      rcNew,
      status: rcNew,
      // DropoutTiltle(): 1..5 -> label, anything else "None".
      dropout: LEGACY_DROPOUT_LABELS[String([1, 2, 3, 4, 5].find((n) => phpLooseEq(r.droupout, n)))] ?? "None",
      type: rcNew,
      targetName: r.terget_name,
      paymentReceived: createdYmd || null,
      date: createdYmd || null,
      source: "legacy",
    };
  });

  const details = [...legacyDetails, ...modernDetails];
  const sum = (key: string) => details.reduce((s, d: any) => s + (Number(d[key]) || 0), 0);
  const personAchievement = [...(modern.personAchievement ?? [])];
  const lt = lastTarget as { personId: string | null; targetName: string; targetQuota: number; achieved: number } | null;
  if (achievementUser && lt?.personId && !personAchievement.some((a) => a.personId === lt.personId)) {
    // Footer "T.No# achieved/target" of the old page (last target processed).
    personAchievement.push({ personId: lt.personId, targetName: lt.targetName, targetQuota: lt.targetQuota, achievedCount: lt.achieved });
  }
  let footer: BvLegacyFooter | null = null;
  const footerStats = await footerStatsPromise;
  if (footerStats && achievementUser && userIds && userIds.length === 1) {
    const fs = footerStats.rows[0];
    const achieved = Number(fs?.achieved) || 0;
    const targetQuota = num(fs?.target_num ?? null) / targetDivisor;
    const rowT = lastRowTarget as number | null;
    const achievePct = rowT ? Math.round((achieved * 100) / rowT) : 0;
    const legacySum = (key: string) => legacyDetails.reduce((s2, d: any) => s2 + (Number(d[key]) || 0), 0);
    let rewardOverride: number | null = null;
    if (achieved >= targetQuota && achievePct >= 100 && !["39", "54", "47", "35"].includes(achievementUser)) {
      const roles = String(fs?.role_id ?? "").split(",").map((x) => x.trim());
      const dAndDAssistant = roles.includes("27") || roles.includes("28") || roles.includes("29");
      rewardOverride = monthsDiff === 1 && !dAndDAssistant ? 5000 : 0;
    }
    const comm = legacySum("comm");
    const reward = rewardOverride ?? legacySum("reward");
    const rewardInFinal = achieved >= targetQuota;
    footer = {
      personId: userIds[0],
      legacyUserId: achievementUser,
      targetName: fs?.terget_name ?? null,
      achieved,
      targetQuota,
      teamTotal: Number(fs?.team_total) || 0,
      achievePct,
      rewardOverride,
      rewardInFinal,
      rcRate: 1000,
      totals: {
        price: legacySum("price"),
        extraDisc: Math.round(legacySum("extraDisc") * 100) / 100,
        comm,
        reward,
        vas: legacySum("vas"),
        kwa: legacySum("kwa"),
        rcCount: legacyRcCount,
        rcAmount: legacyRcCount * 1000,
        finalCom: rewardInFinal ? Math.round(comm + reward) : comm,
      },
    };
  }

  return {
    ...modern,
    footer,
    metrics: { ...modern.metrics, totalTasks: details.length, valueOfServiceSold: sum("price") },
    chartData: generateChartData(
      details.map((d: any) => ({ createdAt: d.date, price: d.price })),
      fromDate,
      toDate,
      "price",
    ),
    details,
    totals: {
      totalAdvance: sum("price"),
      totalRemaining: 0,
      totalComm: sum("comm"),
      totalReward: sum("reward"),
      totalVas: sum("vas"),
      totalKwa: sum("kwa"),
    },
    reportCount: details.length,
    personAchievement,
  };
}

// GM SYSTEM page (/analytics/gm) — old-DRM parity.
//
// Port of func.php's `user_id_gm_view`. Migrated gm_entries lack most of the
// old columns (KWA/PSA, BV dates, accountant/HOD status), so old-DRM GMs are
// read from legacy_archive.webxl_verify_gm. Filters, as in PHP:
//   user     -> verify_gm.user_id = selected user's old id; City and Package
//               only apply when "All" users is selected (PHP ignored them
//               otherwise); City = webxl_user.branch of the GM's user.
//   type     -> renwal code (gmTypeLabel: New 1, Rc 0, Ec 2, Rc-Up 3, Kwa 4,
//               None = anything else).
//   behalf   -> Payment Type: Full = empty webxl_behalf, else exact value
//               (Installment / Delay / Extra Discount).
//   normal   -> acc_disc_status & ceo_disc_status 'Approved', package not
//               Kwa/Psa, date(create_request) in [from, to].
//   abPay    -> the date tested is pay_date instead (create_date in Q Wise).
//   qWise    -> no approval / package exclusion; date(create_date) in
//               [from, to]; one table per Alibaba quarter overlapping the
//               range (Q1 Apr-Jun ... Q4 Jan-Mar), each listing the SAME rows
//               with that quarter's target and a running amount total — the
//               old page did exactly that.
export type GmSystemFilters = {
  city?: string | null;
  pkg?: string | null;
  type?: string | null;
  behalf?: string | null;
  qWise?: boolean;
  abPayDate?: boolean;
  /** Server-side pagination for GM View (/analytics/gm) — avoids loading every row at once. */
  page?: number;
  pageSize?: number;
};

const GM_TYPE_CODE_BY_LABEL: Record<string, string> = { New: "1", Rc: "0", Ec: "2", "Rc-Up": "3", Kwa: "4" };

const GM_LEGACY_GEM_ENTRIES_APPROVED_PRED = `
       lower(coalesce(ge.approval_status, '')) = 'approved'
       OR lower(coalesce(ge.final_status, '')) = 'approved'
       OR lower(coalesce(ge.status::text, '')) IN ('approved', 'completed')
       OR lower(coalesce(ge.account_manager_status, '')) = 'approved'
       OR lower(coalesce(ge.accountant_status, '')) = 'approved'`;

/**
 * Narrow verify_gm by user/date first, then hit gm_entries only for rows whose
 * archive acc_disc is not already Approved (avoids scanning all migrated GMs).
 */
const GM_LEGACY_FILTERED_CTE = `
candidates AS (
  SELECT v._legacy_pk, v.com_id, v.user_id, v.member_id, v.package, v.amount, v.discount,
         v.extra_discount, v.status, v.renwal, v.pay_date, v.create_request, v.create_date,
         v.updated_at, v.acc_disc_status, v.ceo_disc_status, v.webxl_behalf
    FROM legacy_archive.webxl_verify_gm v
    LEFT JOIN legacy_archive.webxl_user wu
      ON wu._source_table = 'webxl_user' AND wu._legacy_pk = v.user_id
   WHERE ($1::text[] IS NULL OR v.user_id = ANY($1::text[]))
     AND ($1::text[] IS NOT NULL OR $2::text IS NULL OR lower(rtrim(wu.branch)) = lower(rtrim($2::text)))
     AND ($1::text[] IS NOT NULL OR $3::text IS NULL OR lower(rtrim(v.package)) = lower(rtrim($3::text)))
     AND ($4::text IS NULL OR trim(v.renwal) = $4::text)
     AND (NOT $5::boolean OR COALESCE(trim(v.renwal), '') NOT IN ('0', '1', '2', '3', '4'))
     AND ($6::text IS NULL
          OR ($6::text = 'Full' AND COALESCE(v.webxl_behalf, '') = '')
          OR lower(rtrim(v.webxl_behalf)) = lower(rtrim($6::text)))
     AND (CASE WHEN $8::boolean THEN v.pay_date
               WHEN $7::boolean THEN v.create_date
               ELSE v.create_request END) ~ '^[1-9]\\d{3}-\\d{2}-\\d{2}'
     AND left(CASE WHEN $8::boolean THEN v.pay_date
                   WHEN $7::boolean THEN v.create_date
                   ELSE v.create_request END, 10) BETWEEN $9::text AND $10::text
),
stale_acc AS (
  SELECT c._legacy_pk FROM candidates c
   WHERE NOT $7::boolean
     AND lower(rtrim(c.ceo_disc_status)) = 'approved'
     AND lower(rtrim(c.acc_disc_status)) <> 'approved'
),
approved_overlay AS (
  SELECT DISTINCT mg.legacy_id
    FROM migration_meta.migration_legacy_ids mg
    INNER JOIN drm.gm_entries ge ON ge.id::text = mg.modern_id
   WHERE mg.modern_table = 'gm_entries'
     AND mg.legacy_table = 'webxl_verify_gm'
     AND mg.legacy_id IN (SELECT _legacy_pk FROM stale_acc)
     AND (${GM_LEGACY_GEM_ENTRIES_APPROVED_PRED})
),
filtered AS (
  SELECT c.*
    FROM candidates c
   WHERE $7::boolean
      OR (
        lower(rtrim(c.ceo_disc_status)) = 'approved'
        AND (
          lower(rtrim(c.acc_disc_status)) = 'approved'
          OR c._legacy_pk IN (SELECT legacy_id FROM approved_overlay)
        )
      )
)`;

// aliBabaQuesMontAccordingToYears(): Q1..Q4 of each year, Q4 = Jan-Mar of
// that same year (listed last), kept when it overlaps the range.
function alibabaQuarters(startYmd: string, endYmd: string) {
  const defs: [string, string, string][] = [
    ["Q1", "-04-01", "-06-30"],
    ["Q2", "-07-01", "-09-30"],
    ["Q3", "-10-01", "-12-31"],
    ["Q4", "-01-01", "-03-31"],
  ];
  const out: { year: number; quarter: string; startDate: string; endDate: string }[] = [];
  for (let y = Number(startYmd.slice(0, 4)); y <= Number(endYmd.slice(0, 4)); y++) {
    for (const [quarter, s, e] of defs) {
      const qs = `${y}${s}`;
      const qe = `${y}${e}`;
      if ((qs >= startYmd && qs <= endYmd) || (qe >= startYmd && qe <= endYmd) || (startYmd >= qs && endYmd <= qe)) {
        out.push({ year: y, quarter, startDate: qs, endDate: qe });
      }
    }
  }
  return out;
}

export async function getGmSystemLegacyReport(
  userIds: string[] | null,
  fromDate: Date,
  toDate: Date,
  filters: GmSystemFilters = {},
): Promise<ReportData & { qWise?: unknown; gmTotals?: unknown; pagination?: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const startYmd = localYmd(fromDate);
  const endYmd = localYmd(toDate);
  const qWise = Boolean(filters.qWise);
  const abPay = Boolean(filters.abPayDate);
  const usePagination = !qWise && !abPay;
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));
  const legacyLimit = usePagination ? pageSize : 50_000;
  const legacyOffset = usePagination ? (page - 1) * pageSize : 0;
  const typeLabel = filters.type && filters.type !== "all" ? filters.type : null;
  const renwalCode = typeLabel ? (GM_TYPE_CODE_BY_LABEL[typeLabel] ?? null) : null;
  const typeNone = typeLabel === "None";
  const behalf = filters.behalf && filters.behalf !== "all" ? filters.behalf : null;
  const city = filters.city && filters.city !== "all" ? filters.city : null;
  const pkg = filters.pkg && filters.pkg !== "all" ? filters.pkg : null;

  let legacyUserIds: string[] | null = null;
  if (userIds && userIds.length > 0) {
    const mapped = await pool.query<{ legacy_id: string }>(
      `SELECT legacy_id FROM migration_meta.migration_legacy_ids
        WHERE modern_table = 'users' AND legacy_table = 'webxl_user' AND modern_id = ANY($1::text[])`,
      [userIds],
    );
    legacyUserIds = mapped.rows.map((r) => r.legacy_id);
  }

  const legacyBaseParams = [legacyUserIds, city, pkg, renwalCode, typeNone, behalf, qWise, abPay, startYmd, endYmd];

  type LegacyRow = {
    legacy_id: string;
    com_id: string;
    member_id: string | null;
    package: string | null;
    amount: string | null;
    discount: string | null;
    extra_discount: string | null;
    status: string | null;
    renwal: string | null;
    pay_date: string | null;
    create_request: string | null;
    create_date: string | null;
    updated_at: string | null;
    acc_disc_status: string | null;
    ceo_disc_status: string | null;
    webxl_behalf: string | null;
    cname: string | null;
    person_name: string | null;
    person_id: string | null;
    seller_id: string | null;
    customer_id: string | null;
    gm_entry_id: string | null;
    user_bv_date: string | null;
    gm_start: string | null;
    kwa_type: string | null;
    kwa_value: string | null;
    package_price: string | null;
  };

  let legacyStats: { total: number; discount_sum: string; extra_sum: string; amount_sum: string } | undefined;

  const legacyPageSelect = `
     ga AS (
       SELECT DISTINCT ON (g.com_id) g.com_id, g.user_bv_date, g."startData" AS gm_start
         FROM legacy_archive.webxl_gmaccount g
        WHERE g.com_id IN (SELECT com_id FROM page_slice)
        ORDER BY g.com_id, g._legacy_pk::bigint
     ),
     kw AS (
       SELECT DISTINCT ON (k.com_id) k.com_id, k.type AS kwa_type, k.kwa AS kwa_value
         FROM legacy_archive.webxl_kwa k
        WHERE k.com_id IN (SELECT com_id FROM page_slice)
        ORDER BY k.com_id, k._legacy_pk::bigint
     ),
     pk AS (
       SELECT DISTINCT ON (lower(rtrim(p.name))) lower(rtrim(p.name)) AS name_key, p.price
         FROM legacy_archive.webxl_ab_packages p
        ORDER BY lower(rtrim(p.name)), p._legacy_pk::bigint
     )
     SELECT b._legacy_pk AS legacy_id, b.com_id, b.member_id, b.package, b.amount, b.discount,
            b.extra_discount, b.status, b.renwal, b.pay_date, b.create_request, b.create_date,
            b.updated_at, b.acc_disc_status, b.ceo_disc_status, b.webxl_behalf,
            c.cname, u.name AS person_name, mu.modern_id AS person_id, ms.modern_id AS seller_id,
            mc.modern_id AS customer_id, mg.modern_id AS gm_entry_id,
            ga.user_bv_date, ga.gm_start, kw.kwa_type, kw.kwa_value, pk.price AS package_price
       FROM page_slice b
       LEFT JOIN legacy_archive.webxl_company c
         ON c._source_table = 'webxl_company' AND c._legacy_pk = b.com_id
       LEFT JOIN legacy_archive.webxl_user u
         ON u._source_table = 'webxl_user' AND u._legacy_pk = c."assignId"
       LEFT JOIN migration_meta.migration_legacy_ids mu
         ON mu.entity_type = 'user' AND mu.legacy_table = 'webxl_user' AND mu.legacy_id = c."assignId"
       LEFT JOIN migration_meta.migration_legacy_ids ms
         ON ms.entity_type = 'user' AND ms.legacy_table = 'webxl_user' AND ms.legacy_id = b.user_id
       LEFT JOIN migration_meta.migration_legacy_ids mc
         ON mc.entity_type = 'customer' AND mc.legacy_table = 'webxl_company' AND mc.legacy_id = b.com_id
       LEFT JOIN migration_meta.migration_legacy_ids mg
         ON mg.entity_type = 'gm_entry' AND mg.legacy_table = 'webxl_verify_gm' AND mg.legacy_id = b._legacy_pk
       LEFT JOIN ga ON ga.com_id = b.com_id
       LEFT JOIN kw ON kw.com_id = b.com_id
       LEFT JOIN pk ON pk.name_key = lower(rtrim(b.package))
      ORDER BY b._legacy_pk::bigint DESC`;

  let legacy: { rows: LegacyRow[] };

  if (usePagination) {
    const combined = await pool.query<{
      stats: { total: number; discount_sum: string; extra_sum: string; amount_sum: string };
      rows: LegacyRow[];
    }>(
      `WITH ${GM_LEGACY_FILTERED_CTE},
       stats AS (
         SELECT COUNT(*)::int AS total,
                COALESCE(SUM(CASE WHEN trim(discount) ~ '^-?[0-9.]+$' THEN trim(discount)::numeric ELSE 0 END), 0)::text AS discount_sum,
                COALESCE(SUM(CASE WHEN trim(extra_discount) ~ '^-?[0-9.]+$' THEN trim(extra_discount)::numeric ELSE 0 END), 0)::text AS extra_sum,
                COALESCE(SUM(CASE WHEN trim(amount) ~ '^-?[0-9.]+$' THEN trim(amount)::numeric ELSE 0 END), 0)::text AS amount_sum
           FROM filtered
       ),
       page_slice AS (
         SELECT * FROM filtered
         ORDER BY _legacy_pk::bigint DESC
         LIMIT $11::int OFFSET $12::int
       ),
       ga AS (
         SELECT DISTINCT ON (g.com_id) g.com_id, g.user_bv_date, g."startData" AS gm_start
           FROM legacy_archive.webxl_gmaccount g
          WHERE g.com_id IN (SELECT com_id FROM page_slice)
          ORDER BY g.com_id, g._legacy_pk::bigint
       ),
       kw AS (
         SELECT DISTINCT ON (k.com_id) k.com_id, k.type AS kwa_type, k.kwa AS kwa_value
           FROM legacy_archive.webxl_kwa k
          WHERE k.com_id IN (SELECT com_id FROM page_slice)
          ORDER BY k.com_id, k._legacy_pk::bigint
       ),
       pk AS (
         SELECT DISTINCT ON (lower(rtrim(p.name))) lower(rtrim(p.name)) AS name_key, p.price
           FROM legacy_archive.webxl_ab_packages p
          ORDER BY lower(rtrim(p.name)), p._legacy_pk::bigint
       )
       SELECT (SELECT row_to_json(s) FROM stats s) AS stats,
              COALESCE(
                (SELECT json_agg(row_to_json(p) ORDER BY (p.legacy_id)::bigint DESC)
                   FROM (
                     SELECT b._legacy_pk AS legacy_id, b.com_id, b.member_id, b.package, b.amount, b.discount,
                            b.extra_discount, b.status, b.renwal, b.pay_date, b.create_request, b.create_date,
                            b.updated_at, b.acc_disc_status, b.ceo_disc_status, b.webxl_behalf,
                            c.cname, u.name AS person_name, mu.modern_id AS person_id, ms.modern_id AS seller_id,
                            mc.modern_id AS customer_id, mg.modern_id AS gm_entry_id,
                            ga.user_bv_date, ga.gm_start, kw.kwa_type, kw.kwa_value, pk.price AS package_price
                       FROM page_slice b
                       LEFT JOIN legacy_archive.webxl_company c
                         ON c._source_table = 'webxl_company' AND c._legacy_pk = b.com_id
                       LEFT JOIN legacy_archive.webxl_user u
                         ON u._source_table = 'webxl_user' AND u._legacy_pk = c."assignId"
                       LEFT JOIN migration_meta.migration_legacy_ids mu
                         ON mu.entity_type = 'user' AND mu.legacy_table = 'webxl_user' AND mu.legacy_id = c."assignId"
                       LEFT JOIN migration_meta.migration_legacy_ids ms
                         ON ms.entity_type = 'user' AND ms.legacy_table = 'webxl_user' AND ms.legacy_id = b.user_id
                       LEFT JOIN migration_meta.migration_legacy_ids mc
                         ON mc.entity_type = 'customer' AND mc.legacy_table = 'webxl_company' AND mc.legacy_id = b.com_id
                       LEFT JOIN migration_meta.migration_legacy_ids mg
                         ON mg.entity_type = 'gm_entry' AND mg.legacy_table = 'webxl_verify_gm' AND mg.legacy_id = b._legacy_pk
                       LEFT JOIN ga ON ga.com_id = b.com_id
                       LEFT JOIN kw ON kw.com_id = b.com_id
                       LEFT JOIN pk ON pk.name_key = lower(rtrim(b.package))
                   ) p),
                '[]'::json
              ) AS rows`,
      [...legacyBaseParams, legacyLimit, legacyOffset],
    );
    const row0 = combined.rows[0];
    legacyStats = row0?.stats ?? undefined;
    const rawRows = row0?.rows;
    legacy = { rows: Array.isArray(rawRows) ? rawRows : [] };
  } else {
    legacy = await pool.query<LegacyRow>(
      `WITH ${GM_LEGACY_FILTERED_CTE},
       page_slice AS (
         SELECT * FROM filtered
         ORDER BY _legacy_pk::bigint DESC
         LIMIT $11::int OFFSET $12::int
       ),
       ${legacyPageSelect}`,
      [...legacyBaseParams, legacyLimit, legacyOffset],
    );
  }

  const numOrNull = (s: string | null) => (s != null && s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : null);
  const legacyDetails = legacy.rows.map((r) => {
    const rcNew = gmTypeLabel(r.renwal);
    return {
      id: r.gm_entry_id ?? `legacy-gm-${r.legacy_id}`,
      gmEntryId: r.gm_entry_id,
      legacyGmId: r.legacy_id,
      comId: r.com_id,
      customerId: r.customer_id,
      memberId: r.member_id,
      companyName: r.cname,
      package: r.package,
      // First webxl_kwa row of the company: type Kwa -> KWA column, Psa -> PSA.
      kwa: r.kwa_type === "Kwa" ? r.kwa_value : null,
      psa: r.kwa_type === "Psa" ? r.kwa_value : null,
      // P.A = webxl_ab_packages.price for the package name.
      packagePriceUsd: numOrNull(r.package_price),
      amount: numOrNull(r.amount),
      discount: numOrNull(r.discount),
      extraDiscount: numOrNull(r.extra_discount),
      method: r.status,
      payDate: legacyWallClock(r.pay_date),
      bvSubmitDate: legacyWallClock(r.user_bv_date),
      // Old "BV Date" = gmCom(com_id)['startData'] (first gmaccount row).
      bvDate: legacyWallClock(r.gm_start),
      person: r.person_name,
      personName: r.person_name,
      personId: r.person_id,
      salesPersonId: r.seller_id,
      rcNew,
      type: rcNew,
      paymentType: (r.webxl_behalf ?? "").trim() === "" ? "Full" : r.webxl_behalf,
      accountantStatus: r.acc_disc_status,
      hodStatus: r.ceo_disc_status,
      gmCreationDate: legacyWallClock(r.create_request),
      // Q Wise "HOD Approvel Date" = create_date; normal view = updated_at.
      hodApprovedDate: qWise ? legacyWallClock(r.create_date) : legacyWallClock(r.updated_at),
      lastUpdateDate: legacyWallClock(r.updated_at),
      date: legacyWallClock(r.create_request),
      source: "legacy",
    };
  });

  // Modern gm_entries in range (account-approved): fills gaps where legacy
  // webxl_verify_gm dates/status are stale, plus brand-new rows with no legacy row.
  let modernDetails: any[] = [];
  // Paginated GM View: skip full gm_entries scan — legacy page + small orphan batch is enough.
  const modern = usePagination
    ? { details: [] as any[], metrics: { totalTasks: 0 }, chartData: [] as any[], type: "gm" as const, dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() }, meta: { from: fromDate.toISOString(), to: toDate.toISOString(), timezone: tz } }
    : await getGmReport(userIds, fromDate, toDate, true);
  if (!qWise && !abPay && !usePagination && modern.details.length > 0) {
    const legacyMemberIds = new Set(
      legacyDetails.map((d) => String(d.memberId ?? "").trim().toLowerCase()).filter(Boolean),
    );
    const legacyGmIds = new Set(
      legacyDetails.map((d) => String(d.gmEntryId ?? d.id ?? "").trim()).filter(Boolean),
    );
    modernDetails = modern.details
      .filter((d: any) => {
        const mid = String(d.memberId ?? "").trim().toLowerCase();
        if (mid && legacyMemberIds.has(mid)) return false;
        const gid = String(d.id ?? "").trim();
        if (gid && legacyGmIds.has(gid)) return false;
        return true;
      })
      .map((d: any) => ({
        ...d,
        rcNew: gmTypeLabel(d.rcNew),
        type: gmTypeLabel(d.rcNew),
        gmEntryId: d.id,
        source: "modern",
      }))
      .filter((d: any) => !typeLabel || d.rcNew === typeLabel)
      .filter(
        (d: any) =>
          (userIds && userIds.length > 0) ||
          !pkg ||
          String(d.package ?? "").toLowerCase() === pkg.toLowerCase(),
      );
  }

  // Legacy rows never migrated to gm_entries — any user / "All" (not only single-user pick).
  if (!qWise && !abPay && !usePagination) {
    const orphanLegacy = await pool.query<typeof legacy.rows[0]>(
      `WITH base AS (
         SELECT v._legacy_pk, v.com_id, v.user_id, v.member_id, v.package, v.amount, v.discount,
                v.extra_discount, v.status, v.renwal, v.pay_date, v.create_request, v.create_date,
                v.updated_at, v.acc_disc_status, v.ceo_disc_status, v.webxl_behalf
           FROM legacy_archive.webxl_verify_gm v
           LEFT JOIN legacy_archive.webxl_user wu
             ON wu._source_table = 'webxl_user' AND wu._legacy_pk = v.user_id
          WHERE ($1::text[] IS NULL OR v.user_id = ANY($1::text[]))
            AND ($1::text[] IS NOT NULL OR $2::text IS NULL OR lower(rtrim(wu.branch)) = lower(rtrim($2::text)))
            AND ($1::text[] IS NOT NULL OR $3::text IS NULL OR lower(rtrim(v.package)) = lower(rtrim($3::text)))
            AND NOT EXISTS (
              SELECT 1 FROM migration_meta.migration_legacy_ids mg
               WHERE mg.legacy_table = 'webxl_verify_gm' AND mg.legacy_id = v._legacy_pk
            )
            AND lower(rtrim(v.ceo_disc_status)) = 'approved'
            AND (
              lower(rtrim(v.acc_disc_status)) = 'approved'
              OR lower(rtrim(v.acc_disc_status)) = 'pending'
            )
            AND v.create_request ~ '^[1-9]\\d{3}-\\d{2}-\\d{2}'
            AND left(v.create_request, 10) BETWEEN $4::text AND $5::text
          ORDER BY v._legacy_pk::bigint DESC
          LIMIT CASE WHEN $6::boolean THEN 40 ELSE 500 END
       )
       SELECT b._legacy_pk AS legacy_id, b.com_id, b.member_id, b.package, b.amount, b.discount,
              b.extra_discount, b.status, b.renwal, b.pay_date, b.create_request, b.create_date,
              b.updated_at, b.acc_disc_status, b.ceo_disc_status, b.webxl_behalf,
              c.cname, u.name AS person_name, mu.modern_id AS person_id, ms.modern_id AS seller_id,
              mc.modern_id AS customer_id, NULL::text AS gm_entry_id,
              ga.user_bv_date, ga.gm_start, kw.kwa_type, kw.kwa_value, pk.price AS package_price
         FROM base b
         LEFT JOIN legacy_archive.webxl_company c
           ON c._source_table = 'webxl_company' AND c._legacy_pk = b.com_id
         LEFT JOIN legacy_archive.webxl_user u
           ON u._source_table = 'webxl_user' AND u._legacy_pk = c."assignId"
         LEFT JOIN migration_meta.migration_legacy_ids mu
           ON mu.entity_type = 'user' AND mu.legacy_table = 'webxl_user' AND mu.legacy_id = c."assignId"
         LEFT JOIN migration_meta.migration_legacy_ids ms
           ON ms.entity_type = 'user' AND ms.legacy_table = 'webxl_user' AND ms.legacy_id = b.user_id
         LEFT JOIN migration_meta.migration_legacy_ids mc
           ON mc.entity_type = 'customer' AND mc.legacy_table = 'webxl_company' AND mc.legacy_id = b.com_id
         LEFT JOIN LATERAL (
           SELECT g.user_bv_date, g."startData" AS gm_start
             FROM legacy_archive.webxl_gmaccount g
            WHERE g.com_id = b.com_id
            ORDER BY g._legacy_pk::bigint
            LIMIT 1
         ) ga ON true
         LEFT JOIN LATERAL (
           SELECT k.type AS kwa_type, k.kwa AS kwa_value
             FROM legacy_archive.webxl_kwa k
            WHERE k.com_id = b.com_id
            ORDER BY k._legacy_pk::bigint
            LIMIT 1
         ) kw ON true
         LEFT JOIN LATERAL (
           SELECT p.price
             FROM legacy_archive.webxl_ab_packages p
            WHERE lower(rtrim(p.name)) = lower(rtrim(b.package))
            ORDER BY p._legacy_pk::bigint
            LIMIT 1
         ) pk ON true`,
      [legacyUserIds, city, pkg, startYmd, endYmd, usePagination],
    );
    const seenMemberIds = new Set(
      [...legacyDetails, ...modernDetails]
        .map((d) => String(d.memberId ?? "").trim().toLowerCase())
        .filter(Boolean),
    );
    for (const r of orphanLegacy.rows) {
      const mid = String(r.member_id ?? "").trim().toLowerCase();
      if (mid && seenMemberIds.has(mid)) continue;
      const rcNew = gmTypeLabel(r.renwal);
      legacyDetails.push({
        id: `legacy-gm-${r.legacy_id}`,
        gmEntryId: null,
        legacyGmId: r.legacy_id,
        comId: r.com_id,
        customerId: r.customer_id,
        memberId: r.member_id,
        companyName: r.cname,
        package: r.package,
        kwa: r.kwa_type === "Kwa" ? r.kwa_value : null,
        psa: r.kwa_type === "Psa" ? r.kwa_value : null,
        packagePriceUsd: numOrNull(r.package_price),
        amount: numOrNull(r.amount),
        discount: numOrNull(r.discount),
        extraDiscount: numOrNull(r.extra_discount),
        method: r.status,
        payDate: legacyWallClock(r.pay_date),
        bvSubmitDate: legacyWallClock(r.user_bv_date),
        bvDate: legacyWallClock(r.gm_start),
        person: r.person_name,
        personName: r.person_name,
        personId: r.person_id,
        salesPersonId: r.seller_id,
        rcNew,
        type: rcNew,
        paymentType: (r.webxl_behalf ?? "").trim() === "" ? "Full" : r.webxl_behalf,
        accountantStatus: r.acc_disc_status,
        hodStatus: r.ceo_disc_status,
        gmCreationDate: legacyWallClock(r.create_request),
        hodApprovedDate: qWise ? legacyWallClock(r.create_date) : legacyWallClock(r.updated_at),
        lastUpdateDate: legacyWallClock(r.updated_at),
        date: legacyWallClock(r.create_request),
        source: "legacy-unmigrated",
      });
      if (mid) seenMemberIds.add(mid);
    }
  }

  // Display: if legacy archive still says Pending but modern gm_entries is approved, show Approved (all users).
  const linkedGmIds = legacyDetails
    .map((d) => (d.gmEntryId ? String(d.gmEntryId) : null))
    .filter(Boolean) as string[];
  if (linkedGmIds.length > 0) {
    const acctRows = await pool.query<{ id: string; accountant_status: string | null; account_manager_status: string | null }>(
      `SELECT id::text AS id, accountant_status, account_manager_status FROM drm.gm_entries WHERE id::text = ANY($1::text[])`,
      [linkedGmIds],
    );
    const acctById = new Map(acctRows.rows.map((r) => [r.id, r]));
    for (const d of legacyDetails) {
      if (!d.gmEntryId) continue;
      const row = acctById.get(String(d.gmEntryId));
      if (!row) continue;
      const acc = String(row.accountant_status ?? "").trim();
      const am = String(row.account_manager_status ?? "").trim();
      if (acc || am) {
        const legacyAcc = String(d.accountantStatus ?? "").toLowerCase();
        if (legacyAcc !== "approved" && (acc.toLowerCase() === "approved" || am.toLowerCase() === "approved")) {
          d.accountantStatus = "Approved";
        }
      }
    }
  }

  const details = [...legacyDetails, ...modernDetails];
  const sumOf = (rows: any[], key: string) => rows.reduce((s, d) => s + (Number(d[key]) || 0), 0);

  let qWiseInfo: unknown = undefined;
  if (qWise) {
    const quarters = alibabaQuarters(startYmd, endYmd);
    // Quarter target: the selected user's webxl_setterget row (terget_cat 1)
    // for exactly that quarter; "All" has none (PHP looked up user 'All').
    const targetUser = legacyUserIds && legacyUserIds.length === 1 ? legacyUserIds[0] : null;
    const targets = new Map<string, number | null>();
    if (targetUser && quarters.length > 0) {
      const t = await pool.query<{ start_date: string; end_date: string; target_num: string | null }>(
        `SELECT DISTINCT ON (start_date, end_date) start_date, end_date, target_num
           FROM legacy_archive.webxl_setterget
          WHERE rtrim(terget_cat) = '1' AND user_id = $1
            AND (start_date, end_date) IN (SELECT * FROM unnest($2::text[], $3::text[]))
          ORDER BY start_date, end_date, _legacy_pk::bigint`,
        [targetUser, quarters.map((q) => q.startDate), quarters.map((q) => q.endDate)],
      );
      for (const r of t.rows) targets.set(`${r.start_date}|${r.end_date}`, numOrNull(r.target_num));
    }
    const amount = sumOf(legacyDetails, "amount");
    qWiseInfo = {
      quarters: quarters.map((q, i) => ({
        ...q,
        target: targets.get(`${q.startDate}|${q.endDate}`) ?? null,
        count: legacyDetails.length,
        // PHP never reset $TotalAmount between quarters.
        achievedAmount: amount * (i + 1),
      })),
    };
  }

  const reportCount = usePagination && legacyStats
    ? legacyStats.total
    : details.length;
  const gmTotals = usePagination && legacyStats
    ? {
        discount: Number(legacyStats.discount_sum) || 0,
        extraDiscount: Math.round((Number(legacyStats.extra_sum) || 0) * 100) / 100,
        amount: Number(legacyStats.amount_sum) || 0,
      }
    : {
        discount: sumOf(details, "discount"),
        extraDiscount: Math.round(sumOf(details, "extraDiscount") * 100) / 100,
        amount: sumOf(details, "amount"),
      };

  return {
    ...modern,
    metrics: { ...modern.metrics, totalTasks: reportCount },
    details,
    reportCount,
    qWise: qWiseInfo,
    gmTotals,
    ...(usePagination
      ? {
          pagination: {
            page,
            pageSize,
            total: reportCount,
            totalPages: Math.max(1, Math.ceil(reportCount / pageSize)),
          },
        }
      : {}),
  };
}

// Filter options of the GM SYSTEM page: the old package names
// (webxl_ab_packages + names actually used on old GMs) and branches.
export async function getGmSystemFilterOptions(): Promise<{ packages: string[]; cities: string[] }> {
  const { rows } = await pool.query<{ kind: string; value: string }>(
    `SELECT DISTINCT 'package' AS kind, rtrim(name) AS value FROM legacy_archive.webxl_ab_packages
      WHERE COALESCE(rtrim(name), '') <> ''
     UNION
     SELECT DISTINCT 'package', rtrim(package) FROM legacy_archive.webxl_verify_gm
      WHERE COALESCE(rtrim(package), '') NOT IN ('', '0')
     UNION
     SELECT DISTINCT 'city', rtrim(branch) FROM legacy_archive.webxl_user WHERE COALESCE(rtrim(branch), '') <> ''
     UNION
     SELECT DISTINCT 'city', rtrim(branch) FROM drm.users WHERE COALESCE(rtrim(branch), '') <> ''
     ORDER BY 1, 2`,
  );
  return {
    packages: rows.filter((r) => r.kind === "package").map((r) => r.value),
    cities: rows.filter((r) => r.kind === "city").map((r) => r.value),
  };
}

// "Reports" sidebar VAS Report (?scope=company) — old-DRM parity.
//
// The old VAS SYSTEM page posted to layouts/Controller/VasController.php,
// which is not in this repo; its logic is reconstructed from func.php's VAS
// helpers (also extracted in backend/VAS_Report_Code_For_Claude.md):
//   list rows   = "VAS Payment Report": webxl_payments with date(create_date)
//                 in [from, to]; Company = company cname, Amount, Method =
//                 payment method, Status = the invoice's domain_renewal
//                 (0 -> New, else Renewal), Date = payment create_date. A user
//                 filter keeps payments whose invoice (same com_id +
//                 invoice_id) belongs to that user — the rule every VAS
//                 commission helper uses (userMonthlyAchiveTarget50Kor...).
//   Month Wise  = one user: per month (months_between_dates, day range from
//                 the start/end days) the user's payment total, matched to the
//                 user's VAS targets (setterget terget_cat 3, terget type new)
//                 of that quarter: % = conversion, Comm = round(% * total),
//                 Amount = reward + Comm; footer Due =
//                 AllDuePaymentsPendingByUserByDate. "All": the all-users
//                 commission table (getVasAllUsersCommission).
// New-app records keep getVasReport's logic; migrated invoices that were paid
// in the old DRM (they have webxl_payments rows) are dropped from that half —
// those payments are already listed above.
const VAS_QUARTERS: [string, string][] = [["-01-01", "-03-31"], ["-04-01", "-06-30"], ["-07-01", "-09-30"], ["-10-01", "-12-31"]];

function vasQuarterOf(ym: string): { start: string; end: string } {
  const y = ym.slice(0, 4);
  const m = Number(ym.slice(5, 7));
  const [s, e] = VAS_QUARTERS[Math.floor((m - 1) / 3)];
  return { start: `${y}${s}`, end: `${y}${e}` };
}

// months_between_dates(): 'Y-m' of start, +1 month while start < end.
function phpMonthsBetween(startYmd: string, endYmd: string): string[] {
  const [sy, sm, sd] = startYmd.split("-").map(Number);
  const end = new Date(endYmd + "T00:00:00").getTime();
  const out: string[] = [];
  for (let i = 0; i < 600; i++) {
    const d = new Date(sy, sm - 1 + i, sd);
    if (d.getTime() >= end) break;
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

const VAS_AMOUNT_SQL = (col: string) => `(CASE WHEN ${col} ~ '^-?\\d+(\\.\\d+)?$' THEN ${col}::numeric ELSE 0 END)`;

// Old VasController::renderAllUsersVas — the VAS report's "All" users
// commission table (shown for Select User = All, Month Wise or not):
//   Total  = userMonthlyAchiveTarget50Kor100Kor150K2Inv: the user's
//            webxl_payments in [start, end] (invoice of the same com_id +
//            invoice_id belongs to the user; user 43 new invoices only).
//   slabs  = userVAStargetPer: the user's VAS targets (setterget terget_cat 3,
//            terget type 'new') inside AutoQueSystemDate() = TODAY's calendar
//            quarter (not the selected range's), in table order.
//   The FIRST slab with total >= price wins (the old code had no max_amount
//   check here): % = conversion, Comm = round(% * total), System Reward =
//   reward, Amount = reward + Comm. Users without a matching slab get no row.
//   Paid Reward = reward of the user's first webxl_vas_comm_final row (any
//   month/type), else Comm.
//   Team (SalaryMakeFunTeamVasByDate): webxl_user.underWork = user, each
//   member's payments total; team commission = 5% of the team total.
//   "Already Created" = an hod-Approved 'Vas' / 'Team-Vas' row for the start
//   date's month/year in drm.webxl_vas_comm_final (the old table's copy; user
//   ids there are the old integer ids).
const VAS_TEAM_PER_ALL = 5;
const VAS_VERIFY_ROLES: string[] = [ROLES.ADMIN, ROLES.SUPER_HOD, ROLES.HOD, ROLES.ACCOUNT_MANAGER];
const VAS_COMM_MONTH_SQL = `NULLIF(regexp_replace(COALESCE(f.comm_month, ''), '\\D', '', 'g'), '')::int`;

function vasTodayQuarter(): { start: string; end: string } {
  return vasQuarterOf(localYmd(new Date()).slice(0, 7));
}

export async function getVasAllUsersCommission(legacyUserIds: string[] | null, startYmd: string, endYmd: string) {
  const q = vasTodayQuarter();
  const commMonth = Number(startYmd.slice(5, 7));
  const commYear = startYmd.slice(0, 4);
  const fmtUs = (ymd: string) => `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}/${ymd.slice(0, 4)}`;
  const period = `${fmtUs(startYmd)} To ${fmtUs(endYmd)}`;

  const totals = await pool.query<{ user_id: string; name: string | null; total: string }>(
    `SELECT u.user_id, u.name, SUM(${VAS_AMOUNT_SQL("p.amount")})::text AS total
       FROM legacy_archive.webxl_payments p
       JOIN legacy_archive.webxl_invoice inv
         ON inv._source_table = 'webxl_invoice' AND inv._legacy_pk = p.invoice_id AND inv.com_id = p.com_id
       JOIN legacy_archive.webxl_user u ON u._source_table = 'webxl_user' AND u._legacy_pk = inv.user_id
      WHERE left(p.create_date, 10) >= $1 AND left(p.create_date, 10) <= $2
        AND (inv.user_id <> '43' OR COALESCE(trim(inv.domain_renewal), '') IN ('0', ''))
        AND ($3::text[] IS NULL OR inv.user_id = ANY($3::text[]))
      GROUP BY u.user_id, u.name, u._archive_row_id
     HAVING SUM(${VAS_AMOUNT_SQL("p.amount")}) > 0
      ORDER BY u._archive_row_id`,
    [startYmd, endYmd, legacyUserIds],
  );
  const ids = totals.rows.map((r) => r.user_id);
  const intIds = ids.map((id) => Number(id)).filter((n) => Number.isInteger(n));
  const [slabs, firstReward, created, team] = await Promise.all([
    pool.query<{ user_id: string; price: string | null; conversion: string | null; reward: string | null }>(
      `SELECT st.user_id, t.price, t.conversion, t.reward
         FROM legacy_archive.webxl_setterget st
         JOIN legacy_archive.webxl_terget t ON t._source_table = 'webxl_terget' AND t._legacy_pk = st.terget_id
        WHERE rtrim(st.terget_cat) = '3' AND st.user_id = ANY($1::text[]) AND lower(rtrim(t.type)) = 'new'
          AND st.start_date >= $2 AND st.end_date <= $3
        ORDER BY st._legacy_pk::bigint`,
      [ids, q.start, q.end],
    ),
    pool.query<{ user_id: number; reward: string | null }>(
      `SELECT DISTINCT ON (f.user_id) f.user_id, f.reward::text AS reward
         FROM drm.webxl_vas_comm_final f
        WHERE f.user_id = ANY($1::int[])
        ORDER BY f.user_id, f.id`,
      [intIds],
    ),
    pool.query<{ user_id: number; comm_type: string }>(
      `SELECT DISTINCT f.user_id, f.comm_type
         FROM drm.webxl_vas_comm_final f
        WHERE f.user_id = ANY($1::int[]) AND f.comm_type IN ('Vas', 'Team-Vas')
          AND f.comm_year = $2 AND ${VAS_COMM_MONTH_SQL} = $3 AND f.hod_status = 'Approved'`,
      [intIds, commYear, commMonth],
    ),
    pool.query<{ lead_id: string; member_id: string; name: string | null; total: string }>(
      `SELECT m."underWork" AS lead_id, m.user_id AS member_id, m.name, SUM(${VAS_AMOUNT_SQL("p.amount")})::text AS total
         FROM legacy_archive.webxl_user m
         JOIN legacy_archive.webxl_invoice inv ON inv._source_table = 'webxl_invoice' AND inv.user_id = m.user_id
         JOIN legacy_archive.webxl_payments p ON p.invoice_id = inv._legacy_pk AND p.com_id = inv.com_id
        WHERE m._source_table = 'webxl_user' AND m."underWork" = ANY($1::text[])
          AND left(p.create_date, 10) >= $2 AND left(p.create_date, 10) <= $3
        GROUP BY m."underWork", m.user_id, m.name, m._archive_row_id
        ORDER BY m._archive_row_id`,
      [ids, startYmd, endYmd],
    ),
  ]);

  const slabsByUser = new Map<string, { price: number; per: number; reward: number }[]>();
  for (const s of slabs.rows) {
    const list = slabsByUser.get(s.user_id) ?? [];
    list.push({ price: Number(s.price) || 0, per: Number(s.conversion) || 0, reward: Number(s.reward) || 0 });
    slabsByUser.set(s.user_id, list);
  }
  const paidReward = new Map(firstReward.rows.map((r) => [String(r.user_id), Number(r.reward) || 0]));
  const createdKey = new Set(created.rows.map((r) => `${r.user_id}|${r.comm_type}`));
  const teamByLead = new Map<string, { legacyUserId: string; name: string | null; total: number }[]>();
  for (const t of team.rows) {
    const list = teamByLead.get(t.lead_id) ?? [];
    list.push({ legacyUserId: t.member_id, name: t.name, total: Number(t.total) || 0 });
    teamByLead.set(t.lead_id, list);
  }

  const rows: any[] = [];
  for (const u of totals.rows) {
    const total = Number(u.total) || 0;
    const slab = (slabsByUser.get(u.user_id) ?? []).find((s) => total >= s.price);
    if (!slab) continue;
    const comm = Math.round((slab.per / 100) * total);
    const members = teamByLead.get(u.user_id) ?? [];
    const teamTotal = members.reduce((s, m) => s + m.total, 0);
    rows.push({
      legacyUserId: u.user_id,
      person: u.name,
      period,
      total,
      per: slab.per,
      reward: slab.reward,
      paidReward: paidReward.has(u.user_id) ? paidReward.get(u.user_id) : comm,
      comm,
      amount: slab.reward + comm,
      alreadyCreated: createdKey.has(`${u.user_id}|Vas`),
      team: members.length
        ? {
            members,
            total: teamTotal,
            per: VAS_TEAM_PER_ALL,
            comm: Math.round(teamTotal * VAS_TEAM_PER_ALL) / 100,
            alreadyCreated: createdKey.has(`${u.user_id}|Team-Vas`),
          }
        : null,
    });
  }
  const sum = (k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  return {
    mode: "allCommission" as const,
    period,
    from: startYmd,
    to: endYmd,
    commMonth,
    commYear,
    targetQuarter: q,
    rows,
    totals: { total: sum("total"), reward: sum("reward"), comm: sum("comm"), amount: sum("amount") },
  };
}

export async function getVasCompanyLegacyReport(
  userIds: string[] | null,
  fromDate: Date,
  toDate: Date,
): Promise<ReportData & { legacyVas?: unknown }> {
  const startYmd = localYmd(fromDate);
  const endYmd = localYmd(toDate);

  let legacyUserIds: string[] | null = null;
  if (userIds && userIds.length > 0) {
    const mapped = await pool.query<{ legacy_id: string }>(
      `SELECT legacy_id FROM migration_meta.migration_legacy_ids
        WHERE modern_table = 'users' AND legacy_table = 'webxl_user' AND modern_id = ANY($1::text[])`,
      [userIds],
    );
    legacyUserIds = mapped.rows.map((r) => r.legacy_id);
  }
  const singleUser = legacyUserIds && legacyUserIds.length === 1 ? legacyUserIds[0] : null;

  const [modern, payments] = await Promise.all([
    getVasReport(userIds, fromDate, toDate),
    pool.query<{
      legacy_id: string;
      amount: string | null;
      method: string | null;
      create_date: string | null;
      receipt_number: string | null;
      invoice_id: string | null;
      cname: string | null;
      domain_renewal: string | null;
      person_name: string | null;
      invoice_modern_id: string | null;
    }>(
      `SELECT p._legacy_pk AS legacy_id, p.amount, p.method, p.create_date, p.receipt_number, p.invoice_id,
              c.cname, inv.domain_renewal, u.name AS person_name, mi.modern_id AS invoice_modern_id
         FROM legacy_archive.webxl_payments p
         LEFT JOIN legacy_archive.webxl_invoice inv
           ON inv._source_table = 'webxl_invoice' AND inv._legacy_pk = p.invoice_id
         LEFT JOIN legacy_archive.webxl_company c
           ON c._source_table = 'webxl_company' AND c._legacy_pk = p.com_id
         LEFT JOIN legacy_archive.webxl_user u
           ON u._source_table = 'webxl_user' AND u._legacy_pk = inv.user_id
         LEFT JOIN migration_meta.migration_legacy_ids mi
           ON mi.entity_type = 'invoice' AND mi.legacy_table = 'webxl_invoice' AND mi.legacy_id = p.invoice_id
        WHERE left(p.create_date, 10) >= $1 AND left(p.create_date, 10) <= $2
          AND ($3::text[] IS NULL OR (inv.user_id = ANY($3::text[]) AND inv.com_id = p.com_id))
        ORDER BY p._legacy_pk::bigint DESC`,
      [startYmd, endYmd, legacyUserIds],
    ),
  ]);

  const legacyDetails = payments.rows.map((r) => {
    const dr = (r.domain_renewal ?? "").trim();
    // PHP: $domain_renewal == 0 ? 'New' : 'Renewal' (NULL == 0 -> New).
    const status = r.domain_renewal === null || (dr !== "" && Number(dr) === 0) ? "New" : "Renewal";
    const amount = Number(r.amount);
    return {
      id: `legacy-payment-${r.legacy_id}`,
      legacyPaymentId: r.legacy_id,
      invoiceId: r.invoice_modern_id,
      legacyInvoiceId: r.invoice_id,
      title: `Payment: ${r.cname ?? ""}`,
      company: r.cname,
      method: r.method,
      receiptNumber: r.receipt_number,
      status,
      person: r.person_name,
      date: legacyWallClock(r.create_date),
      createdAt: legacyWallClock(r.create_date),
      valueSold: Number.isFinite(amount) ? amount : 0,
      totalTasks: null,
      successRate: null,
      followUpsDone: null,
      missedLeads: null,
      customerId: null,
      source: "legacy_payment",
    };
  });

  // Modern half: drop migrated invoices already paid in the old DRM.
  const invoiceIds = modern.details.filter((d: any) => d.source === "invoice").map((d: any) => String(d.id));
  const paidInOldDrm = new Set<string>();
  if (invoiceIds.length > 0) {
    const { rows } = await pool.query<{ modern_id: string }>(
      `SELECT DISTINCT m.modern_id
         FROM migration_meta.migration_legacy_ids m
         JOIN legacy_archive.webxl_payments p ON p.invoice_id = m.legacy_id
        WHERE m.modern_table = 'invoices' AND m.legacy_table = 'webxl_invoice' AND m.modern_id = ANY($1::text[])`,
      [invoiceIds],
    );
    for (const r of rows) paidInOldDrm.add(r.modern_id);
  }
  const modernDetails = modern.details.filter((d: any) => !(d.source === "invoice" && paidInOldDrm.has(String(d.id))));

  // ---- Month Wise (one user) / all-users commission ----
  const startDay = startYmd.slice(8, 10);
  const endDay = endYmd.slice(8, 10);
  let legacyVas: any = { mode: "list" };
  if (singleUser) {
    const months = phpMonthsBetween(startYmd, endYmd);
    const msArr = months.map((m) => `${m}-${startDay}`);
    const meArr = months.map((m) => `${m}-${endDay}`);
    const [totals, targets, due, nameRow] = await Promise.all([
      months.length
        ? pool.query<{ idx: string; total: string }>(
            `SELECT r.idx::text AS idx, COALESCE(SUM(${VAS_AMOUNT_SQL("p.amount")}), 0)::text AS total
               FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS r(ms, me, idx)
               LEFT JOIN (legacy_archive.webxl_payments p
                          JOIN legacy_archive.webxl_invoice inv
                            ON inv._source_table = 'webxl_invoice' AND inv._legacy_pk = p.invoice_id
                           AND inv.com_id = p.com_id AND inv.user_id = $1
                           AND ($1 <> '43' OR COALESCE(trim(inv.domain_renewal), '') IN ('0', '')))
                 ON left(p.create_date, 10) >= r.ms AND left(p.create_date, 10) <= r.me
              GROUP BY r.idx ORDER BY r.idx`,
            [singleUser, msArr, meArr],
          )
        : Promise.resolve({ rows: [] as { idx: string; total: string }[] }),
      pool.query<{ start_date: string; end_date: string; price: string | null; max_amount: string | null; conversion: string | null; reward: string | null; terget_name: string | null }>(
        `SELECT st.start_date, st.end_date, t.price, t.max_amount, t.conversion, t.reward, t.terget_name
           FROM legacy_archive.webxl_setterget st
           JOIN legacy_archive.webxl_terget t ON t._source_table = 'webxl_terget' AND t._legacy_pk = st.terget_id
          WHERE rtrim(st.terget_cat) = '3' AND st.user_id = $1 AND lower(rtrim(t.type)) = 'new'
          ORDER BY st._legacy_pk::bigint`,
        [singleUser],
      ),
      // AllDuePaymentsPendingByUserByDate: invoices created in range that have a
      // payment and a non-zero `pay`: sum of round(grand_total - pay).
      pool.query<{ due: string }>(
        `SELECT COALESCE(SUM(round(${VAS_AMOUNT_SQL("i.grand_total")} - ${VAS_AMOUNT_SQL("i.pay")})), 0)::text AS due
           FROM legacy_archive.webxl_invoice i
          WHERE i.user_id = $1 AND left(i.create_date, 10) >= $2 AND left(i.create_date, 10) <= $3
            AND COALESCE(i.pay, '') <> '' AND ${VAS_AMOUNT_SQL("i.pay")} <> 0
            AND EXISTS (SELECT 1 FROM legacy_archive.webxl_payments p WHERE p.invoice_id = i.invoice_id)`,
        [singleUser, startYmd, endYmd],
      ),
      pool.query<{ name: string | null }>(
        `SELECT name FROM legacy_archive.webxl_user WHERE _source_table = 'webxl_user' AND _legacy_pk = $1`,
        [singleUser],
      ),
    ]);
    const person = nameRow.rows[0]?.name ?? null;
    const rows: any[] = [];
    months.forEach((m, i) => {
      const total = Number(totals.rows.find((r) => Number(r.idx) === i + 1)?.total ?? 0);
      if (total === 0) return;
      // userVAStargetPer(): the user's VAS targets inside the quarter (the old
      // page used the quarter it was viewed in; here: the month's quarter).
      const q = vasQuarterOf(m);
      for (const t of targets.rows) {
        if (!(t.start_date >= q.start && t.end_date <= q.end)) continue;
        const price = Number(t.price) || 0;
        const max = Number(t.max_amount) || 0;
        if (!(total >= price && total <= max)) continue;
        const per = Number(t.conversion) || 0;
        const reward = Number(t.reward) || 0;
        const comm = Math.round((per / 100) * total);
        rows.push({ period: `${m}-${startDay} To ${m}-${endDay}`, person, total, per, reward, comm, amount: reward + comm });
      }
    });
    const sum = (k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    legacyVas = {
      mode: "monthWise",
      rows,
      due: Number(due.rows[0]?.due ?? 0),
      totals: { total: sum("total"), reward: sum("reward"), comm: sum("comm"), amount: sum("amount") },
    };
  } else if (!userIds || userIds.length > 1) {
    // Select User = All: old VasController::renderAllUsersVas (see
    // getVasAllUsersCommission). A department-scoped role's "All" only covers
    // the users it may see.
    legacyVas = await getVasAllUsersCommission(legacyUserIds, startYmd, endYmd);
  }

  const details = [...legacyDetails, ...modernDetails].sort(
    (a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
  );
  const totalValue = details.reduce((s, d: any) => s + (Number(d.valueSold) || 0), 0);
  return {
    ...modern,
    metrics: { ...modern.metrics, valueOfServiceSold: totalValue },
    chartData: generateChartData(details.map((d: any) => ({ createdAt: d.date, valueSold: d.valueSold })), fromDate, toDate, "valueSold"),
    details,
    totals: { ...(modern.totals ?? { totalRemaining: 0 }), totalAdvance: totalValue },
    reportCount: details.length,
    legacyVas,
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
        // Two distinct VAS reports share this export path (see getVasReport vs
        // getVasReportLegacyOfficeVas): tell them apart by shape, not by a
        // flag threaded through ReportData, since legacy rows carry
        // `companyName` and vas_reports rows never do.
        const isLegacyVas = report.details.length > 0 && Object.prototype.hasOwnProperty.call(report.details[0], "companyName");
        if (isLegacyVas) {
          lines.push("Company,Amount,Method,Date");
          report.details.forEach((item: any) => {
            lines.push(
              `"${item.companyName ?? ""}",` +
              `${item.amount ?? 0},` +
              `"${item.method ?? ""}",` +
              `${item.date ? new Date(item.date).toISOString() : ""}`
            );
          });
        } else {
          lines.push("Date,Source,Title,Company,Method,Customer ID,Status,Total Tasks,Value Sold,Success Rate,Follow-ups Done,Missed Leads");
          report.details.forEach((item: any) => {
            lines.push(
              `${item.date ? new Date(item.date).toISOString().split("T")[0] : ""},` +
              `"${item.source ?? "vas_reports"}",` +
              `"${item.title ?? ""}",` +
              `"${item.company ?? ""}",` +
              `"${item.method ?? ""}",` +
              `"${item.customerId ?? ""}",` +
              `"${item.status ?? ""}",` +
              `${item.totalTasks ?? ""},` +
              `${item.valueSold ?? 0},` +
              `${item.successRate ?? ""},` +
              `${item.followUpsDone ?? ""},` +
              `${item.missedLeads ?? ""}`
            );
          });
        }
        break;
      }
      case "bv": {
        // Two distinct BV reports share this export path (see getBvReportData vs
        // getBvReportCompanyWide): tell them apart by shape, not by a flag
        // threaded through ReportData — only the company-wide rows carry `package`.
        const isCompanyWideBv = report.details.length > 0 && Object.prototype.hasOwnProperty.call(report.details[0], "package");
        if (isCompanyWideBv) {
          lines.push("Date,Company,Package,Price,ExtraDisc++,Comm,Reward,VAS,KWA,Method,Person,Pay,BV Submit,BV,Rc/New,Type");
          report.details.forEach((item: any) => {
            lines.push(
              `${item.date ? new Date(item.date).toISOString().split("T")[0] : ""},` +
              `"${item.companyName ?? ""}",` +
              `"${item.package ?? ""}",` +
              `${item.price ?? 0},` +
              `${item.extraDisc ?? 0},` +
              `${item.comm ?? ""},` +
              `${item.reward ?? 0},` +
              `${item.vas ?? 0},` +
              `${item.kwa ?? 0},` +
              `"${item.method ?? ""}",` +
              `"${item.personName ?? ""}",` +
              `"${item.pay ? new Date(item.pay).toISOString().split("T")[0] : ""}",` +
              `"${item.bvSubmit ? new Date(item.bvSubmit).toISOString().split("T")[0] : ""}",` +
              `"${item.bv ? new Date(item.bv).toISOString().split("T")[0] : ""}",` +
              `"${item.rcNew ?? ""}",` +
              `"${item.type ?? ""}"`
            );
          });
        } else {
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
        }
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

  return {
    value: {
      fromDate,
      toDate,
      startDateStr: String(startDate).slice(0, 10),
      endDateStr: String(endDate).slice(0, 10),
      userId: req.query.userId && req.query.userId !== "all" ? String(req.query.userId) : null,
      ourTeam: req.query.ourTeam === "true" || req.query.ourTeam === true,
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
      const report = await getDayTargetReport({ ...parsed.value, filterUserIds });
      const format = (typeof req.query.format === "string" ? req.query.format : "csv").toLowerCase();
      const suffix = `day_target_${report.filters.startDate}_${report.filters.endDate}_${exportTimestamp()}`;
      const rowCount = report.tables.reduce((sum, t) => sum + t.rows.length, 0);

      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="${suffix}.json"`);
        await ActivityLogService.log({
          userId: req.user.userId,
          action: "day_target.export",
          resourceType: "report",
          resourceId: "day_target",
          details: JSON.stringify({ format, from: report.filters.startDate, to: report.filters.endDate, count: rowCount }),
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
        details: JSON.stringify({ format, from: report.filters.startDate, to: report.filters.endDate, count: rowCount }),
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
// PATCH /api/reports/bv/comm/:gmEntryId { comm: number | null } — edit a GM's BV commission
// (old DRM finalComm). null clears the edit so the computed value shows again.
// Admin / Super HOD / HOD / Account only.
router.patch("/reports/bv/comm/:gmEntryId", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const u = req.user as any;
    const roles = [u.activeRoleId, u.roleId, ...(Array.isArray(u.roles) ? u.roles : [])].filter(Boolean).map((r: any) => normalizeRole(String(r)));
    if (!roles.some((r: string) => [ROLES.ADMIN, ROLES.SUPER_HOD, ROLES.HOD, ROLES.ACCOUNT_MANAGER].includes(r as any))) {
      return res.status(403).json({ error: "Only admin, HOD or Account can edit commission" });
    }
    const raw = (req.body ?? {}).comm;
    let value: number | null = null;
    if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
      value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 10_000_000) {
        return res.status(400).json({ error: "Commission must be a number of 0 or more" });
      }
      value = Math.round(value * 100) / 100;
    }
    const { rows } = await pool.query(
      `UPDATE drm.gm_entries
          SET final_comm = $2, final_comm_by = $3::uuid, final_comm_at = now(), updated_at = now()
        WHERE id::text = $1
        RETURNING id, final_comm`,
      [String(req.params.gmEntryId), value, u.userId],
    );
    if (!rows[0]) return res.status(404).json({ error: "GM entry not found" });
    res.json({ id: rows[0].id, comm: rows[0].final_comm == null ? null : Number(rows[0].final_comm) });
  } catch (error) {
    console.error("Error updating BV commission:", error);
    res.status(500).json({ error: "Failed to update commission" });
  }
});

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
    const { fromDate, toDate } = parsedRange;
    const filterUserIds = await resolveBvScope(req);

    // "Reports" sidebar group's BV Report link (?scope=company) shows the
    // gm_entries-backed company-wide view instead of the bv_reports
    // verification-workflow report "User Reports" -> BV Report keeps.
    // Old-DRM GMs follow func.php's "View Gm BV Reports" rules
    // (getBvCompanyLegacyReport); new-app GMs keep the modern logic.
    if (req.query.scope === "company") {
      const report = await getBvCompanyLegacyReport(filterUserIds, fromDate, toDate);
      return res.json(report);
    }

    // "BV Pending EC/NC Only" report (?scope=pending) — old-DRM rules on the
    // archived webxl_verify_gm/webxl_gmaccount data plus new-app GMs via the
    // modern logic (see getBvPendingLegacyReport). Default = GMs whose BV date
    // falls in the range; the "Pending Bv" checkbox sends pendingOnly=true for
    // companies whose BV date is still empty.
    if (req.query.scope === "pending") {
      const report = await getBvPendingLegacyReport(
        filterUserIds,
        fromDate,
        toDate,
        req.query.pendingOnly === "true",
      );
      return res.json(report);
    }

    const filterResult = parseBvFilters(req);
    if (!filterResult.ok) {
      return res.status(400).json({ error: filterResult.error });
    }
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

// "Bv Pending RC Only" (/reports/bv-pending-rc) — port of func.php
// getPendingBVRecords ("Load All Records") / searchBVRecords ("Search with Filters"):
// approved + paid (webxl_pay_status='Yes') Rc GMs (renwal = 0) joined to every
// webxl_gmaccount row of the company with renwal = 0, DISTINCT on the shown fields.
// Only renwal '0' counts: the live old page's totals (173 vs 171 here at the
// 2026-11-03 snapshot) show its rows with an empty renwal are not included.
// The date filter is the old OR across user_bv_date / bvDate / startData / endData.
// AB Pay Date = vg.webxl_pay_date (the old SELECT forgot it, so it always printed blank).
const MYSQL_ZERO = (col: string) =>
  `(btrim(${col}) = '0')`;

router.get("/reports/bv-pending-rc", requireReportPermission("bv_report", "view"), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const scopeIds = await resolveBvScope(req);
    let legacyUserIds: string[] | null = null;
    if (scopeIds) {
      const mapped = await pool.query<{ legacy_id: string }>(
        `SELECT legacy_id FROM migration_meta.migration_legacy_ids
          WHERE modern_table = 'users' AND legacy_table = 'webxl_user' AND modern_id = ANY($1::text[])`,
        [scopeIds],
      );
      legacyUserIds = mapped.rows.map((r) => r.legacy_id);
    }
    const ymd = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const start = ymd(req.query.start);
    const end = ymd(req.query.end);
    const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : null;

    const runQuery = (st: string | null, en: string | null, qq: string | null) => pool.query(
      `WITH ga AS (
         -- Dates edited on this page (drm.legacy_bv_date_overrides) replace the archive's.
         SELECT g.com_id, g.renwal,
                CASE WHEN o.com_id IS NULL THEN g.user_bv_date ELSE o.user_bv_date::text END AS user_bv_date,
                CASE WHEN o.com_id IS NULL THEN g."bvDate" ELSE o.bv_date::text END AS "bvDate",
                CASE WHEN o.com_id IS NULL THEN g."startData" ELSE o.start_date::text END AS "startData",
                CASE WHEN o.com_id IS NULL THEN g."endData" ELSE o.end_date::text END AS "endData"
           FROM legacy_archive.webxl_gmaccount g
           LEFT JOIN drm.legacy_bv_date_overrides o
             ON o.com_id = g.com_id AND ${MYSQL_ZERO("g.renwal")}
       )
       SELECT vg.com_id AS "companyId", vg.member_id AS "memberId", u.name AS persons,
              ga.user_bv_date AS "userBvDate", ga."bvDate" AS "bvDate",
              ga."startData" AS "startDate", ga."endData" AS "endDate",
              c.cname AS "companyName", MAX(vg.webxl_pay_date) AS "abPayDate"
         FROM legacy_archive.webxl_verify_gm vg
         JOIN ga ON ga.com_id = vg.com_id
         LEFT JOIN legacy_archive.webxl_company c ON c._source_table = 'webxl_company' AND c._legacy_pk = vg.com_id
         LEFT JOIN legacy_archive.webxl_user u ON u._source_table = 'webxl_user' AND u._legacy_pk = vg.user_id
        WHERE lower(rtrim(vg.acc_disc_status)) = 'approved'
          AND lower(rtrim(vg.ceo_disc_status)) = 'approved'
          AND lower(rtrim(vg.webxl_pay_status)) = 'yes'
          AND vg.webxl_pay_date IS NOT NULL
          AND ${MYSQL_ZERO("vg.renwal")}
          AND ${MYSQL_ZERO("ga.renwal")}
          AND ($1::text[] IS NULL OR vg.user_id = ANY($1::text[]))
          AND ($2::text IS NULL OR ga.user_bv_date >= $2 OR ga."bvDate" >= $2 OR ga."startData" >= $2 OR ga."endData" >= $2)
          AND ($3::text IS NULL OR ga.user_bv_date <= $3 OR ga."bvDate" <= $3 OR ga."startData" <= $3 OR ga."endData" <= $3)
          AND ($4::text IS NULL OR vg.com_id ILIKE '%' || $4 || '%' OR vg.member_id ILIKE '%' || $4 || '%'
               OR c.cname ILIKE '%' || $4 || '%' OR u.name ILIKE '%' || $4 || '%')
        GROUP BY vg.com_id, vg.member_id, vg.user_id, ga.user_bv_date, ga."bvDate", ga."startData", ga."endData", c.cname, u.name
        ORDER BY vg.com_id ASC -- old com_id is varchar: text order (103205, 108082, 1109, ...)
`,
      [legacyUserIds, st, en, qq],
    );
    // Old page: Total Records = all records (user filter only); Filtered Results = with date/search.
    const [{ rows }, all] = await Promise.all([
      runQuery(start, end, q),
      start || end || q ? runQuery(null, null, null) : null,
    ]);
    const clean = (d: string | null) => (d && !d.startsWith("0000") ? d.slice(0, 10) : "");
    const data = rows.map((r: any, i: number) => ({
      srNo: i + 1,
      memberId: r.memberId || "N/A",
      companyId: r.companyId ?? "",
      companyName: r.companyName || "N/A",
      persons: r.persons || "N/A",
      type: "Rc",
      userBvDate: clean(r.userBvDate),
      bvDate: clean(r.bvDate),
      abPayDate: clean(r.abPayDate),
      startDate: clean(r.startDate),
      endDate: clean(r.endDate),
    }));
    res.json({ total: all ? all.rowCount : data.length, filtered: data.length, data });
  } catch (error) {
    console.error("Error fetching pending RC BV report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// Save on "Bv Pending RC Only" — old func.php updateBVRecord: sets the four
// dates (empty = NULL) for the company's webxl_gmaccount rows with renwal = 0.
router.patch("/reports/bv-pending-rc/:comId", requireReportPermission("bv_report", "edit"), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const role = normalizeRole((req.user as any)?.activeRoleId ?? (req.user as any).roleId);
    if (!["admin", "super_admin", "super_hod", "hod", ROLES.ACCOUNT_MANAGER].includes(role)) {
      return res.status(403).json({ error: "Not allowed to edit BV dates" });
    }
    const comId = String(req.params.comId || "").trim();
    if (!/^\d+$/.test(comId)) return res.status(400).json({ error: "Company ID is required" });
    const d = (v: unknown) => {
      if (v === null || v === undefined || v === "") return null;
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      throw new Error("Invalid date");
    };
    let vals: (string | null)[];
    try {
      vals = [d(req.body?.userBvDate), d(req.body?.bvDate), d(req.body?.startDate), d(req.body?.endDate)];
    } catch {
      return res.status(400).json({ error: "Dates must be YYYY-MM-DD" });
    }
    const exists = await pool.query(
      `SELECT 1 FROM legacy_archive.webxl_gmaccount WHERE com_id = $1 AND ${MYSQL_ZERO("renwal")} LIMIT 1`,
      [comId],
    );
    if (!exists.rowCount) return res.status(404).json({ error: `No record found for Company ID: ${comId}` });
    await pool.query(
      `INSERT INTO drm.legacy_bv_date_overrides (com_id, user_bv_date, bv_date, start_date, end_date, updated_by, updated_at)
       VALUES ($1, $2::date, $3::date, $4::date, $5::date, $6, now())
       ON CONFLICT (com_id) DO UPDATE SET user_bv_date = EXCLUDED.user_bv_date, bv_date = EXCLUDED.bv_date,
         start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
         updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [comId, ...vals, (req.user as any).userId ?? null],
    );
    res.json({ success: true, message: "Record updated successfully" });
  } catch (error) {
    console.error("Error updating pending RC BV dates:", error);
    res.status(500).json({ error: "Update failed" });
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
    const { fromDate, toDate } = parsedRange;
    const filterUserIds = await resolveBvScope(req);
    const userPart =
      typeof req.query.userId === "string" && req.query.userId && req.query.userId !== "all"
        ? `_user-${req.query.userId.slice(0, 8)}`
        : "_user-all";

    // Same scope=company branch as the list route above — export must reflect
    // whichever report is actually on screen.
    let report: ReportData;
    let statusPart = "";
    if (req.query.scope === "company") {
      report = await getBvCompanyLegacyReport(filterUserIds, fromDate, toDate);
    } else {
      const filterResult = parseBvFilters(req);
      if (!filterResult.ok) {
        return res.status(400).json({ error: filterResult.error });
      }
      // Export reflects the same filters as the list but is never paginated, so the
      // exported row count always equals report.pagination.total / reportCount.
      report = await getBvReportData(filterUserIds, fromDate, toDate, filterResult.filters);
      statusPart = filterResult.filters.status ? `_${filterResult.filters.status.toLowerCase()}` : "";
    }
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

// GM SYSTEM page filter options (old package names + branches).
// ---- VAS report "All" users commission (old VasController) ----
// Callers: VasReportTable (frontend/src/pages/user-reports.tsx). `legacyUserId`
// is the OLD integer webxl_user id the All table rows carry.
const vasLegacyUserIdSchema = z.string().trim().regex(/^\d{1,10}$/, "Invalid user");
const vasYmdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

function vasActingRole(req: any): string {
  const u = req.user as any;
  return normalizeRole(String(u?.activeRoleId ?? u?.roleId ?? ""));
}

async function vasOwnLegacyUserId(modernUserId: string): Promise<string | null> {
  const { rows } = await pool.query<{ legacy_id: string }>(
    `SELECT legacy_id FROM migration_meta.migration_legacy_ids
      WHERE modern_table = 'users' AND legacy_table = 'webxl_user' AND modern_id = $1
      ORDER BY legacy_id LIMIT 1`,
    [modernUserId],
  );
  return rows[0]?.legacy_id ?? null;
}

// HOD / Super HOD / admin / account manager see everyone; others only themselves.
async function vasCanSeeLegacyUser(req: any, legacyUserId: string): Promise<boolean> {
  if (VAS_VERIFY_ROLES.includes(vasActingRole(req))) return true;
  return (await vasOwnLegacyUserId(String(req.user.userId))) === legacyUserId;
}

// GET /api/reports/vas/commission/invoices?legacyUserId=&from=&to= — the
// receipt button's "Invoice Details" modal (old query, archive data).
router.get("/reports/vas/commission/invoices", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const parsed = z.object({ legacyUserId: vasLegacyUserIdSchema, from: vasYmdSchema, to: vasYmdSchema }).safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    const { legacyUserId, from, to } = parsed.data;
    if (!(await vasCanSeeLegacyUser(req, legacyUserId))) return res.status(403).json({ error: "Forbidden" });
    const { rows } = await pool.query(
      `SELECT p.com_id AS "comId", p.amount, p.create_date AS "createDate", p.invoice_id AS "invoiceId",
              i.domain_renewal AS "domainRenewal", i.cname, ip.item, ip.pay, ip.method
         FROM legacy_archive.webxl_payments p
         LEFT JOIN legacy_archive.webxl_invoice i
           ON i._source_table = 'webxl_invoice' AND p.com_id = i.com_id AND p.invoice_id = i._legacy_pk
         LEFT JOIN legacy_archive.webxl_invoice_item_pay ip
           ON ip._source_table = 'webxl_invoice_item_pay' AND p.invoice_id = ip.invoice_id
        WHERE i.user_id = $1 AND left(p.create_date, 10) >= $2 AND left(p.create_date, 10) <= $3
          AND ($1 <> '43' OR COALESCE(trim(i.domain_renewal), '') IN ('0', ''))
        ORDER BY p.create_date DESC, p._legacy_pk::bigint DESC, ip._legacy_pk::bigint`,
      [legacyUserId, from, to],
    );
    res.json({ rows: rows.map((r: any) => ({ ...r, createDate: legacyWallClock(r.createDate) })) });
  } catch (error) {
    console.error("Error fetching VAS invoice details:", error);
    res.status(500).json({ error: "Failed to fetch invoice details" });
  }
});

// GET /api/reports/vas/commission/duplicates?legacyUserId= — the eye button:
// the user's webxl_vas_comm_final rows whose (month, year) has more than one row.
router.get("/reports/vas/commission/duplicates", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const parsed = z.object({ legacyUserId: vasLegacyUserIdSchema }).safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    const { legacyUserId } = parsed.data;
    if (!(await vasCanSeeLegacyUser(req, legacyUserId))) return res.status(403).json({ error: "Forbidden" });
    const { rows } = await pool.query(
      `SELECT f.id, f.comm_month AS "commMonth", f.comm_year AS "commYear", f.per, f.reward::float8 AS reward,
              f.comm_type AS "commType", f.comm::float8 AS comm, f.final_pay_amount::float8 AS "finalPayAmount"
         FROM drm.webxl_vas_comm_final f
         JOIN (SELECT user_id, comm_month, comm_year FROM drm.webxl_vas_comm_final
                WHERE user_id = $1::int GROUP BY user_id, comm_month, comm_year HAVING COUNT(*) > 1) d
           ON d.user_id = f.user_id AND d.comm_month IS NOT DISTINCT FROM f.comm_month
          AND d.comm_year IS NOT DISTINCT FROM f.comm_year
        ORDER BY f.comm_year, ${VAS_COMM_MONTH_SQL}, f.id`,
      [legacyUserId],
    );
    res.json({ rows });
  } catch (error) {
    console.error("Error fetching VAS duplicate commissions:", error);
    res.status(500).json({ error: "Failed to fetch duplicate records" });
  }
});

// POST /api/reports/vas/commission/verify — old createVerifyCommissionByUser /
// ...ByTeam. HOD / Super HOD / admin / account manager (acting role) create
// the commission row (hod_status Approved); any other role marks its own
// latest matching row Verified.
const vasVerifySchema = z.object({
  legacyUserId: vasLegacyUserIdSchema,
  commType: z.enum(["Vas", "Team-Vas"]),
  from: vasYmdSchema,
  totalAmount: z.coerce.number().finite().min(0).max(1e9),
  per: z.coerce.number().finite().min(0).max(100000),
  comm: z.coerce.number().finite().min(0).max(1e8),
  reward: z.coerce.number().finite().min(0).max(1e8),
  finalPayAmount: z.coerce.number().finite().min(0).max(1e8),
});

router.post("/reports/vas/commission/verify", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const parsed = vasVerifySchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    const b = parsed.data;
    const commMonth = Number(b.from.slice(5, 7));
    const commYear = b.from.slice(0, 4);
    if (commMonth < 1 || commMonth > 12) return res.status(400).json({ error: "Invalid date" });

    if (VAS_VERIFY_ROLES.includes(vasActingRole(req))) {
      const exists = await pool.query(
        `SELECT 1 FROM legacy_archive.webxl_user WHERE _source_table = 'webxl_user' AND _legacy_pk = $1`,
        [b.legacyUserId],
      );
      if (!exists.rowCount) return res.status(404).json({ error: "User not found" });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Serialize per user so a double click can't create two rows.
        await client.query("SELECT pg_advisory_xact_lock(hashtext('vas_comm_final'), $1::int)", [Number(b.legacyUserId)]);
        const dup = await client.query(
          `SELECT f.id FROM drm.webxl_vas_comm_final f
            WHERE f.user_id = $1::int AND f.comm_type = $2 AND f.comm_year = $3 AND ${VAS_COMM_MONTH_SQL} = $4
              AND f.hod_status = 'Approved' LIMIT 1`,
          [b.legacyUserId, b.commType, commYear, commMonth],
        );
        if (dup.rowCount) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "Already Created" });
        }
        const ins = await client.query(
          `INSERT INTO drm.webxl_vas_comm_final
             (user_id, comm_type, total_amount, per, comm, reward, final_pay_amount, user_status, manager_approve,
              comm_month, comm_year, hod_status, hod_satatus_date, account_pay_status)
           VALUES ($1::int, $2, $3, $4, $5, $6, $7, 'Pending', $8, $9, $10, 'Approved', now(), 'Pending')
           RETURNING id`,
          [
            b.legacyUserId, b.commType, b.totalAmount, String(b.per), b.comm, b.reward, b.finalPayAmount,
            b.commType === "Team-Vas" ? "Approved" : "Pending", String(commMonth), commYear,
          ],
        );
        await client.query("COMMIT");
        return res.json({ success: true, created: true, id: ins.rows[0].id });
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    }

    const own = await vasOwnLegacyUserId(String(req.user.userId));
    if (!own || own !== b.legacyUserId) return res.status(403).json({ error: "You can only verify your own commission" });
    const upd = await pool.query(
      `UPDATE drm.webxl_vas_comm_final SET user_status = 'Verified', user_status_date = now()
        WHERE id = (SELECT f.id FROM drm.webxl_vas_comm_final f
                     WHERE f.user_id = $1::int AND f.comm_type = $2 AND f.comm_year = $3 AND ${VAS_COMM_MONTH_SQL} = $4
                     ORDER BY f.id DESC LIMIT 1)
        RETURNING id`,
      [b.legacyUserId, b.commType, commYear, commMonth],
    );
    if (!upd.rowCount) return res.status(404).json({ error: "No commission record to verify" });
    res.json({ success: true, verified: true, id: upd.rows[0].id });
  } catch (error) {
    console.error("Error verifying VAS commission:", error);
    res.status(500).json({ error: "Failed to verify commission" });
  }
});

router.get("/reports/gm-system/options", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    res.json(await getGmSystemFilterOptions());
  } catch (error) {
    console.error("Error fetching GM system options:", error);
    res.status(500).json({ error: "Failed to fetch options" });
  }
});

router.get("/reports/:type", async (req, res, next) => {
  const reportType = req.params.type as string;
  const specificRoutes = ["user-activities", "ledger", "gm-entries", "refund-entries", "invoice-entries", "due-payments", "users-list", "summary"];
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
    // Sales Manager: self-only, never team/org-wide (explicit product decision).
    const effectiveReportRole = (req.user as any)?.activeRoleId || user.roleId;
    const isSalesManagerReportRole = normalizeRole(effectiveReportRole) === ROLES.SALES_MANAGER;

    // "Reports" sidebar group's Loan Report tags ?scope=company so HOD/
    // Account/Admin get the whole-org view there, distinct from "User
    // Reports" group's Loan Report (same URL otherwise) which is personal/
    // team-scoped. Only honored for roles allowed to see everything.
    const COMPANY_WIDE_ROLES = ["admin", "super_admin", "super_hod", "hod", ROLES.ACCOUNT_MANAGER];
    const requestsCompanyWide = req.query.scope === "company" && COMPANY_WIDE_ROLES.includes(normalizeRole(effectiveReportRole));

    let filterUserIds: string[] | null = null;
    if (requestsCompanyWide) {
      // Company-wide privilege means "allowed to see everyone" — it must not
      // override an explicit user picked in the Select User dropdown. Before,
      // this branch forced `null` (global) unconditionally, so once a page
      // carried ?scope=company (e.g. this VAS Report), choosing a specific
      // user in the dropdown had no effect and every selection showed the
      // whole company's data instead of just that user's.
      filterUserIds = queryUserId ? [queryUserId] : null;
    } else if (queryUserId === "team") {
      // Explicit "my team" request (e.g. a manager's personal/default Loan
      // Report view) — direct reports via drm.users.under_works, excluding
      // the manager's own loans (same exclusion as /hr/loan's team view —
      // managers apply for their own loan under their executive role).
      const teamRows = await pool.query(`select id from drm.users where under_works = $1`, [user.userId]);
      filterUserIds = teamRows.rows.length > 0
        ? teamRows.rows.map((r: any) => String(r.id))
        : ["00000000-0000-0000-0000-000000000000"];
    } else if (isSalesManagerReportRole) {
      filterUserIds = [user.userId];
    } else if (!isPrivileged) {
      filterUserIds = [user.userId];
    } else if (isGlobalAdmin) {
      filterUserIds = queryUserId ? [queryUserId] : null;
    } else {
      const allowedIds = await getDepartmentFilterUserIds(req);
      if (queryUserId) {
        // null from getDepartmentFilterUserIds means "unrestricted" for this role
        // (e.g. account_manager -> global), not "nobody allowed" — treat it as
        // the requested user being in scope. Previously `allowedIds && ...`
        // short-circuited null to false and silently zeroed every result for
        // any such role viewing a specific user (its own default selection
        // included), which is what produced "No Records Found" on this page.
        filterUserIds = (allowedIds === null || allowedIds.includes(queryUserId)) ? [queryUserId] : ['00000000-0000-0000-0000-000000000000'];
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
        // "Reports" sidebar group's VAS Report (?scope=company) is the
        // vas_reports-backed report; "User Reports" group's VAS Report (plain
        // /reports/vas) stays on its original office_vas/invoices behavior.
        report = requestsCompanyWide
          ? await getVasCompanyLegacyReport(filterUserIds, fromDate, toDate)
          : await getVasReportLegacyOfficeVas(filterUserIds, fromDate, toDate);
        break;
      case "gm":
        // GM System page (/analytics/gm) opts into "Account approved only"
        // via ?onlyAccountApproved=true; the other GM report
        // (GmReportTable in user-reports.tsx) doesn't send it and keeps
        // seeing every entry regardless of approval stage, unchanged.
        // GM SYSTEM page sends gmSystem=1: old-DRM rules + filters
        // (getGmSystemLegacyReport) on top of the modern rows.
        if (req.query.gmSystem === "1") {
          const q = req.query as Record<string, unknown>;
          const str = (k: string) => (typeof q[k] === "string" && q[k] !== "" ? (q[k] as string) : null);
          const page = Math.max(1, Number(req.query.page) || 1);
          const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize) || Number(req.query.limit) || 25));
          report = await getGmSystemLegacyReport(filterUserIds, fromDate, toDate, {
            city: str("city"),
            pkg: str("package"),
            type: str("type"),
            behalf: str("paymentType"),
            qWise: q.qWise === "true",
            abPayDate: q.abPayDate === "true",
            page,
            pageSize,
          });
          break;
        }
        report = await getGmReport(filterUserIds, fromDate, toDate, req.query.onlyAccountApproved === "true");
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
  const specificRoutes = ["user-activities", "ledger", "gm-entries", "refund-entries", "invoice-entries", "due-payments", "users-list", "summary"];
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
        // Same split as the main listing route: ?scope=company => vas_reports,
        // otherwise the original office_vas/invoices-backed report.
        report = req.query.scope === "company"
          ? await getVasCompanyLegacyReport(filterUserIds, fromDate, toDate)
          : await getVasReportLegacyOfficeVas(filterUserIds, fromDate, toDate);
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
  const specificRoutes = ["user-activities", "ledger", "gm-entries", "refund-entries", "invoice-entries", "due-payments", "users-list", "summary"];
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
      conditions.push(gte(ledgerEntries.entryDate, new Date(from as string).toISOString().split("T")[0]));
    }
    if (to) {
      conditions.push(lte(ledgerEntries.entryDate, new Date(to as string).toISOString().split("T")[0]));
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
// GET /api/reports/due-payments — legacy duepayment.php equivalent: every
// product-posting invoice that's been partially paid (paid_amount > 0) but
// still has more than $100 left owing. No pagination, matching the legacy
// page's own single-page-with-footer-totals layout.
router.get("/reports/due-payments", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const role = String((user as any).activeRoleId || user.roleId || "").toLowerCase();
    if (!["admin", "super_admin", "super_hod", "hod", "account_manager"].includes(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { rows } = await pool.query(`
      select p.id,
             p.company_name as "companyName",
             coalesce(u.full_name, u.name, u.username) as "salesPerson",
             p.amount::numeric as total,
             coalesce(p.paid_amount, 0)::numeric as pay,
             (p.amount - coalesce(p.paid_amount, 0))::numeric as due,
             coalesce(p.invoice_date, p.created_at) as date
        from drm.product_posting_invoices p
        left join drm.users u on u.id = p.sales_exec_id
       where coalesce(p.paid_amount, 0) > 0
         and (p.amount - coalesce(p.paid_amount, 0)) > 100
       order by coalesce(p.invoice_date, p.created_at) desc
    `);

    const totals = rows.reduce(
      (acc, r) => {
        acc.total += Number(r.total) || 0;
        acc.pay += Number(r.pay) || 0;
        acc.due += Number(r.due) || 0;
        return acc;
      },
      { total: 0, pay: 0, due: 0 },
    );

    res.json({ success: true, data: rows, totals });
  } catch (error: any) {
    console.error("Error fetching due payments report:", error);
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
      branch: users.branch,
      roleId: users.roleId,
      role: users.role,
      roles: users.roles,
    }).from(users);

    // isDeactive/roleTitles for the shared user pickers (role 54 "Deactive" hidden there).
    const titles = await loadRoleTitles();
    res.json(
      allUsers.map(({ roleId, role, roles, ...u }) => ({
        ...u,
        ...userRoleInfo({ role_id: roleId, role, roles }, titles),
      })),
    );
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
      if (fromDate) conditions.push(gte(ledgerEntries.entryDate, fromDate.toISOString().split("T")[0]));
      if (toDate) conditions.push(lte(ledgerEntries.entryDate, toDate.toISOString().split("T")[0]));

      data = await db.select().from(ledgerEntries).where(conditions.length > 0 ? and(...conditions) : undefined);
      headers = "ID,Description,Entry Type,Category,Reference ID,Amount,Currency,Date,Created By";
      filename = "ledger_report.csv";

      const csvContent = headers + "\n" + data.map(e =>
        `${e.id},"${e.description}",${e.entryType},${e.category},${e.referenceId || ''},${e.amount},${e.currency},${e.entryDate || ''},${e.createdByUserId}`
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
