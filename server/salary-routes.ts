import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { normalizeRole, isManagerialRole } from "./utils/role-utils";
import { recordAuditLog } from "./services/activity-service";

// ---------------------------------------------------------------------------
// Patch 2 Stage 4 — Real Salary Creation & Reporting
//
// Payroll is computed ONLY from real source data (attendance, approved
// unpaid-leave, approved overtime, ACTIVE penalties) plus explicit manual
// adjustments (bonus/allowance/loan/other) entered by an authorized user. No
// metric is ever fabricated: where the system has no source (overtime rate,
// late-minute policy, loan schedule) the value is 0 and that assumption is
// recorded in each line's calculation_snapshot.
//
// Documented formulas (per employee, per period):
//   basic              = parsed users.basic_salary (TEXT; commas/symbols stripped, blank->0)
//   perDay             = basic / 30
//   gross              = basic + allowance + bonus + overtimeAmount
//   absenceDeduction   = absentDaysDeducted * perDay
//                        (absent attendance days NOT covered by an approved leave,
//                         so an unpaid-leave day is never deducted twice)
//   unpaidLeaveDeduct  = unpaidLeaveDays * perDay   (approved leave_type='Unpaid', clamped to period)
//   lateDeduction      = 0   (no late policy configured; lateMinutes informational)
//   overtimeAmount     = 0   (no overtime rate configured; overtimeMinutes informational)
//   penaltyAmount      = SUM(ACTIVE penalties in period)
//   loanDeduction      = manual (no loan table; default 0)
//   otherDeductions    = manual (default 0)
//   totalDeductions    = absenceDeduction + unpaidLeaveDeduct + lateDeduction
//                        + penaltyAmount + loanDeduction + otherDeductions
//   net                = gross - totalDeductions
//   payable            = max(0, net)
// Leave/absence days are counted as inclusive calendar days within the period
// (no working-calendar configuration exists in the system).
// ---------------------------------------------------------------------------

const SNAPSHOT_VERSION = "stage4-v1";

// Core roles permitted to GENERATE / APPROVE / FINALIZE / EDIT payroll and to
// view run-level aggregates (which expose every employee). Salary is sensitive.
// Executives are NOT here — they may only see their OWN salary lines via the
// report endpoint. NOTE: hasSalaryManagementRole() also grants access to any
// general managerial role (isManagerialRole, e.g. HOD / *_manager); to restrict
// payroll to ONLY this explicit set, drop the isManagerialRole() check below.
const SALARY_MGMT_ROLES = new Set([
  "admin",
  "super_admin",
  "administrator",
  "super_hod",
  "hod",
  "account_manager",
  "accountant",
  "hr",
  "hr_manager",
]);

function actorRoleCandidates(req: Request): string[] {
  // Authorization is derived SOLELY from the signed JWT (req.user). We must NOT
  // trust the client-supplied `x-acting-role` header here: it is purely additive
  // and would let any authenticated user forge a management role and escalate to
  // full payroll access. The header is a UI hint only and is never an authority.
  const u: any = req.user || {};
  const out: string[] = [];
  if (u.roleId) out.push(String(u.roleId));
  if (u.role) out.push(String(u.role));
  if (Array.isArray(u.roles)) out.push(...u.roles.map(String));
  return out.map((r) => normalizeRole(r));
}

// Management role => full payroll access (all employees). Used for generate,
// approve, finalize, edit, and unrestricted viewing of runs/reports.
function hasSalaryManagementRole(req: Request): boolean {
  const roles = actorRoleCandidates(req);
  return roles.some((r) => SALARY_MGMT_ROLES.has(r) || isManagerialRole(r));
}

function actorUserId(req: Request): string | undefined {
  const u: any = req.user || {};
  return u.userId ? String(u.userId) : undefined;
}

// ---------------------------------------------------------------------------
// numeric helpers
// ---------------------------------------------------------------------------

