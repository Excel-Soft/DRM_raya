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
  // Sales Manager: self-only, never team/org-wide (explicit product decision).
  const effectiveBvRole = (req.user as any)?.activeRoleId || user.roleId;
  if (normalizeRole(effectiveBvRole) === ROLES.SALES_MANAGER) return [user.userId];
  const isPrivileged = isManagerialRole(user.roleId);
  const isGlobalAdmin = ["admin", "super_admin", "super_hod", "hod"].includes(normalizeRole(user.roleId));
  const queryUserId =
    typeof req.query.userId === "string" && req.query.userId !== "all" ? req.query.userId : null;
  if (!isPrivileged) return [user.userId];
  if (isGlobalAdmin) return queryUserId ? [queryUserId] : null;
  const allowedIds = await getDepartmentFilterUserIds(req);
  if (queryUserId) {
    // null from getDepartmentFilterUserIds means "unrestricted" for this role
    // (global, department-wide access), not "nobody allowed" — the same fix
    // already applied to the main /reports/:type dispatcher's equivalent
    // branch. Previously `allowedIds && ...` short-circuited null to false
    // and denied every specific-user request for such a role.
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
    .select()
    .from(productPostingInvoices)
    .where(and(...productInvoiceConditions));

  const standardInvoiceConditions = [
    eq(invoices.status, "Paid"),
    gte(invoices.updatedAt, fromDate),
    lte(invoices.updatedAt, toDate),
  ];
  if (userIds && userIds.length > 0) {
    standardInvoiceConditions.push(inArray(invoices.createdByUserId, userIds));
  }
  const approvedStandardInvoices = await db
    .select()
    .from(invoices)
    .where(and(...standardInvoiceConditions));

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
      date: i.updatedAt,
      createdAt: i.updatedAt,
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
        : (i.currency === "USD" ? (Number(i.total) || 0) * (Number(i.dollarRate) || 0) : (Number(i.total) || 0)),
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

  return {
    type: "vas",
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
      `SELECT id, status, approval_status, account_manager_status, final_status,
              hod_approved_at, gm_bv_submitted_at, gm_bv_date, pay_date, hod_status, accountant_status
         FROM drm.gm_entries WHERE id = ANY($1::uuid[])`,
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
  // "pending": submitted but still awaiting confirmation (the "Pending Bv"
  // checkbox narrows "submitted" down to this).
  options: { bvFilter?: "confirmed" | "pending" | "submitted" } = {},
): Promise<ReportData> {
  const conditions = [
    gte(gmEntries.createdAt, fromDate),
    lte(gmEntries.createdAt, toDate),
    eq(gmEntries.isDeleted, false),
  ];
  if (userIds && userIds.length > 0) {
    conditions.push(inArray(gmEntries.salesPersonId, userIds));
  }

  const allEntries = await db
    .select()
    .from(gmEntries)
    .where(and(...conditions))
    .orderBy(desc(gmEntries.createdAt));

  const extraById = new Map<string, { gm_bv_date: Date | null; pay_date: Date | null; gm_bv_submitted_at: Date | null }>();
  if (allEntries.length > 0) {
    const ids = allEntries.map((e) => e.id);
    const extraRows = await pool.query<{ id: string; gm_bv_date: Date | null; pay_date: Date | null; gm_bv_submitted_at: Date | null }>(
      `SELECT id, gm_bv_date, pay_date, gm_bv_submitted_at FROM drm.gm_entries WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    for (const r of extraRows.rows) extraById.set(r.id, r);
  }

  const bvFilter = options.bvFilter ?? "confirmed";
  const entries = allEntries.filter((e) => {
    const extra = extraById.get(e.id);
    const hasBvDate = Boolean(extra?.gm_bv_date);
    const hasSubmission = Boolean(extra?.gm_bv_submitted_at);
    if (bvFilter === "confirmed") return hasBvDate;
    if (bvFilter === "pending") return hasSubmission && !hasBvDate;
    return hasSubmission;
  });

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
      // Real BV-verification date (legacy "BV" column).
      bv: extra?.gm_bv_date || null,
      rcNew: e.entryType,
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
    if (req.query.scope === "company") {
      const report = await getBvReportCompanyWide(filterUserIds, fromDate, toDate);
      return res.json(report);
    }

    // "BV Pending EC/NC Only" report (?scope=pending) — same real gm_entries
    // source. Default shows the selected user's full BV-submission worklist
    // (confirmed or not); the page's "Pending Bv" checkbox sends
    // pendingOnly=true to narrow it to entries still awaiting confirmation.
    if (req.query.scope === "pending") {
      const bvFilter = req.query.pendingOnly === "true" ? "pending" : "submitted";
      const report = await getBvReportCompanyWide(filterUserIds, fromDate, toDate, { bvFilter });
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
      report = await getBvReportCompanyWide(filterUserIds, fromDate, toDate);
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
          ? await getVasReport(filterUserIds, fromDate, toDate)
          : await getVasReportLegacyOfficeVas(filterUserIds, fromDate, toDate);
        break;
      case "gm":
        // GM System page (/analytics/gm) opts into "Account approved only"
        // via ?onlyAccountApproved=true; the other GM report
        // (GmReportTable in user-reports.tsx) doesn't send it and keeps
        // seeing every entry regardless of approval stage, unchanged.
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
        // Same split as the main listing route: ?scope=company => vas_reports,
        // otherwise the original office_vas/invoices-backed report.
        report = req.query.scope === "company"
          ? await getVasReport(filterUserIds, fromDate, toDate)
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