function parseMoney(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function nonNegMoney(v: unknown): number {
  return Math.max(0, parseMoney(v));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// salary_run_items.user_id and salary_runs.generated_by_user_id are `uuid`
// columns. Comparing them against a non-uuid text param raises 22P02 (a 500),
// so we validate the shape and turn an invalid filter into an honest empty
// result instead of an error.
function isUuid(v: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

function periodBounds(month: number, year: number) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999); // last day of month
  return { start, end };
}

function parsePeriod(req: Request): { month: number; year: number } | null {
  const month = Number(req.query.month ?? req.body?.month);
  const year = Number(req.query.year ?? req.body?.year);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return { month, year };
}

// ---------------------------------------------------------------------------
// computation engine
// ---------------------------------------------------------------------------

interface ManualAdjustment {
  bonusAmount?: number;
  allowanceAmount?: number;
  loanDeduction?: number;
  otherDeductions?: number;
}

interface ComputedItem {
  userId: string;
  employeeName: string;
  role: string | null;
  department: string | null;
  branch: string | null;
  basicSalary: number;
  perDaySalary: number;
  daysPresent: number;
  daysAbsent: number; // total absent attendance rows (informational)
  daysAbsentDeducted: number; // absent rows not covered by approved leave
  leaveDays: number;
  unpaidLeaveDays: number;
  lateMinutes: number;
  overtimeMinutes: number;
  overtimeAmount: number;
  grossSalary: number;
  absenceDeduction: number;
  unpaidLeaveDeduction: number;
  lateDeduction: number;
  penaltyAmount: number;
  loanDeduction: number;
  bonusAmount: number;
  allowanceAmount: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  payableSalary: number;
  snapshot: Record<string, unknown>;
}

async function computeItems(
  month: number,
  year: number,
  filters: { branch?: string; department?: string; userId?: string },
  adjustments: Map<string, ManualAdjustment>,
): Promise<ComputedItem[]> {
  const { start, end } = periodBounds(month, year);

  const where: string[] = ["u.is_active = true"];
  const params: any[] = [];
  if (filters.branch) { params.push(filters.branch); where.push(`u.branch = $${params.length}`); }
  if (filters.department) { params.push(filters.department); where.push(`u.department = $${params.length}`); }
  if (filters.userId) { params.push(filters.userId); where.push(`u.id = $${params.length}`); }

  const usersRes = await pool.query(
    `SELECT u.id, COALESCE(u.full_name, u.name, u.username) AS name,
            u.role, u.department, u.branch, u.basic_salary
       FROM drm.users u
      WHERE ${where.join(" AND ")}
      ORDER BY name ASC`,
    params,
  );

  // Attendance: present, total absent, absent NOT covered by approved leave, late days.
  // user_id is varchar holding the uuid string; status is an enum compared as text.
  const attRes = await pool.query(
    `SELECT a.user_id,
            COUNT(*) FILTER (WHERE a.status::text IN ('Present','Late','HalfDay')) AS present,
            COUNT(*) FILTER (WHERE a.status::text = 'Absent') AS absent_total,
            COUNT(*) FILTER (WHERE a.status::text = 'Late') AS late_days,
            COUNT(*) FILTER (WHERE a.status::text = 'Absent' AND NOT EXISTS (
              SELECT 1 FROM drm.leave_requests lr
               WHERE lr.user_id = a.user_id
                 AND lr.status::text = 'Approved'
                 AND a.date::date BETWEEN lr.from_date::date AND lr.to_date::date
            )) AS absent_uncovered
       FROM drm.attendance a
      WHERE a.date >= $1 AND a.date <= $2
      GROUP BY a.user_id`,
    [start, end],
  );
  const attMap = new Map<string, { present: number; absentTotal: number; absentUncovered: number; lateDays: number }>();
  for (const r of attRes.rows) {
    attMap.set(String(r.user_id), {
      present: Number(r.present || 0),
      absentTotal: Number(r.absent_total || 0),
      absentUncovered: Number(r.absent_uncovered || 0),
      lateDays: Number(r.late_days || 0),
    });
  }

  // Approved leave days overlapping the period, clamped to period bounds.
  const leaveRes = await pool.query(
    `SELECT user_id,
            COALESCE(SUM((LEAST(to_date::date, $2::date) - GREATEST(from_date::date, $1::date)) + 1), 0) AS leave_days,
            COALESCE(SUM(CASE WHEN leave_type::text = 'Unpaid'
                              THEN (LEAST(to_date::date, $2::date) - GREATEST(from_date::date, $1::date)) + 1
                              ELSE 0 END), 0) AS unpaid_days
       FROM drm.leave_requests
      WHERE status::text = 'Approved'
        AND from_date::date <= $2::date AND to_date::date >= $1::date
      GROUP BY user_id`,
    [start, end],
  );
  const leaveMap = new Map<string, { leaveDays: number; unpaidDays: number }>();
  for (const r of leaveRes.rows) {
    leaveMap.set(String(r.user_id), {
      leaveDays: Number(r.leave_days || 0),
      unpaidDays: Number(r.unpaid_days || 0),
    });
  }

  // Approved overtime minutes in period (no rate -> amount stays 0).
  const otRes = await pool.query(
    `SELECT user_id, COALESCE(SUM(time_spent), 0) AS ot_minutes
       FROM drm.overtime_records
      WHERE status::text = 'Approved' AND date >= $1 AND date <= $2
      GROUP BY user_id`,
    [start, end],
  );
  const otMap = new Map<string, number>();
  for (const r of otRes.rows) otMap.set(String(r.user_id), Number(r.ot_minutes || 0));

  // ACTIVE (non-voided, non-deleted) penalties dated within the period.
  const penRes = await pool.query(
    `SELECT employee_id, COALESCE(SUM(amount), 0) AS penalty
       FROM drm.penalties
      WHERE status = 'ACTIVE' AND deleted_at IS NULL
        AND penalty_date >= $1::date AND penalty_date <= $2::date
      GROUP BY employee_id`,
    [start, end],
  );
  const penMap = new Map<string, number>();
  for (const r of penRes.rows) penMap.set(String(r.employee_id), Number(r.penalty || 0));

  return usersRes.rows.map((u: any) => {
    const key = String(u.id);
    const adj = adjustments.get(key) || {};
    const att = attMap.get(key) || { present: 0, absentTotal: 0, absentUncovered: 0, lateDays: 0 };
    const lv = leaveMap.get(key) || { leaveDays: 0, unpaidDays: 0 };
    const otMinutes = otMap.get(key) || 0;
    const penaltyAmount = round2(penMap.get(key) || 0);

    const basic = parseMoney(u.basic_salary);
    const perDay = round2(basic / 30);
    const allowance = nonNegMoney(adj.allowanceAmount);
    const bonus = nonNegMoney(adj.bonusAmount);
    const loanDeduction = nonNegMoney(adj.loanDeduction);
    const otherDeductions = nonNegMoney(adj.otherDeductions);

    const overtimeAmount = 0; // no configured rate
    const lateDeduction = 0; // no configured policy
    const gross = round2(basic + allowance + bonus + overtimeAmount);
    const absenceDeduction = round2(att.absentUncovered * perDay);
    const unpaidLeaveDeduction = round2(lv.unpaidDays * perDay);
    const totalDeductions = round2(
      absenceDeduction + unpaidLeaveDeduction + lateDeduction + penaltyAmount + loanDeduction + otherDeductions,
    );
    const net = round2(gross - totalDeductions);
    const payable = Math.max(0, net);

    const snapshot = {
      version: SNAPSHOT_VERSION,
      period: { month, year },
      inputs: {
        basicSalary: basic,
        perDaySalary: perDay,
        daysPresent: att.present,
        daysAbsentTotal: att.absentTotal,
        daysAbsentDeducted: att.absentUncovered,
        lateDays: att.lateDays,
        leaveDays: lv.leaveDays,
        unpaidLeaveDays: lv.unpaidDays,
        overtimeMinutes: otMinutes,
        allowanceAmount: allowance,
        bonusAmount: bonus,
        loanDeduction,
        otherDeductions,
        penaltyAmount,
      },
      deductions: {
        absenceDeduction,
        unpaidLeaveDeduction,
        lateDeduction,
        penaltyAmount,
        loanDeduction,
        otherDeductions,
        totalDeductions,
      },
      gross,
      net,
      payable,
      assumptions: [
        "perDay = basic / 30",
        "leave & absence counted as inclusive calendar days within the period",
        "absent days covered by an approved leave are NOT deducted (no double-count)",
        "overtimeAmount = 0 (no overtime rate configured; minutes are informational)",
        "lateDeduction = 0 (no late policy configured; late days are informational)",
        "loanDeduction has no source table — manual entry only",
      ],
    };

    return {
      userId: key,
      employeeName: u.name || "",
      role: u.role ?? null,
      department: u.department ?? null,
      branch: u.branch ?? null,
      basicSalary: basic,
      perDaySalary: perDay,
      daysPresent: att.present,
      daysAbsent: att.absentTotal,
      daysAbsentDeducted: att.absentUncovered,
      leaveDays: lv.leaveDays,
      unpaidLeaveDays: lv.unpaidDays,
      lateMinutes: 0,
      overtimeMinutes: otMinutes,
      overtimeAmount,
      grossSalary: gross,
      absenceDeduction,
      unpaidLeaveDeduction,
      lateDeduction,
      penaltyAmount,
      loanDeduction,
      bonusAmount: bonus,
      allowanceAmount: allowance,
      otherDeductions,
      totalDeductions,
      netSalary: net,
      payableSalary: payable,
      snapshot,
    } as ComputedItem;
  });
}

function totalsFromComputed(items: ComputedItem[]) {
  return items.reduce(
    (acc, it) => {
      acc.totalGross += it.grossSalary;
      acc.totalDeductions += it.totalDeductions;
      acc.totalNet += it.payableSalary;
      return acc;
    },
    { totalGross: 0, totalDeductions: 0, totalNet: 0 },
  );
}

function computedToJson(it: ComputedItem) {
  return {
    employeeId: it.userId,
    employeeName: it.employeeName,
    role: it.role,
    department: it.department,
    branch: it.branch,
    basicSalary: it.basicSalary,
    perDaySalary: it.perDaySalary,
    grossSalary: it.grossSalary,
    daysPresent: it.daysPresent,
    daysAbsent: it.daysAbsent,
    daysAbsentDeducted: it.daysAbsentDeducted,
    leaveDays: it.leaveDays,
    unpaidLeaveDays: it.unpaidLeaveDays,
    lateMinutes: it.lateMinutes,
    overtimeMinutes: it.overtimeMinutes,
    overtimeAmount: it.overtimeAmount,
    absenceDeduction: it.absenceDeduction,
    unpaidLeaveDeduction: it.unpaidLeaveDeduction,
    penaltyAmount: it.penaltyAmount,
    loanDeduction: it.loanDeduction,
    bonusAmount: it.bonusAmount,
    allowanceAmount: it.allowanceAmount,
    otherDeductions: it.otherDeductions,
    totalDeductions: it.totalDeductions,
    netSalary: it.netSalary,
    payableSalary: it.payableSalary,
  };
}

// Maps a persisted salary_run_items row (optionally joined with its run) to the
// report/detail JSON shape, parsing numeric strings to numbers.
function mapItemRow(r: any) {
  return {
    id: r.id,
    runId: r.run_id,
    employeeId: r.user_id,
    employeeName: r.employee_name,
    role: r.role ?? null,
    department: r.department,
    branch: r.branch,
    month: r.period_month ?? null,
    year: r.period_year ?? null,
    runStatus: r.run_status ?? null,
    basicSalary: num(r.basic_salary),
    perDaySalary: num(r.per_day_salary),
    grossSalary: num(r.gross_salary),
    daysPresent: num(r.days_present),
    daysAbsent: num(r.days_absent),
    leaveDays: num(r.leave_days),
    unpaidLeaveDays: num(r.unpaid_leave_days),
    lateMinutes: num(r.late_minutes),
    overtimeMinutes: num(r.overtime_minutes),
    overtimeAmount: num(r.overtime_amount),
    absenceDeduction: num(r.absence_deduction),
    penaltyAmount: num(r.penalty_amount),
    loanDeduction: num(r.loan_deduction),
    bonusAmount: num(r.bonus_amount),
    allowanceAmount: num(r.allowance_amount),
    otherDeductions: num(r.other_deductions),
    totalDeductions: num(r.total_deductions),
    netSalary: num(r.net_salary),
    payableSalary: num(r.payable_salary),
    paymentStatus: r.payment_status ?? "UNPAID",
    calculationSnapshot: r.calculation_snapshot ?? null,
  };
}

function parseAdjustments(body: any): Map<string, ManualAdjustment> {
  const map = new Map<string, ManualAdjustment>();
  const raw = body?.manualAdjustments;
  if (!Array.isArray(raw)) return map;
  for (const entry of raw) {
    const id = entry?.userId ?? entry?.employeeId;
    if (!id) continue;
    map.set(String(id), {
      bonusAmount: entry?.bonusAmount,
      allowanceAmount: entry?.allowanceAmount,
      loanDeduction: entry?.loanDeduction,
      otherDeductions: entry?.otherDeductions,
    });
  }
  return map;
}

// Status lifecycle. FINALIZED and legacy LOCKED are terminal/locked.
const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["GENERATED", "CANCELLED"],
  GENERATED: ["APPROVED", "DRAFT", "CANCELLED"],
  APPROVED: ["FINALIZED", "GENERATED", "CANCELLED"],
  FINALIZED: [],
  CANCELLED: [],
  LOCKED: [],
};
const ALL_STATUSES = Object.keys(STATUS_TRANSITIONS);
function isLockedStatus(status: string): boolean {
  return status === "FINALIZED" || status === "LOCKED";
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Shared filter builder for the salary report list + export. Returns a WHERE
// clause over a (salary_run_items i JOIN salary_runs r) query. Executives are
// hard-scoped to their own user_id regardless of any client-supplied filter.
function buildReportFilters(req: Request): { clause: string; params: any[]; selfScoped: boolean } {
  const where: string[] = ["r.deleted_at IS NULL"];
  const params: any[] = [];
  const isMgmt = hasSalaryManagementRole(req);

  if (!isMgmt) {
    // Hard self-scope: non-management users only ever see their OWN salary lines,
    // and the client-supplied employeeId/userId is ignored entirely.
    const self = actorUserId(req);
    if (!self || !isUuid(self)) {
      where.push("false");
    } else {
      params.push(self);
      where.push(`i.user_id = $${params.length}`);
    }
  } else if (req.query.userId || req.query.employeeId) {
    const uid = String(req.query.userId ?? req.query.employeeId);
    if (!isUuid(uid)) {
      where.push("false");
    } else {
      params.push(uid);
      where.push(`i.user_id = $${params.length}`);
    }
  }

  if (req.query.department) { params.push(String(req.query.department)); where.push(`i.department = $${params.length}`); }
  if (req.query.branch) { params.push(String(req.query.branch)); where.push(`i.branch = $${params.length}`); }
  if (req.query.month) { params.push(Number(req.query.month)); where.push(`r.period_month = $${params.length}`); }
  if (req.query.year) { params.push(Number(req.query.year)); where.push(`r.period_year = $${params.length}`); }
  if (req.query.status) { params.push(String(req.query.status).toUpperCase()); where.push(`r.status = $${params.length}`); }
  if (req.query.paymentStatus) { params.push(String(req.query.paymentStatus).toUpperCase()); where.push(`i.payment_status = $${params.length}`); }
  if (req.query.generatedBy) {
    const gb = String(req.query.generatedBy);
    if (!isUuid(gb)) { where.push("false"); }
    else { params.push(gb); where.push(`r.generated_by_user_id = $${params.length}`); }
  }

  return { clause: `WHERE ${where.join(" AND ")}`, params, selfScoped: !isMgmt };
}

const REPORT_SELECT = `
  SELECT i.id, i.run_id, i.user_id, i.employee_name, i.department, i.branch,
         i.basic_salary, i.per_day_salary, i.gross_salary, i.days_present, i.days_absent,
         i.leave_days, i.unpaid_leave_days, i.late_minutes, i.overtime_minutes, i.overtime_amount,
         i.absence_deduction, i.penalty_amount, i.loan_deduction, i.bonus_amount, i.allowance_amount,
         i.other_deductions, i.total_deductions, i.net_salary, i.payable_salary, i.payment_status,
         i.calculation_snapshot,
         r.period_month, r.period_year, r.status AS run_status
    FROM drm.salary_run_items i
    JOIN drm.salary_runs r ON r.id = i.run_id`;

export function registerSalaryRoutes(app: Express) {
  // -------------------------------------------------------------------------
  // GET /api/salary/preview — live computed lines (not persisted). Mgmt only.
  // -------------------------------------------------------------------------
  app.get("/api/salary/preview", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!hasSalaryManagementRole(req)) return res.status(403).json({ error: "Not authorized for salary" });
      const period = parsePeriod(req);
      if (!period) return res.status(400).json({ error: "Valid month (1-12) and year are required" });

      const items = await computeItems(
        period.month,
        period.year,
        {
          branch: (req.query.branch as string) || undefined,
          department: (req.query.department as string) || undefined,
          userId: (req.query.userId as string) || undefined,
        },
        new Map(),
      );

      // Surface employees who cannot be paid honestly because basic salary is unset.
      const missingData = items
        .filter((it) => it.basicSalary <= 0)
        .map((it) => ({ employeeId: it.userId, employeeName: it.employeeName, reason: "basic_salary not set" }));

      const totals = totalsFromComputed(items);
      res.json({
        period,
        items: items.map(computedToJson),
        totals: {
          totalGross: round2(totals.totalGross),
          totalDeductions: round2(totals.totalDeductions),
          totalNet: round2(totals.totalNet),
        },
        employeeCount: items.length,
        missingData,
      });
    } catch (err) {
      console.error("Error computing salary preview:", err);
      res.status(500).json({ error: "Failed to compute salary preview" });
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/salary/runs — persist a run as DRAFT (default) or GENERATED.
  // -------------------------------------------------------------------------
  app.post("/api/salary/runs", async (req: Request, res: Response) => {
    const client = await pool.connect();
    let began = false;
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!hasSalaryManagementRole(req)) return res.status(403).json({ error: "Not authorized for salary" });
      const period = parsePeriod(req);
      if (!period) return res.status(400).json({ error: "Valid month (1-12) and year are required" });

      const requested = String(req.body?.status || "DRAFT").toUpperCase();
      if (requested !== "DRAFT" && requested !== "GENERATED") {
        return res.status(400).json({ error: "status on create must be DRAFT or GENERATED" });
      }
      const branch = (req.body?.branch as string) || null;
      const department = (req.body?.department as string) || null;
      const notes = (req.body?.notes as string) || null;
      const remarks = (req.body?.remarks as string) || null;

      const adjustments = parseAdjustments(req.body);
      // Validate any client-supplied adjustment numbers (reject non-finite).
      for (const a of Array.from(adjustments.values())) {
        for (const v of [a.bonusAmount, a.allowanceAmount, a.loanDeduction, a.otherDeductions]) {
          if (v !== undefined && v !== null && !Number.isFinite(Number(v))) {
            return res.status(400).json({ error: "manualAdjustments must contain finite numbers" });
          }
        }
      }

      // Duplicate-period guard: one run per month/year/branch/department.
      const dup = await client.query(
        `SELECT id, status FROM drm.salary_runs
          WHERE period_month = $1 AND period_year = $2
            AND COALESCE(branch,'') = COALESCE($3,'')
            AND COALESCE(department,'') = COALESCE($4,'')
            AND deleted_at IS NULL
          LIMIT 1`,
        [period.month, period.year, branch, department],
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({
          error: "A salary run for this period and scope already exists",
          existingRunId: dup.rows[0].id,
          existingStatus: dup.rows[0].status,
        });
      }

      const items = await computeItems(
        period.month,
        period.year,
        { branch: branch || undefined, department: department || undefined },
        adjustments,
      );
      if (items.length === 0) {
        return res.status(400).json({ error: "No active employees match this period/scope" });
      }
      const totals = totalsFromComputed(items);

      const actor = actorUserId(req);
      await client.query("BEGIN");
      began = true;
      const runRes = await client.query(
        `INSERT INTO drm.salary_runs
           (period_month, period_year, branch, department, status, notes, remarks,
            employee_count, total_gross, total_deductions, total_net, created_by_user_id,
            generated_by_user_id, generated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::uuid,
                 CASE WHEN $5 = 'GENERATED' THEN $12::uuid ELSE NULL END,
                 CASE WHEN $5 = 'GENERATED' THEN now() ELSE NULL END)
         RETURNING *`,
        [
          period.month, period.year, branch, department, requested, notes, remarks,
          items.length, round2(totals.totalGross), round2(totals.totalDeductions), round2(totals.totalNet), actor,
        ],
      );
      const run = runRes.rows[0];

      for (const it of items) {
        await client.query(
          `INSERT INTO drm.salary_run_items
             (run_id, user_id, employee_name, department, branch,
              basic_salary, per_day_salary, days_present, days_absent,
              leave_days, unpaid_leave_days, late_minutes, overtime_minutes,
              gross_salary, absence_deduction, penalty_amount, loan_deduction,
              bonus_amount, allowance_amount, other_deductions, overtime_amount,
              total_deductions, net_salary, payable_salary, payment_status, calculation_snapshot)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'UNPAID',$25::jsonb)`,
          [
            run.id, it.userId, it.employeeName, it.department, it.branch,
            it.basicSalary, it.perDaySalary, it.daysPresent, it.daysAbsent,
            it.leaveDays, it.unpaidLeaveDays, it.lateMinutes, it.overtimeMinutes,
            it.grossSalary, it.absenceDeduction, it.penaltyAmount, it.loanDeduction,
            it.bonusAmount, it.allowanceAmount, it.otherDeductions, it.overtimeAmount,
            it.totalDeductions, it.netSalary, it.payableSalary, JSON.stringify(it.snapshot),
          ],
        );
      }
      await client.query("COMMIT");
      began = false;

      await recordAuditLog({
        actorUserId: actor,
        action: "salary.run.created",
        module: "payroll",
        entityType: "salary_run",
        entityId: run.id,
        nextStatus: requested,
        after: { period, branch, department, employeeCount: items.length, totals },
        req,
      });

      const itemsRes = await pool.query(`${REPORT_SELECT} WHERE i.run_id = $1 ORDER BY i.employee_name ASC`, [run.id]);
      res.status(201).json({ run, items: itemsRes.rows.map(mapItemRow) });
    } catch (err) {
      if (began) await client.query("ROLLBACK").catch(() => {});
      console.error("Error creating salary run:", err);
      res.status(500).json({ error: "Failed to create salary run" });
    } finally {
      client.release();
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/salary/runs — list runs (mgmt only; exposes aggregates).
  // -------------------------------------------------------------------------
  app.get("/api/salary/runs", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!hasSalaryManagementRole(req)) return res.status(403).json({ error: "Not authorized for salary" });
      const where: string[] = ["deleted_at IS NULL"];
      const params: any[] = [];
      if (req.query.month) { params.push(Number(req.query.month)); where.push(`period_month = $${params.length}`); }
      if (req.query.year) { params.push(Number(req.query.year)); where.push(`period_year = $${params.length}`); }
      if (req.query.status) { params.push(String(req.query.status).toUpperCase()); where.push(`status = $${params.length}`); }
      if (req.query.branch) { params.push(String(req.query.branch)); where.push(`branch = $${params.length}`); }
      if (req.query.department) { params.push(String(req.query.department)); where.push(`department = $${params.length}`); }
      const clause = `WHERE ${where.join(" AND ")}`;
      const runs = await pool.query(
        `SELECT * FROM drm.salary_runs ${clause} ORDER BY period_year DESC, period_month DESC, created_at DESC`,
        params,
      );
      res.json({ runs: runs.rows });
    } catch (err) {
      console.error("Error listing salary runs:", err);
      res.status(500).json({ error: "Failed to list salary runs" });
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/salary/runs/:id — run + items (mgmt only; exposes all employees).
  // -------------------------------------------------------------------------
  app.get("/api/salary/runs/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!hasSalaryManagementRole(req)) return res.status(403).json({ error: "Not authorized for salary" });
      const runRes = await pool.query(`SELECT * FROM drm.salary_runs WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
      if (runRes.rows.length === 0) return res.status(404).json({ error: "Salary run not found" });
      const itemsRes = await pool.query(
        `${REPORT_SELECT} WHERE i.run_id = $1 ORDER BY i.employee_name ASC`,
        [req.params.id],
      );
      res.json({ run: runRes.rows[0], items: itemsRes.rows.map(mapItemRow) });
    } catch (err) {
      console.error("Error fetching salary run:", err);
      res.status(500).json({ error: "Failed to fetch salary run" });
    }
  });

  // -------------------------------------------------------------------------
  // PATCH /api/salary/runs/:id/status — guarded lifecycle transition.
  // -------------------------------------------------------------------------
  app.patch("/api/salary/runs/:id/status", async (req: Request, res: Response) => {
    const client = await pool.connect();
    let began = false;
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!hasSalaryManagementRole(req)) return res.status(403).json({ error: "Not authorized for salary" });
      const target = String(req.body?.status || "").toUpperCase();
      if (!ALL_STATUSES.includes(target)) {
        return res.status(400).json({ error: `status must be one of ${ALL_STATUSES.join(", ")}` });
      }
      const actor = actorUserId(req);

      await client.query("BEGIN");
      began = true;
      const existing = await client.query(
        `SELECT * FROM drm.salary_runs WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [req.params.id],
      );
      if (existing.rows.length === 0) {
        await client.query("ROLLBACK");
        began = false;
        return res.status(404).json({ error: "Salary run not found" });
      }
      const run = existing.rows[0];
      const current = String(run.status).toUpperCase();

      if (isLockedStatus(current)) {
        await client.query("ROLLBACK");
        began = false;
        return res.status(409).json({ error: `A ${current} salary run cannot be modified` });
      }
      const allowedTargets = STATUS_TRANSITIONS[current] || [];
      if (!allowedTargets.includes(target)) {
        await client.query("ROLLBACK");
        began = false;
        return res.status(409).json({
          error: `Invalid transition ${current} -> ${target}`,
          allowedTransitions: allowedTargets,
        });
      }

      // FINALIZED: serialize per-period finalizes and block a second FINALIZED
      // salary for the same employee/month/year (across any other run).
      if (target === "FINALIZED") {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
          `salary_finalize:${run.period_year}-${run.period_month}`,
        ]);
        const conflict = await client.query(
          `SELECT i.user_id, i.employee_name
             FROM drm.salary_run_items i
             JOIN drm.salary_runs r ON r.id = i.run_id
            WHERE r.period_month = $1 AND r.period_year = $2
              AND r.status = 'FINALIZED' AND r.id <> $3 AND r.deleted_at IS NULL
              AND i.user_id IN (SELECT user_id FROM drm.salary_run_items WHERE run_id = $3)
            LIMIT 20`,
          [run.period_month, run.period_year, run.id],
        );
        if (conflict.rows.length > 0) {
          await client.query("ROLLBACK");
          began = false;
          return res.status(409).json({
            error: "One or more employees already have a FINALIZED salary for this month/year",
            conflicts: conflict.rows.map((c: any) => ({ employeeId: c.user_id, employeeName: c.employee_name })),
          });
        }
      }

      const sets: string[] = ["status = $1", "updated_at = now()"];
      const params: any[] = [target, req.params.id];
      if (target === "APPROVED") {
        params.push(actor);
        sets.push(`approved_by_user_id = $${params.length}`, "approved_at = now()");
      } else if (target === "GENERATED") {
        params.push(actor);
        sets.push(`generated_by_user_id = $${params.length}`, "generated_at = now()");
      } else if (target === "FINALIZED") {
        params.push(actor);
        sets.push(`finalized_by_user_id = $${params.length}`, "finalized_at = now()");
      }
      const updated = await client.query(
        `UPDATE drm.salary_runs SET ${sets.join(", ")} WHERE id = $2 RETURNING *`,
        params,
      );
      await client.query("COMMIT");
      began = false;

      await recordAuditLog({
        actorUserId: actor,
        action: "salary.run.status_changed",
        module: "payroll",
        entityType: "salary_run",
        entityId: req.params.id,
        previousStatus: current,
        nextStatus: target,
        reason: (req.body?.reason as string) || undefined,
        req,
      });

      res.json({ run: updated.rows[0] });
    } catch (err) {
      if (began) await client.query("ROLLBACK").catch(() => {});
      console.error("Error updating salary run status:", err);
      res.status(500).json({ error: "Failed to update salary run status" });
    } finally {
      client.release();
    }
  });

  // -------------------------------------------------------------------------
  // PATCH /api/salary/run-items/:id — edit manual adjustments (DRAFT/GENERATED).
  // -------------------------------------------------------------------------
  app.patch("/api/salary/run-items/:id", async (req: Request, res: Response) => {
    const client = await pool.connect();
    let began = false;
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!hasSalaryManagementRole(req)) return res.status(403).json({ error: "Not authorized for salary" });

      const EDITABLE = ["bonusAmount", "allowanceAmount", "loanDeduction", "otherDeductions"] as const;
      const updates: Record<string, number> = {};
      for (const f of EDITABLE) {
        if (req.body?.[f] !== undefined && req.body?.[f] !== null) {
          if (!Number.isFinite(Number(req.body[f]))) {
            return res.status(400).json({ error: `${f} must be a finite number` });
          }
          updates[f] = nonNegMoney(req.body[f]);
        }
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: `Provide at least one of: ${EDITABLE.join(", ")}` });
      }

      await client.query("BEGIN");
      began = true;
      const itemRes = await client.query(
        `SELECT i.*, r.status AS run_status, r.id AS run_id
           FROM drm.salary_run_items i
           JOIN drm.salary_runs r ON r.id = i.run_id
          WHERE i.id = $1 AND r.deleted_at IS NULL
          FOR UPDATE OF i`,
        [req.params.id],
      );
      if (itemRes.rows.length === 0) {
        await client.query("ROLLBACK");
        began = false;
        return res.status(404).json({ error: "Salary line not found" });
      }
      const item = itemRes.rows[0];
      const runStatus = String(item.run_status).toUpperCase();
      if (runStatus !== "DRAFT" && runStatus !== "GENERATED") {
        await client.query("ROLLBACK");
        began = false;
        return res.status(409).json({ error: `Lines can only be edited while the run is DRAFT or GENERATED (run is ${runStatus})` });
      }

      const before = mapItemRow(item);
      const basic = num(item.basic_salary);
      const perDay = num(item.per_day_salary);
      const absenceDeduction = num(item.absence_deduction);
      const penaltyAmount = num(item.penalty_amount);
      const unpaidLeaveDeduction = round2(num(item.unpaid_leave_days) * perDay);
      const overtimeAmount = num(item.overtime_amount);

      const bonus = updates.bonusAmount ?? num(item.bonus_amount);
      const allowance = updates.allowanceAmount ?? num(item.allowance_amount);
      const loanDeduction = updates.loanDeduction ?? num(item.loan_deduction);
      const otherDeductions = updates.otherDeductions ?? num(item.other_deductions);

      const gross = round2(basic + allowance + bonus + overtimeAmount);
      const totalDeductions = round2(
        absenceDeduction + unpaidLeaveDeduction + penaltyAmount + loanDeduction + otherDeductions,
      );
      const net = round2(gross - totalDeductions);
      const payable = Math.max(0, net);

      await client.query(
        `UPDATE drm.salary_run_items
            SET bonus_amount = $1, allowance_amount = $2, loan_deduction = $3, other_deductions = $4,
                gross_salary = $5, total_deductions = $6, net_salary = $7, payable_salary = $8
          WHERE id = $9`,
        [bonus, allowance, loanDeduction, otherDeductions, gross, totalDeductions, net, payable, req.params.id],
      );

      // Recompute parent run aggregates from its lines.
      await client.query(
        `UPDATE drm.salary_runs r
            SET total_gross = agg.g, total_deductions = agg.d, total_net = agg.n, updated_at = now()
           FROM (SELECT COALESCE(SUM(gross_salary),0) AS g,
                        COALESCE(SUM(total_deductions),0) AS d,
                        COALESCE(SUM(payable_salary),0) AS n
                   FROM drm.salary_run_items WHERE run_id = $1) agg
          WHERE r.id = $1`,
        [item.run_id],
      );
      await client.query("COMMIT");
      began = false;

      const actor = actorUserId(req);
      const updatedRes = await pool.query(`${REPORT_SELECT} WHERE i.id = $1`, [req.params.id]);
      const after = mapItemRow(updatedRes.rows[0]);
      await recordAuditLog({
        actorUserId: actor,
        action: "salary.item.edited",
        module: "payroll",
        entityType: "salary_run_item",
        entityId: req.params.id,
        before: {
          bonusAmount: before.bonusAmount, allowanceAmount: before.allowanceAmount,
          loanDeduction: before.loanDeduction, otherDeductions: before.otherDeductions,
          totalDeductions: before.totalDeductions, payableSalary: before.payableSalary,
        },
        after: {
          bonusAmount: after.bonusAmount, allowanceAmount: after.allowanceAmount,
          loanDeduction: after.loanDeduction, otherDeductions: after.otherDeductions,
          totalDeductions: after.totalDeductions, payableSalary: after.payableSalary,
        },
        reason: (req.body?.reason as string) || undefined,
        req,
      });

      res.json({ item: after });
    } catch (err) {
      if (began) await client.query("ROLLBACK").catch(() => {});
      console.error("Error editing salary line:", err);
      res.status(500).json({ error: "Failed to edit salary line" });
    } finally {
      client.release();
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/reports/salary — paginated report (registered before the reports
  // catch-all so the exact path wins). Mgmt sees all; others see self only.
  // -------------------------------------------------------------------------
  app.get("/api/reports/salary", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { clause, params, selfScoped } = buildReportFilters(req);

      let page = Number(req.query.page ?? 1);
      if (!Number.isInteger(page) || page < 1) page = 1;
      let limit = Number(req.query.limit ?? req.query.pageSize ?? 50);
      if (!Number.isInteger(limit) || limit < 1) limit = 50;
      if (limit > 200) limit = 200;
      const offset = (page - 1) * limit;

      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM drm.salary_run_items i JOIN drm.salary_runs r ON r.id = i.run_id ${clause}`,
        params,
      );
      const total = countRes.rows[0]?.total ?? 0;

      const sumRes = await pool.query(
        `SELECT COALESCE(SUM(i.gross_salary),0) AS gross,
                COALESCE(SUM(i.total_deductions),0) AS ded,
                COALESCE(SUM(i.payable_salary),0) AS net,
                COUNT(DISTINCT i.user_id)::int AS employees
           FROM drm.salary_run_items i JOIN drm.salary_runs r ON r.id = i.run_id ${clause}`,
        params,
      );
      const s = sumRes.rows[0] || {};

      const rowsRes = await pool.query(
        `${REPORT_SELECT} ${clause}
         ORDER BY r.period_year DESC, r.period_month DESC, i.employee_name ASC
         LIMIT ${limit} OFFSET ${offset}`,
        params,
      );

      res.json({
        filters: {
          userId: selfScoped ? actorUserId(req) : (req.query.userId ?? req.query.employeeId ?? null),
          department: req.query.department ?? null,
          branch: req.query.branch ?? null,
          month: req.query.month ?? null,
          year: req.query.year ?? null,
          status: req.query.status ?? null,
          paymentStatus: req.query.paymentStatus ?? null,
          generatedBy: req.query.generatedBy ?? null,
          selfScoped,
        },
        rows: rowsRes.rows.map(mapItemRow),
        summary: {
          totalGross: round2(num(s.gross)),
          totalDeductions: round2(num(s.ded)),
          totalNet: round2(num(s.net)),
          employeeCount: num(s.employees),
        },
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      });
    } catch (err) {
      console.error("Error in salary report:", err);
      res.status(500).json({ error: "Failed to load salary report" });
    }
  });

  // GET /api/reports/salary/export — CSV honoring the same filters/scope.
  app.get("/api/reports/salary/export", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { clause, params } = buildReportFilters(req);
      const rowsRes = await pool.query(
        `${REPORT_SELECT} ${clause}
         ORDER BY r.period_year DESC, r.period_month DESC, i.employee_name ASC
         LIMIT 5000`,
        params,
      );
      const header = [
        "Year", "Month", "Employee", "Department", "Branch", "Run Status", "Payment Status",
        "Basic", "Per Day", "Gross", "Days Present", "Days Absent", "Leave Days", "Unpaid Leave Days",
        "Overtime Minutes", "Absence Deduction", "Penalty", "Loan", "Bonus", "Allowance",
        "Other Deductions", "Total Deductions", "Net", "Payable",
      ];
      const lines = [header.join(",")];
      for (const raw of rowsRes.rows) {
        const r = mapItemRow(raw);
        lines.push([
          csvCell(r.year), csvCell(r.month), csvCell(r.employeeName), csvCell(r.department), csvCell(r.branch),
          csvCell(r.runStatus), csvCell(r.paymentStatus), csvCell(r.basicSalary), csvCell(r.perDaySalary),
          csvCell(r.grossSalary), csvCell(r.daysPresent), csvCell(r.daysAbsent), csvCell(r.leaveDays),
          csvCell(r.unpaidLeaveDays), csvCell(r.overtimeMinutes), csvCell(r.absenceDeduction), csvCell(r.penaltyAmount),
          csvCell(r.loanDeduction), csvCell(r.bonusAmount), csvCell(r.allowanceAmount), csvCell(r.otherDeductions),
          csvCell(r.totalDeductions), csvCell(r.netSalary), csvCell(r.payableSalary),
        ].join(","));
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="salary_report.csv"`);
      res.send(lines.join("\n"));
    } catch (err) {
      console.error("Error exporting salary report:", err);
      res.status(500).json({ error: "Failed to export salary report" });
    }
  });
}
