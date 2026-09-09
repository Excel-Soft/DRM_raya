import type { Express, Request, Response } from "express";
import { pool } from "../db";
import { normalizeRole, isManagerialRole } from "../utils/role-utils";
import { recordAuditLog } from "../services/activity-service";
import { buildExportFilename } from "../utils/export-filename";

// ---------------------------------------------------------------------------
// Permissions (Patch 2 Stage 4) — action-aware, role-based.
//
// Salary is sensitive. The previous flat allow-list is replaced by a class +
// per-action matrix, all compared on NORMALIZED role keys (normalizeRole
// collapses super_admin/administrator -> admin, accountant/accounts_office ->
// account_manager, etc). Row-level scoping ("own"/"department"/"all") is layered
// on top by resolveScope().
// ---------------------------------------------------------------------------

export type SalaryAction =
  | "preview"
  | "generate"
  | "view"
  | "export"
  | "approve"
  | "finalize"
  | "edit"
  | "cancel"
  | "mark_paid";

export type SalaryClass = "full" | "accounts" | "hr" | "hod" | "manager" | "executive";

// What each class may do. `full` (admin/super_hod) may do everything.
export const CLASS_ACTIONS: Record<SalaryClass, Set<SalaryAction>> = {
  full: new Set<SalaryAction>([
    "preview", "generate", "view", "export", "approve", "finalize", "edit", "cancel", "mark_paid",
  ]),
  accounts: new Set<SalaryAction>([
    "preview", "generate", "view", "export", "approve", "finalize", "edit", "cancel", "mark_paid",
  ]),
  hr: new Set<SalaryAction>([
    "preview", "generate", "view", "export", "approve", "edit", "cancel",
  ]),
  hod: new Set<SalaryAction>(["view", "approve"]),
  manager: new Set<SalaryAction>(["view"]),
  executive: new Set<SalaryAction>(["view"]),
};

function callerRole(req: Request): string {
  const u = req.user as any;
  return String(u?.activeRoleId ?? u?.roleId ?? u?.role ?? "");
}

// Pure role -> class resolver (no req dependency) so the permission matrix can
// be unit-tested directly. Input is the raw role string; normalizeRole collapses
// the many spellings to canonical keys.
export function salaryClassForRole(rawRole: string): SalaryClass {
  const role = normalizeRole(rawRole);
  if (role === "admin" || role === "super_hod") return "full";
  if (role === "account_manager") return "accounts";
  if (role === "hr" || role === "hr_manager") return "hr";
  if (role === "hod") return "hod";
  if (isManagerialRole(role)) return "manager";
  return "executive";
}

// Pure capability check for a class + action (unit-testable).
export function classCan(cls: SalaryClass, action: SalaryAction): boolean {
  return CLASS_ACTIONS[cls].has(action);
}

function salaryClass(req: Request): SalaryClass {
  return salaryClassForRole(callerRole(req));
}

function can(req: Request, action: SalaryAction): boolean {
  return classCan(salaryClass(req), action);
}

// Employee-bonus management is restricted to the same classes that may edit
// salary lines: admin/super_hod (full), accounts, and HR. HOD/manager/executive
// classes may not create, edit, approve, or reject bonuses. Kept as a single
// gate so create/edit/approve/reject/delete all share one consistent rule.
function canBonus(req: Request): boolean {
  const cls = salaryClass(req);
  return cls === "full" || cls === "accounts" || cls === "hr";
}

function deny(res: Response, action: string) {
  return res.status(403).json({ error: `You are not authorized to ${action} salary.` });
}

// Caller's own department, resolved once and cached on the request. Used for
// HOD / manager row-scoping. Returns null when unknown.
async function callerDepartment(req: Request): Promise<string | null> {
  const cached = (req as any)._salaryDept;
  if (cached !== undefined) return cached;
  let dept: string | null = null;
  try {
    const r = await pool.query(`SELECT department FROM drm.users WHERE id = $1`, [req.user!.userId]);
    dept = r.rows[0]?.department ?? null;
  } catch {
    dept = null;
  }
  (req as any)._salaryDept = dept;
  return dept;
}

interface Scope {
  kind: "all" | "department" | "self";
  department?: string | null;
  userId?: string;
}

async function resolveScope(req: Request): Promise<Scope> {
  const cls = salaryClass(req);
  if (cls === "full" || cls === "accounts" || cls === "hr") return { kind: "all" };
  if (cls === "hod" || cls === "manager") {
    return { kind: "department", department: await callerDepartment(req) };
  }
  return { kind: "self", userId: req.user!.userId };
}

// ---------------------------------------------------------------------------
// Numeric helpers — parse/validate money + period.
// ---------------------------------------------------------------------------

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Proxy-aware client IP, mirroring the extraction recordAuditLog uses, so audit
// rows written inside a transaction carry the same context as the helper would.
function auditIp(req: Request): string | undefined {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) return xf.split(",")[0].trim();
  return req.ip || (req.socket && req.socket.remoteAddress) || undefined;
}

// Validate a manual money input: must be a finite number >= 0. Returns the
// parsed number, or null when invalid (so the route can 400 honestly).
function parseManualMoney(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return round2(n);
}

// Like parseManualMoney but distinguishes "not provided" from 0 so a salary line
// can fall back to its real source value when no override is supplied.
//   undefined -> no override (use the source default)
//   null      -> invalid (route should 400)
//   number    -> explicit override (including an explicit 0)
function parseOptionalMoney(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return round2(n);
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

// Inclusive whole-day overlap between [aStart,aEnd] and [bStart,bEnd].
function overlapDays(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const s = Math.max(aStart.getTime(), bStart.getTime());
  const e = Math.min(aEnd.getTime(), bEnd.getTime());
  if (e < s) return 0;
  const day = 24 * 60 * 60 * 1000;
  const sd = new Date(s); sd.setHours(0, 0, 0, 0);
  const ed = new Date(e); ed.setHours(0, 0, 0, 0);
  return Math.floor((ed.getTime() - sd.getTime()) / day) + 1;
}

// ---------------------------------------------------------------------------
// Preview computation — full per-employee payroll lines from live data only.
//
// Formulas (documented in PATCH2_STAGE4_SALARY_CHANGELOG.md):
//   perDaySalary           = basicSalary / 30
//   grossSalary            = basicSalary + allowance + bonus + overtimeAmount
//   unpaidLeaveDeduction   = unpaidLeaveDays * perDaySalary
//   absenceDeduction       = daysAbsent * perDaySalary
//   lateDeduction          = 0  (no late-penalty policy; lateMinutes informational)
//   penaltyAmount          = SUM approved, non-voided penalties in period
//   allowanceAmount        = SUM of fixed users.* allowance columns (real source)
//   bonusAmount            = SUM approved drm.employee_bonuses for the period
//   loanDeduction          = SUM outstanding instalments on active loan_requests
//   overtimeAmount         = 0  (no overtime rate; minutes informational, manual)
//   totalDeductions        = unpaidLeave + absence + late + penalty + loan + other
//   netSalary              = gross - totalDeductions
//   payableSalary          = max(0, netSalary)
// allowance/bonus/loan now default to their real source records; a per-line
// manual adjustment still overrides them. overtimeAmount/otherDeductions have no
// source and stay 0 unless entered manually — never fabricated.
// ---------------------------------------------------------------------------

interface ManualAdj {
  bonusAmount?: number;
  allowanceAmount?: number;
  overtimeAmount?: number;
  loanDeduction?: number;
  otherDeductions?: number;
  remarks?: string | null;
}

// Pure per-employee payroll math, extracted from computePreview so the formulas
// (gross/deductions/net/payable) can be unit-tested without a database. Inputs
// that lack a real source (allowance/bonus/overtimeAmount/loan/other) default to
// 0 — never fabricated. The math here is the single source of truth; both the
// preview and the persisted run lines flow through it.
export interface SalaryLineInput {
  basicSalary: number | string | null | undefined;
  daysAbsent?: number;
  unpaidLeaveDays?: number;
  penaltyAmount?: number | string | null;
  allowanceAmount?: number | string | null;
  bonusAmount?: number | string | null;
  overtimeAmount?: number | string | null;
  loanDeduction?: number | string | null;
  otherDeductions?: number | string | null;
}

export interface SalaryLineOutput {
  basicSalary: number;
  perDaySalary: number;
  daysAbsent: number;
  unpaidLeaveDays: number;
  penaltyAmount: number;
  allowanceAmount: number;
  bonusAmount: number;
  overtimeAmount: number;
  loanDeduction: number;
  otherDeductions: number;
  lateDeduction: number;
  unpaidLeaveDeduction: number;
  absenceDeduction: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  payableSalary: number;
}

export function computeSalaryLine(input: SalaryLineInput): SalaryLineOutput {
  const basicSalary = round2(toNum(input.basicSalary));
  const perDaySalary = round2(basicSalary / 30);
  const daysAbsent = toNum(input.daysAbsent);
  const unpaidLeaveDays = toNum(input.unpaidLeaveDays);
  const penaltyAmount = round2(toNum(input.penaltyAmount));

  const allowanceAmount = round2(toNum(input.allowanceAmount));
  const bonusAmount = round2(toNum(input.bonusAmount));
  const overtimeAmount = round2(toNum(input.overtimeAmount)); // no rate policy -> manual only
  const loanDeduction = round2(toNum(input.loanDeduction));
  const otherDeductions = round2(toNum(input.otherDeductions));

  const lateDeduction = 0; // no late-penalty policy

  const unpaidLeaveDeduction = round2(unpaidLeaveDays * perDaySalary);
  const absenceDeduction = round2(daysAbsent * perDaySalary);
  const grossSalary = round2(basicSalary + allowanceAmount + bonusAmount + overtimeAmount);
  const totalDeductions = round2(
    unpaidLeaveDeduction + absenceDeduction + lateDeduction + penaltyAmount + loanDeduction + otherDeductions,
  );
  const netSalary = round2(grossSalary - totalDeductions);
  const payableSalary = round2(Math.max(0, netSalary));

  return {
    basicSalary, perDaySalary, daysAbsent, unpaidLeaveDays, penaltyAmount,
    allowanceAmount, bonusAmount, overtimeAmount, loanDeduction, otherDeductions,
    lateDeduction, unpaidLeaveDeduction, absenceDeduction,
    grossSalary, totalDeductions, netSalary, payableSalary,
  };
}

interface PreviewItem {
  userId: string;
  employeeName: string;
  department: string | null;
  branch: string | null;
  basicSalary: number;
  perDaySalary: number;
  daysPresent: number;
  daysAbsent: number;
  leaveDays: number;
  unpaidLeaveDays: number;
  lateMinutes: number;
  overtimeMinutes: number;
  allowanceAmount: number;
  bonusAmount: number;
  overtimeAmount: number;
  grossSalary: number;
  unpaidLeaveDeduction: number;
  absenceDeduction: number;
  lateDeduction: number;
  penaltyAmount: number;
  loanDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  payableSalary: number;
  calculationSnapshot: Record<string, unknown>;
}

async function computePreview(
  month: number,
  year: number,
  filters: { branch?: string; department?: string; userId?: string },
  manual: Record<string, ManualAdj> = {},
): Promise<PreviewItem[]> {
  const { start, end } = periodBounds(month, year);

  const where: string[] = ["u.is_active = true"];
  const params: any[] = [];
  if (filters.branch) { params.push(filters.branch); where.push(`u.branch = $${params.length}`); }
  if (filters.department) { params.push(filters.department); where.push(`u.department = $${params.length}`); }
  if (filters.userId) { params.push(filters.userId); where.push(`u.id = $${params.length}`); }

  const usersRes = await pool.query(
    `SELECT u.id, COALESCE(u.full_name, u.name, u.username) AS name,
            u.department, u.branch, u.basic_salary,
            u.daily_allowance, u.mobile_allowance,
            u.admin_allowance, u.conveyance_allowance
       FROM drm.users u
      WHERE ${where.join(" AND ")}
      ORDER BY name ASC`,
    params,
  );

  // Attendance present/absent counts (attendance.user_id is varchar = users.id::text).
  const attRes = await pool.query(
    `SELECT user_id,
            COUNT(*) FILTER (WHERE status IN ('Present','Late','HalfDay')) AS present,
            COUNT(*) FILTER (WHERE status = 'Absent') AS absent
       FROM drm.attendance
      WHERE date >= $1 AND date <= $2
      GROUP BY user_id`,
    [start, end],
  );
  const attMap = new Map<string, { present: number; absent: number }>();
  for (const r of attRes.rows) {
    attMap.set(String(r.user_id), { present: Number(r.present || 0), absent: Number(r.absent || 0) });
  }

  // Approved leave overlapping the period (Unpaid -> deduction, others informational).
  const leaveRes = await pool.query(
    `SELECT user_id, type as leave_type, from_date, to_date
       FROM drm.leave_requests
      WHERE status = 'Approved' AND from_date <= $2 AND to_date >= $1`,
    [start, end],
  );
  const leaveMap = new Map<string, { unpaid: number; other: number }>();
  for (const r of leaveRes.rows) {
    const days = overlapDays(new Date(r.from_date), new Date(r.to_date), start, end);
    if (days <= 0) continue;
    const key = String(r.user_id);
    const acc = leaveMap.get(key) || { unpaid: 0, other: 0 };
    if (String(r.leave_type) === "Unpaid") acc.unpaid += days;
    else acc.other += days;
    leaveMap.set(key, acc);
  }

  // Approved overtime minutes (informational; no rate -> overtimeAmount 0).
  let otRes = { rows: [] as any[] };
  try {
    otRes = await pool.query(
      `SELECT user_id, COALESCE(SUM(time_spent),0) AS minutes
         FROM drm.overtime_records
        WHERE status = 'Approved' AND date >= $1 AND date <= $2
        GROUP BY user_id`,
      [start, end],
    );
  } catch (err) {
    console.warn("[salary] overtime query skipped due to schema drift:", (err as Error).message);
  }
  const otMap = new Map<string, number>();
  for (const r of otRes.rows) otMap.set(String(r.user_id), Number(r.minutes || 0));

  // Approved, non-voided penalties in the period (penalties.employee_id is uuid).
  const penRes = await pool.query(
    `SELECT employee_id, COALESCE(SUM(amount),0) AS total
       FROM drm.penalties
      WHERE approval_status = 'APPROVED'
        AND COALESCE(status,'ACTIVE') <> 'VOIDED'
        AND deleted_at IS NULL
        AND penalty_date >= $1 AND penalty_date <= $2
      GROUP BY employee_id`,
    [start, end],
  );
  const penMap = new Map<string, number>();
  for (const r of penRes.rows) penMap.set(String(r.employee_id), Number(r.total || 0));

  // Approved bonuses for the pay period (drm.employee_bonuses; user_id is uuid).
  const bonusRes = await pool.query(
    `SELECT user_id, COALESCE(SUM(amount),0) AS total
       FROM drm.employee_bonuses
      WHERE status = 'APPROVED'
        AND period_month = $1 AND period_year = $2
      GROUP BY user_id`,
    [month, year],
  );
  const bonusMap = new Map<string, number>();
  for (const r of bonusRes.rows) bonusMap.set(String(r.user_id), Number(r.total || 0));

  // Outstanding loan instalments from active loans (loan_requests.user_id is
  // varchar = users.id::text). A loan is active once HOD-approved with a balance
  // remaining; the month's deduction is the instalment, capped at the balance.
  const loanRes = await pool.query(
    `SELECT user_id,
            COALESCE(SUM(LEAST(installment_amount, remaining_amount)),0) AS total
       FROM drm.loan_requests
      WHERE status = 'HODApproved' AND remaining_amount > 0
      GROUP BY user_id`,
  );
  const loanMap = new Map<string, number>();
  for (const r of loanRes.rows) loanMap.set(String(r.user_id), Number(r.total || 0));

  return usersRes.rows.map((u: any) => {
    const id = String(u.id);
    const basicSalary = round2(toNum(u.basic_salary));
    const perDaySalary = round2(basicSalary / 30);
    const att = attMap.get(id) || { present: 0, absent: 0 };
    const lv = leaveMap.get(id) || { unpaid: 0, other: 0 };
    const overtimeMinutes = otMap.get(id) || 0;
    const penaltyAmount = round2(penMap.get(id) || 0);

    // Real source values for the three now-authoritative fields.
    const allowanceSource = round2(
      toNum(u.daily_allowance) + toNum(u.mobile_allowance) +
      toNum(u.admin_allowance) + toNum(u.conveyance_allowance),
    );
    const bonusSource = round2(bonusMap.get(id) || 0);
    const loanSource = round2(loanMap.get(id) || 0);

    // Source value is the default; a supplied manual adjustment overrides it.
    const m = manual[id] || {};
    const {
      allowanceAmount, bonusAmount, overtimeAmount, loanDeduction, otherDeductions,
      lateDeduction, unpaidLeaveDeduction, absenceDeduction,
      grossSalary, totalDeductions, netSalary, payableSalary,
    } = computeSalaryLine({
      basicSalary,
      daysAbsent: att.absent,
      unpaidLeaveDays: lv.unpaid,
      penaltyAmount,
      // Source value is the default; a supplied manual adjustment overrides it.
      allowanceAmount: m.allowanceAmount !== undefined ? m.allowanceAmount : allowanceSource,
      bonusAmount: m.bonusAmount !== undefined ? m.bonusAmount : bonusSource,
      overtimeAmount: m.overtimeAmount, // no rate policy -> manual only
      loanDeduction: m.loanDeduction !== undefined ? m.loanDeduction : loanSource,
      otherDeductions: m.otherDeductions,
    });

    const lateMinutes = 0; // no late-minutes source column

    return {
      userId: id,
      employeeName: u.name || "",
      department: u.department ?? null,
      branch: u.branch ?? null,
      basicSalary,
      perDaySalary,
      daysPresent: att.present,
      daysAbsent: att.absent,
      leaveDays: lv.other,
      unpaidLeaveDays: lv.unpaid,
      lateMinutes,
      overtimeMinutes,
      allowanceAmount,
      bonusAmount,
      overtimeAmount,
      grossSalary,
      unpaidLeaveDeduction,
      absenceDeduction,
      lateDeduction,
      penaltyAmount,
      loanDeduction,
      otherDeductions,
      totalDeductions,
      netSalary,
      payableSalary,
      calculationSnapshot: {
        period: { month, year },
        inputs: {
          basicSalary, perDaySalary,
          daysPresent: att.present, daysAbsent: att.absent,
          leaveDays: lv.other, unpaidLeaveDays: lv.unpaid,
          overtimeMinutes, penaltyAmount,
          allowanceAmount, bonusAmount, overtimeAmount, loanDeduction, otherDeductions,
        },
        outputs: {
          grossSalary, unpaidLeaveDeduction, absenceDeduction, lateDeduction,
          totalDeductions, netSalary, payableSalary,
        },
        assumptions: {
          perDayBasis: "basicSalary/30",
          lateDeduction: "0 (no late-penalty policy)",
          overtimeAmount: "0 (no overtime-rate policy; minutes informational)",
          allowance: "users fixed allowance columns (manual override allowed)",
          bonus: "approved employee_bonuses for the period (manual override allowed)",
          loanDeduction: "outstanding instalment on active loan_requests (manual override allowed)",
        },
        sources: {
          allowanceSource, bonusSource, loanSource,
          allowanceOverridden: m.allowanceAmount !== undefined,
          bonusOverridden: m.bonusAmount !== undefined,
          loanOverridden: m.loanDeduction !== undefined,
        },
        computedAt: new Date().toISOString(),
      },
    };
  });
}

function sumTotals(items: PreviewItem[]) {
  return items.reduce(
    (a, it) => {
      a.gross += it.grossSalary;
      a.ded += it.totalDeductions;
      a.net += it.netSalary;
      a.payable += it.payableSalary;
      return a;
    },
    { gross: 0, ded: 0, net: 0, payable: 0 },
  );
}

// Returns names of employees who already have a FINALIZED/LOCKED salary line for
// the period (optionally excluding one run). Empty array => no conflict.
async function finalizedConflicts(
  month: number,
  year: number,
  userIds: string[],
  excludeRunId?: string,
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const params: any[] = [month, year, userIds];
  let exclude = "";
  if (excludeRunId) { params.push(excludeRunId); exclude = `AND sr.id <> $${params.length}`; }
  const r = await pool.query(
    `SELECT DISTINCT sri.employee_name
       FROM drm.salary_run_items sri
       JOIN drm.salary_runs sr ON sr.id = sri.run_id
      WHERE sr.status IN ('FINALIZED','LOCKED')
        AND sr.deleted_at IS NULL
        AND sr.period_month = $1 AND sr.period_year = $2
        AND sri.user_id = ANY($3) ${exclude}`,
    params,
  );
  return r.rows.map((x: any) => x.employee_name).filter(Boolean);
}

// Phase 13 — blocks creating a new run for an employee+period that already
// has ANY non-cancelled run in progress (DRAFT/GENERATED/APPROVED).
// Complements finalizedConflicts() above, which only catches the
// FINALIZED/LOCKED case — two DRAFT/GENERATED runs for the same
// employee+period could otherwise coexist indefinitely.
async function activeRunConflicts(
  month: number,
  year: number,
  userIds: string[],
  excludeRunId?: string,
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const params: any[] = [month, year, userIds];
  let exclude = "";
  if (excludeRunId) { params.push(excludeRunId); exclude = `AND sr.id <> $${params.length}`; }
  const r = await pool.query(
    `SELECT DISTINCT sri.employee_name
       FROM drm.salary_run_items sri
       JOIN drm.salary_runs sr ON sr.id = sri.run_id
      WHERE sr.status IN ('DRAFT','GENERATED','APPROVED')
        AND sr.deleted_at IS NULL
        AND sr.period_month = $1 AND sr.period_year = $2
        AND sri.user_id = ANY($3) ${exclude}`,
    params,
  );
  return r.rows.map((x: any) => x.employee_name).filter(Boolean);
}

export const LOCKED_STATUSES = new Set(["FINALIZED", "LOCKED"]);
export const ALLOWED_NEXT: Record<string, string[]> = {
  DRAFT: ["GENERATED", "CANCELLED"],
  GENERATED: ["APPROVED", "CANCELLED"],
  APPROVED: ["FINALIZED", "CANCELLED"],
  FINALIZED: [],
  LOCKED: [],
  CANCELLED: [],
};
export const STATUS_ACTION: Record<string, SalaryAction> = {
  GENERATED: "generate",
  APPROVED: "approve",
  FINALIZED: "finalize",
  CANCELLED: "cancel",
};

export function registerSalaryRoutes(app: Express) {
  // GET /api/salary/preview — live computed lines, not persisted.
  app.get("/api/salary/preview", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!can(req, "preview")) return deny(res, "preview");
      const period = parsePeriod(req);
      if (!period) return res.status(400).json({ error: "Valid month (1-12) and year are required" });

      const items = await computePreview(period.month, period.year, {
        branch: (req.query.branch as string) || undefined,
        department: (req.query.department as string) || undefined,
        userId: (req.query.employeeId as string) || (req.query.userId as string) || undefined,
      });

      // Surface employees who would block a later FINALIZE so the UI can warn.
      const conflicts = await finalizedConflicts(
        period.month, period.year, items.map((i) => i.userId),
      );
      const t = sumTotals(items);
      res.json({
        period,
        items,
        totals: {
          totalGross: round2(t.gross),
          totalDeductions: round2(t.ded),
          totalNet: round2(t.net),
          totalPayable: round2(t.payable),
        },
        employeeCount: items.length,
        finalizedConflicts: conflicts,
      });
    } catch (err) {
      console.error("Error computing salary preview:", err);
      res.status(500).json({ error: "Failed to compute salary preview" });
    }
  });

  // POST /api/salary/runs — persist a run (DRAFT or GENERATED) with full lines.
  app.post("/api/salary/runs", async (req: Request, res: Response) => {
    const client = await pool.connect();
    let began = false;
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!can(req, "generate")) { return deny(res, "create"); }
      const period = parsePeriod(req);
      if (!period) { return res.status(400).json({ error: "Valid month (1-12) and year are required" }); }

      const mode = String(req.body?.mode || "DRAFT").toUpperCase();
      if (mode !== "DRAFT" && mode !== "GENERATED") {
        return res.status(400).json({ error: "mode must be DRAFT or GENERATED" });
      }
      const branch = (req.body?.branch as string) || null;
      const department = (req.body?.department as string) || null;
      const employeeId = (req.body?.employeeId as string) || undefined;
      const remarks = (req.body?.remarks as string) || (req.body?.notes as string) || null;

      // Validate + normalize manual adjustments keyed by userId.
      const rawAdj = (req.body?.manualAdjustments ?? {}) as Record<string, any>;
      const manual: Record<string, ManualAdj> = {};
      for (const [uid, adj] of Object.entries(rawAdj || {})) {
        const fields: (keyof ManualAdj)[] = [
          "bonusAmount", "allowanceAmount", "overtimeAmount", "loanDeduction", "otherDeductions",
        ];
        const parsed: ManualAdj = {};
        for (const f of fields) {
          const v = parseOptionalMoney((adj as any)?.[f]);
          if (v === null) { return res.status(400).json({ error: `Invalid numeric value for ${f}` }); }
          if (v !== undefined) (parsed as any)[f] = v; // omit -> source default is used
        }
        if ((adj as any)?.remarks != null) parsed.remarks = String((adj as any).remarks).slice(0, 1000);
        manual[uid] = parsed;
      }

      const items = await computePreview(period.month, period.year,
        { branch: branch || undefined, department: department || undefined, userId: employeeId }, manual);
      if (items.length === 0) { return res.status(400).json({ error: "No active employees match this period/scope" }); }

      // Duplicate-FINALIZED guard (cannot create lines that already have a
      // finalized salary for the same employee + month + year).
      const conflicts = await finalizedConflicts(period.month, period.year, items.map((i) => i.userId));
      if (conflicts.length > 0) {
        return res.status(409).json({
          error: "A finalized salary already exists for some employees in this period",
          employees: conflicts,
        });
      }

      // Phase 13 — duplicate-in-progress guard (cannot create a second
      // DRAFT/GENERATED/APPROVED run for an employee already covered by one).
      const activeConflicts = await activeRunConflicts(period.month, period.year, items.map((i) => i.userId));
      if (activeConflicts.length > 0) {
        return res.status(409).json({
          error: "A salary run already exists (in progress) for some employees in this period",
          employees: activeConflicts,
        });
      }

      const t = sumTotals(items);
      await client.query("BEGIN"); began = true;
      const genCols = mode === "GENERATED" ? `, generated_by, generated_at` : "";
      const genVals = mode === "GENERATED" ? `, $11, now()` : "";
      const runParams: any[] = [
        period.month, period.year, branch, department, mode, remarks,
        items.length, round2(t.gross), round2(t.ded), round2(t.net), req.user.userId,
      ];
      const runRes = await client.query(
        `INSERT INTO drm.salary_runs
           (period_month, period_year, branch, department, status, notes, remarks,
            employee_count, total_gross, total_deductions, total_net, created_by_user_id${genCols})
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11${genVals})
         RETURNING *`,
        runParams,
      );
      const run = runRes.rows[0];

      for (const it of items) {
        await client.query(
          `INSERT INTO drm.salary_run_items
             (run_id, user_id, employee_name, department, branch,
              basic_salary, gross_salary, per_day_salary, days_present, days_absent,
              leave_days, unpaid_leave_days, unpaid_leave_deduction, late_minutes, late_deduction,
              overtime_minutes, overtime_amount, allowance_amount, bonus_amount,
              absence_deduction, penalty_amount, loan_deduction, other_deductions,
              total_deductions, net_salary, payable_salary, payment_status, remarks, calculation_snapshot)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,'UNPAID',$27,$28)`,
          [
            run.id, it.userId, it.employeeName, it.department, it.branch,
            it.basicSalary, it.grossSalary, it.perDaySalary, it.daysPresent, it.daysAbsent,
            it.leaveDays, it.unpaidLeaveDays, it.unpaidLeaveDeduction, it.lateMinutes, it.lateDeduction,
            it.overtimeMinutes, it.overtimeAmount, it.allowanceAmount, it.bonusAmount,
            it.absenceDeduction, it.penaltyAmount, it.loanDeduction, it.otherDeductions,
            it.totalDeductions, it.netSalary, it.payableSalary,
            manual[it.userId]?.remarks ?? null, JSON.stringify(it.calculationSnapshot),
          ],
        );
      }
      await client.query("COMMIT"); began = false;

      await recordAuditLog({
        actorUserId: req.user.userId,
        action: mode === "GENERATED" ? "salary.generate" : "salary.create_draft",
        module: "salary",
        entityType: "salary_run",
        entityId: run.id,
        nextStatus: mode,
        after: { period, branch, department, employeeCount: items.length, totals: t },
        reason: remarks ?? undefined,
        req,
      });

      const itemsRes = await pool.query(
        `SELECT * FROM drm.salary_run_items WHERE run_id = $1 ORDER BY employee_name ASC`, [run.id],
      );
      res.status(201).json({ run, items: itemsRes.rows });
    } catch (err) {
      if (began) await client.query("ROLLBACK").catch(() => {});
      console.error("Error creating salary run:", err);
      res.status(500).json({ error: "Failed to create salary run" });
    } finally {
      client.release();
    }
  });

  // GET /api/salary/runs — list runs (filters + pagination + scope).
  app.get("/api/salary/runs", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!can(req, "view")) return deny(res, "view");
      const scope = await resolveScope(req);

      const where: string[] = ["sr.deleted_at IS NULL"];
      const params: any[] = [];
      if (req.query.month) { params.push(Number(req.query.month)); where.push(`sr.period_month = $${params.length}`); }
      if (req.query.year) { params.push(Number(req.query.year)); where.push(`sr.period_year = $${params.length}`); }
      if (req.query.status) { params.push(String(req.query.status).toUpperCase()); where.push(`sr.status = $${params.length}`); }
      if (req.query.branch) { params.push(String(req.query.branch)); where.push(`sr.branch = $${params.length}`); }
      if (req.query.department) { params.push(String(req.query.department)); where.push(`sr.department = $${params.length}`); }
      if (req.query.generatedBy) { params.push(String(req.query.generatedBy)); where.push(`(sr.generated_by = $${params.length} OR sr.created_by_user_id = $${params.length})`); }

      if (scope.kind === "department") {
        if (!scope.department) return res.json({ runs: [], total: 0, page: 1, pageSize: 0 });
        params.push(scope.department);
        where.push(`(sr.department = $${params.length} OR EXISTS (SELECT 1 FROM drm.salary_run_items i WHERE i.run_id = sr.id AND i.department = $${params.length}))`);
      } else if (scope.kind === "self") {
        params.push(scope.userId);
        where.push(`EXISTS (SELECT 1 FROM drm.salary_run_items i WHERE i.run_id = sr.id AND i.user_id = $${params.length})`);
      }

      const clause = `WHERE ${where.join(" AND ")}`;
      let page = Number(req.query.page ?? 1); if (!Number.isInteger(page) || page < 1) page = 1;
      let pageSize = Number(req.query.pageSize ?? 50); if (!Number.isInteger(pageSize) || pageSize < 1) pageSize = 50; if (pageSize > 200) pageSize = 200;
      const offset = (page - 1) * pageSize;

      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM drm.salary_runs sr ${clause}`, params);
      const total = countRes.rows[0]?.total ?? 0;
      const runs = await pool.query(
        `SELECT sr.* FROM drm.salary_runs sr ${clause}
          ORDER BY sr.period_year DESC, sr.period_month DESC, sr.created_at DESC
          LIMIT ${pageSize} OFFSET ${offset}`,
        params,
      );
      res.json({ runs: runs.rows, total, page, pageSize });
    } catch (err) {
      console.error("Error listing salary runs:", err);
      res.status(500).json({ error: "Failed to list salary runs" });
    }
  });

  // GET /api/salary/runs/:id — run + items (scoped).
  app.get("/api/salary/runs/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!can(req, "view")) return deny(res, "view");
      const runRes = await pool.query(`SELECT * FROM drm.salary_runs WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
      if (runRes.rows.length === 0) return res.status(404).json({ error: "Salary run not found" });
      const run = runRes.rows[0];

      const scope = await resolveScope(req);
      const where: string[] = ["run_id = $1"];
      const params: any[] = [req.params.id];
      if (scope.kind === "department") {
        if (!scope.department) return res.status(403).json({ error: "Not authorized for this run" });
        params.push(scope.department); where.push(`department = $${params.length}`);
      } else if (scope.kind === "self") {
        params.push(scope.userId); where.push(`user_id = $${params.length}`);
      }
      const itemsRes = await pool.query(
        `SELECT * FROM drm.salary_run_items WHERE ${where.join(" AND ")} ORDER BY employee_name ASC`, params,
      );
      if (scope.kind !== "all" && itemsRes.rows.length === 0) {
        return res.status(403).json({ error: "Not authorized for this run" });
      }
      res.json({ run, items: itemsRes.rows });
    } catch (err) {
      console.error("Error fetching salary run:", err);
      res.status(500).json({ error: "Failed to fetch salary run" });
    }
  });

  // PATCH /api/salary/runs/:id/status — lifecycle transitions with locking + audit.
  app.patch("/api/salary/runs/:id/status", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const status = String(req.body?.status || "").toUpperCase();
      const reason = (req.body?.reason as string) || undefined;
      if (!Object.keys(STATUS_ACTION).includes(status)) {
        return res.status(400).json({ error: `status must be one of ${Object.keys(STATUS_ACTION).join(", ")}` });
      }
      const action = STATUS_ACTION[status];
      if (!can(req, action)) return deny(res, action);

      const existingRes = await pool.query(`SELECT * FROM drm.salary_runs WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
      if (existingRes.rows.length === 0) return res.status(404).json({ error: "Salary run not found" });
      const existing = existingRes.rows[0];
      const current = String(existing.status || "DRAFT").toUpperCase();

      if (LOCKED_STATUSES.has(current)) {
        return res.status(409).json({ error: "Finalized/locked salary runs cannot be modified" });
      }
      if (!(ALLOWED_NEXT[current] || []).includes(status)) {
        return res.status(409).json({ error: `Cannot move a ${current} run to ${status}` });
      }

      // HOD may only approve their own department's run.
      if (salaryClass(req) === "hod" && action === "approve") {
        const dept = await callerDepartment(req);
        if (!dept || existing.department !== dept) {
          return res.status(403).json({ error: "You can only approve salary for your own department" });
        }
      }

      // Re-check the duplicate-FINALIZED guard at finalize time.
      if (status === "FINALIZED") {
        const idsRes = await pool.query(`SELECT user_id FROM drm.salary_run_items WHERE run_id = $1`, [req.params.id]);
        const conflicts = await finalizedConflicts(
          existing.period_month, existing.period_year,
          idsRes.rows.map((r: any) => String(r.user_id)), req.params.id,
        );
        if (conflicts.length > 0) {
          return res.status(409).json({ error: "A finalized salary already exists for some employees in this period", employees: conflicts });
        }
      }

      const sets = ["status = $1", "updated_at = now()"];
      const params: any[] = [status, req.params.id];
      if (status === "APPROVED") { params.push(req.user.userId); sets.push(`approved_by_user_id = $${params.length}`, "approved_at = now()"); }
      if (status === "FINALIZED") { params.push(req.user.userId); sets.push(`finalized_by = $${params.length}`, "finalized_at = now()"); }
      const updated = await pool.query(
        `UPDATE drm.salary_runs SET ${sets.join(", ")} WHERE id = $2 RETURNING *`, params,
      );

      await recordAuditLog({
        actorUserId: req.user.userId,
        action: `salary.${action}`,
        module: "salary",
        entityType: "salary_run",
        entityId: req.params.id,
        previousStatus: current,
        nextStatus: status,
        reason,
        req,
      });
      res.json({ run: updated.rows[0] });
    } catch (err) {
      console.error("Error updating salary run status:", err);
      res.status(500).json({ error: "Failed to update salary run status" });
    }
  });

  // PATCH /api/salary/run-items/:id — edit allowed line items (DRAFT/GENERATED only).
  app.patch("/api/salary/run-items/:id", async (req: Request, res: Response) => {
    const client = await pool.connect();
    let began = false;
    try {
      if (!req.user) { return res.status(401).json({ error: "Not authenticated" }); }
      if (!can(req, "edit")) { return deny(res, "edit"); }

      const itemRes = await pool.query(`SELECT * FROM drm.salary_run_items WHERE id = $1`, [req.params.id]);
      if (itemRes.rows.length === 0) { return res.status(404).json({ error: "Salary line not found" }); }
      const item = itemRes.rows[0];
      const runRes = await pool.query(`SELECT * FROM drm.salary_runs WHERE id = $1 AND deleted_at IS NULL`, [item.run_id]);
      if (runRes.rows.length === 0) { return res.status(404).json({ error: "Salary run not found" }); }
      const run = runRes.rows[0];
      const runStatus = String(run.status || "DRAFT").toUpperCase();
      if (runStatus !== "DRAFT" && runStatus !== "GENERATED") {
        return res.status(409).json({ error: "Only DRAFT or GENERATED salary lines can be edited" });
      }

      // Only these fields are editable; everything else is computed.
      const editable: (keyof ManualAdj)[] = ["bonusAmount", "allowanceAmount", "overtimeAmount", "loanDeduction", "otherDeductions"];
      const next: Record<string, number> = {
        bonusAmount: toNum(item.bonus_amount),
        allowanceAmount: toNum(item.allowance_amount),
        overtimeAmount: toNum(item.overtime_amount),
        loanDeduction: toNum(item.loan_deduction),
        otherDeductions: toNum(item.other_deductions),
      };
      for (const f of editable) {
        if (req.body?.[f] !== undefined) {
          const v = parseManualMoney(req.body[f]);
          if (v === null) { return res.status(400).json({ error: `Invalid numeric value for ${f}` }); }
          next[f] = v;
        }
      }
      const remarks = req.body?.remarks != null ? String(req.body.remarks).slice(0, 1000) : item.remarks;

      const basic = toNum(item.basic_salary);
      const unpaidLeaveDeduction = toNum(item.unpaid_leave_deduction);
      const absenceDeduction = toNum(item.absence_deduction);
      const lateDeduction = toNum(item.late_deduction);
      const penaltyAmount = toNum(item.penalty_amount);

      const grossSalary = round2(basic + next.allowanceAmount + next.bonusAmount + next.overtimeAmount);
      const totalDeductions = round2(unpaidLeaveDeduction + absenceDeduction + lateDeduction + penaltyAmount + next.loanDeduction + next.otherDeductions);
      const netSalary = round2(grossSalary - totalDeductions);
      const payableSalary = round2(Math.max(0, netSalary));

      const snapshot = (item.calculation_snapshot && typeof item.calculation_snapshot === "object") ? item.calculation_snapshot : {};
      const newSnapshot = {
        ...snapshot,
        inputs: { ...(snapshot as any).inputs, ...next },
        outputs: { ...(snapshot as any).outputs, grossSalary, totalDeductions, netSalary, payableSalary },
        editedBy: req.user.userId,
        editedAt: new Date().toISOString(),
      };

      await client.query("BEGIN"); began = true;
      const updatedItem = await client.query(
        `UPDATE drm.salary_run_items
            SET bonus_amount = $1, allowance_amount = $2, overtime_amount = $3,
                loan_deduction = $4, other_deductions = $5, gross_salary = $6,
                total_deductions = $7, net_salary = $8, payable_salary = $9,
                remarks = $10, calculation_snapshot = $11
          WHERE id = $12 RETURNING *`,
        [next.bonusAmount, next.allowanceAmount, next.overtimeAmount, next.loanDeduction,
         next.otherDeductions, grossSalary, totalDeductions, netSalary, payableSalary,
         remarks, JSON.stringify(newSnapshot), req.params.id],
      );

      // Recompute parent-run totals from its lines.
      const totRes = await client.query(
        `SELECT COALESCE(SUM(gross_salary),0) g, COALESCE(SUM(total_deductions),0) d, COALESCE(SUM(net_salary),0) n
           FROM drm.salary_run_items WHERE run_id = $1`, [item.run_id],
      );
      await client.query(
        `UPDATE drm.salary_runs SET total_gross = $1, total_deductions = $2, total_net = $3, updated_at = now() WHERE id = $4`,
        [round2(toNum(totRes.rows[0].g)), round2(toNum(totRes.rows[0].d)), round2(toNum(totRes.rows[0].n)), item.run_id],
      );
      await client.query("COMMIT"); began = false;

      await recordAuditLog({
        actorUserId: req.user.userId,
        action: "salary.edit_item",
        module: "salary",
        entityType: "salary_run_item",
        entityId: req.params.id,
        before: {
          bonusAmount: toNum(item.bonus_amount), allowanceAmount: toNum(item.allowance_amount),
          overtimeAmount: toNum(item.overtime_amount), loanDeduction: toNum(item.loan_deduction),
          otherDeductions: toNum(item.other_deductions), netSalary: toNum(item.net_salary),
        },
        after: { ...next, grossSalary, totalDeductions, netSalary, payableSalary },
        req,
      });
      res.json({ item: updatedItem.rows[0] });
    } catch (err) {
      if (began) await client.query("ROLLBACK").catch(() => {});
      console.error("Error editing salary line:", err);
      res.status(500).json({ error: "Failed to edit salary line" });
    } finally {
      client.release();
    }
  });

  // PATCH /api/salary/run-items/:id/payment — mark a FINALIZED salary line
  // PAID/UNPAID (accounts/admin only). Audited as salary.mark_paid.
  app.patch("/api/salary/run-items/:id/payment", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!can(req, "mark_paid")) return deny(res, "mark salary as paid");

      const paymentStatus = String(req.body?.paymentStatus || "").toUpperCase();
      if (paymentStatus !== "PAID" && paymentStatus !== "UNPAID") {
        return res.status(400).json({ error: "paymentStatus must be PAID or UNPAID" });
      }

      const itemRes = await pool.query(`SELECT * FROM drm.salary_run_items WHERE id = $1`, [req.params.id]);
      if (itemRes.rows.length === 0) return res.status(404).json({ error: "Salary line not found" });
      const item = itemRes.rows[0];

      const runRes = await pool.query(`SELECT * FROM drm.salary_runs WHERE id = $1 AND deleted_at IS NULL`, [item.run_id]);
      if (runRes.rows.length === 0) return res.status(404).json({ error: "Salary run not found" });
      const run = runRes.rows[0];
      const runStatus = String(run.status || "DRAFT").toUpperCase();
      if (runStatus !== "FINALIZED") {
        return res.status(409).json({ error: "Only FINALIZED salary lines can be marked paid or unpaid" });
      }

      // Row-scoping. mark_paid is currently only granted to all-scope classes,
      // but enforce scope anyway so future role grants stay safe.
      const scope = await resolveScope(req);
      if (scope.kind === "department") {
        if (!scope.department || item.department !== scope.department) {
          return res.status(403).json({ error: "Not authorized for this salary line" });
        }
      } else if (scope.kind === "self") {
        if (String(item.user_id) !== String(scope.userId)) {
          return res.status(403).json({ error: "Not authorized for this salary line" });
        }
      }

      const reason = (req.body?.reason as string) || undefined;
      const previous = String(item.payment_status || "UNPAID").toUpperCase();
      if (previous === paymentStatus) {
        return res.json({ item });
      }

      const updated = paymentStatus === "PAID"
        ? await pool.query(
            `UPDATE drm.salary_run_items
               SET payment_status = $1, paid_by_user_id = $2, paid_at = now()
             WHERE id = $3 RETURNING *`,
            [paymentStatus, req.user.userId, req.params.id],
          )
        : await pool.query(
            `UPDATE drm.salary_run_items
               SET payment_status = $1, paid_by_user_id = NULL, paid_at = NULL
             WHERE id = $2 RETURNING *`,
            [paymentStatus, req.params.id],
          );

      await recordAuditLog({
        actorUserId: req.user.userId,
        action: "salary.mark_paid",
        module: "salary",
        entityType: "salary_run_item",
        entityId: req.params.id,
        before: { paymentStatus: previous },
        after: { paymentStatus },
        reason,
        req,
      });
      res.json({ item: updated.rows[0] });
    } catch (err) {
      console.error("Error updating salary payment status:", err);
      res.status(500).json({ error: "Failed to update salary payment status" });
    }
  });

  // PATCH /api/salary/runs/:id/payment — bulk mark every line of a FINALIZED
  // run PAID/UNPAID (accounts/admin only). Reuses the same can("mark_paid"),
  // scope, and FINALIZED-only guards as the per-line endpoint; each changed
  // line is audited as salary.mark_paid just like the single-line action.
  app.patch("/api/salary/runs/:id/payment", async (req: Request, res: Response) => {
    const client = await pool.connect();
    let began = false;
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!can(req, "mark_paid")) return deny(res, "mark salary as paid");

      const paymentStatus = String(req.body?.paymentStatus || "").toUpperCase();
      if (paymentStatus !== "PAID" && paymentStatus !== "UNPAID") {
        return res.status(400).json({ error: "paymentStatus must be PAID or UNPAID" });
      }

      const runRes = await client.query(`SELECT * FROM drm.salary_runs WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
      if (runRes.rows.length === 0) return res.status(404).json({ error: "Salary run not found" });
      const run = runRes.rows[0];
      const runStatus = String(run.status || "DRAFT").toUpperCase();
      if (runStatus !== "FINALIZED") {
        return res.status(409).json({ error: "Only FINALIZED salary runs can be marked paid or unpaid" });
      }

      // Row-scoping. mark_paid is currently only granted to all-scope classes,
      // but enforce scope anyway so future role grants stay safe. Only the lines
      // the caller is allowed to act on are affected.
      const scope = await resolveScope(req);
      const where: string[] = ["run_id = $1"];
      const params: any[] = [req.params.id];
      if (scope.kind === "department") {
        if (!scope.department) return res.status(403).json({ error: "Not authorized for this run" });
        params.push(scope.department); where.push(`department = $${params.length}`);
      } else if (scope.kind === "self") {
        params.push(scope.userId); where.push(`user_id = $${params.length}`);
      }

      const itemsRes = await client.query(
        `SELECT * FROM drm.salary_run_items WHERE ${where.join(" AND ")}`, params,
      );
      if (scope.kind !== "all" && itemsRes.rows.length === 0) {
        return res.status(403).json({ error: "Not authorized for this run" });
      }

      const reason = (req.body?.reason as string) || undefined;
      const toUpdate = itemsRes.rows.filter(
        (it: any) => String(it.payment_status || "UNPAID").toUpperCase() !== paymentStatus,
      );

      // All-or-nothing: every line update and its audit row land in one
      // transaction so a mid-run failure can't leave the run half-paid (and
      // leaves no orphan audit rows behind). Audit rows are written through the
      // same client (not recordAuditLog, which uses a separate connection) so
      // they roll back together with the line updates.
      await client.query("BEGIN"); began = true;
      for (const it of toUpdate) {
        const previous = String(it.payment_status || "UNPAID").toUpperCase();
        await client.query(
          `UPDATE drm.salary_run_items SET payment_status = $1 WHERE id = $2`,
          [paymentStatus, it.id],
        );
        const details = JSON.stringify({
          module: "salary",
          before: { paymentStatus: previous },
          after: { paymentStatus },
          ...(reason !== undefined ? { reason } : {}),
          ...(auditIp(req) !== undefined ? { ip: auditIp(req) } : {}),
          ...(req.headers["user-agent"] ? { userAgent: req.headers["user-agent"] } : {}),
        });
        await client.query(
          `INSERT INTO drm.activity_logs (user_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.user.userId, "salary.mark_paid", "salary_run_item", String(it.id), details],
        );
      }
      await client.query("COMMIT"); began = false;

      res.json({ runId: req.params.id, paymentStatus, updated: toUpdate.length, total: itemsRes.rows.length });
    } catch (err) {
      if (began) await client.query("ROLLBACK").catch(() => {});
      console.error("Error bulk updating salary payment status:", err);
      res.status(500).json({ error: "Failed to bulk update salary payment status" });
    } finally {
      client.release();
    }
  });

  // -------------------------------------------------------------------------
  // Employee bonuses (drm.employee_bonuses) — the authoritative source the
  // salary preview reads APPROVED rows from. CRUD here lets HR/accounts populate
  // and approve bonuses without raw SQL. Lifecycle: PENDING -> APPROVED/REJECTED
  // with approver + timestamp recorded; only PENDING rows are editable/deletable.
  // -------------------------------------------------------------------------

  // GET /api/salary/bonuses — list bonuses (filters: month, year, status, employeeId).
  app.get("/api/salary/bonuses", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canBonus(req)) return deny(res, "manage bonuses for");

      const where: string[] = [];
      const params: any[] = [];
      if (req.query.month) { params.push(Number(req.query.month)); where.push(`b.period_month = $${params.length}`); }
      if (req.query.year) { params.push(Number(req.query.year)); where.push(`b.period_year = $${params.length}`); }
      if (req.query.status) { params.push(String(req.query.status).toUpperCase()); where.push(`b.status = $${params.length}`); }
      if (req.query.employeeId) { params.push(String(req.query.employeeId)); where.push(`b.user_id = $${params.length}`); }
      const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

      const rows = await pool.query(
        `SELECT b.*,
                COALESCE(eu.full_name, eu.name, eu.username) AS employee_name,
                eu.department AS employee_department, eu.branch AS employee_branch,
                COALESCE(au.full_name, au.name, au.username) AS approved_by_name,
                COALESCE(cu.full_name, cu.name, cu.username) AS created_by_name
           FROM drm.employee_bonuses b
           LEFT JOIN drm.users eu ON eu.id = b.user_id
           LEFT JOIN drm.users au ON au.id = b.approved_by_user_id
           LEFT JOIN drm.users cu ON cu.id = b.created_by_user_id
           ${whereSql}
          ORDER BY b.created_at DESC`,
        params,
      );
      res.json({ bonuses: rows.rows });
    } catch (err) {
      console.error("Error listing employee bonuses:", err);
      res.status(500).json({ error: "Failed to list employee bonuses" });
    }
  });

  // POST /api/salary/bonuses — create a PENDING bonus.
  app.post("/api/salary/bonuses", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canBonus(req)) return deny(res, "create bonuses for");

      const userId = String(req.body?.userId ?? req.body?.employeeId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "employee (userId) is required" });
      const period = parsePeriod(req);
      if (!period) return res.status(400).json({ error: "Valid month (1-12) and year are required" });
      const amount = parseManualMoney(req.body?.amount);
      if (amount === null) return res.status(400).json({ error: "amount must be a number >= 0" });
      const reason = req.body?.reason != null ? String(req.body.reason).slice(0, 1000) : null;

      const userRes = await pool.query(`SELECT id FROM drm.users WHERE id = $1`, [userId]);
      if (userRes.rows.length === 0) return res.status(404).json({ error: "Employee not found" });

      const inserted = await pool.query(
        `INSERT INTO drm.employee_bonuses
           (user_id, period_month, period_year, amount, reason, status, created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,'PENDING',$6)
         RETURNING *`,
        [userId, period.month, period.year, amount, reason, req.user.userId],
      );
      const bonus = inserted.rows[0];

      await recordAuditLog({
        actorUserId: req.user.userId,
        action: "salary.bonus.create",
        module: "salary",
        entityType: "employee_bonus",
        entityId: bonus.id,
        nextStatus: "PENDING",
        after: { userId, period, amount, reason },
        reason: reason ?? undefined,
        req,
      });
      res.status(201).json({ bonus });
    } catch (err) {
      console.error("Error creating employee bonus:", err);
      res.status(500).json({ error: "Failed to create employee bonus" });
    }
  });

  // PATCH /api/salary/bonuses/:id — edit a PENDING bonus (amount/reason/period/employee).
  app.patch("/api/salary/bonuses/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canBonus(req)) return deny(res, "edit bonuses for");

      const existingRes = await pool.query(`SELECT * FROM drm.employee_bonuses WHERE id = $1`, [req.params.id]);
      if (existingRes.rows.length === 0) return res.status(404).json({ error: "Bonus not found" });
      const existing = existingRes.rows[0];
      if (String(existing.status).toUpperCase() !== "PENDING") {
        return res.status(409).json({ error: "Only PENDING bonuses can be edited" });
      }

      const sets: string[] = [];
      const params: any[] = [];
      const after: Record<string, unknown> = {};

      if (req.body?.userId !== undefined || req.body?.employeeId !== undefined) {
        const userId = String(req.body?.userId ?? req.body?.employeeId ?? "").trim();
        if (!userId) return res.status(400).json({ error: "employee (userId) cannot be empty" });
        const userRes = await pool.query(`SELECT id FROM drm.users WHERE id = $1`, [userId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: "Employee not found" });
        params.push(userId); sets.push(`user_id = $${params.length}`); after.userId = userId;
      }
      if (req.body?.month !== undefined || req.body?.year !== undefined) {
        const month = Number(req.body?.month ?? existing.period_month);
        const year = Number(req.body?.year ?? existing.period_year);
        if (!Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ error: "Valid month (1-12) is required" });
        if (!Number.isInteger(year) || year < 2000 || year > 2100) return res.status(400).json({ error: "Valid year is required" });
        params.push(month); sets.push(`period_month = $${params.length}`);
        params.push(year); sets.push(`period_year = $${params.length}`);
        after.period = { month, year };
      }
      if (req.body?.amount !== undefined) {
        const amount = parseManualMoney(req.body.amount);
        if (amount === null) return res.status(400).json({ error: "amount must be a number >= 0" });
        params.push(amount); sets.push(`amount = $${params.length}`); after.amount = amount;
      }
      if (req.body?.reason !== undefined) {
        const reason = req.body.reason != null ? String(req.body.reason).slice(0, 1000) : null;
        params.push(reason); sets.push(`reason = $${params.length}`); after.reason = reason;
      }

      if (sets.length === 0) return res.status(400).json({ error: "No editable fields supplied" });
      sets.push("updated_at = now()");
      params.push(req.params.id);
      const updated = await pool.query(
        `UPDATE drm.employee_bonuses SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
        params,
      );

      await recordAuditLog({
        actorUserId: req.user.userId,
        action: "salary.bonus.edit",
        module: "salary",
        entityType: "employee_bonus",
        entityId: req.params.id,
        before: {
          userId: existing.user_id, period: { month: existing.period_month, year: existing.period_year },
          amount: toNum(existing.amount), reason: existing.reason,
        },
        after,
        req,
      });
      res.json({ bonus: updated.rows[0] });
    } catch (err) {
      console.error("Error editing employee bonus:", err);
      res.status(500).json({ error: "Failed to edit employee bonus" });
    }
  });

  // PATCH /api/salary/bonuses/:id/status — approve or reject a PENDING bonus.
  app.patch("/api/salary/bonuses/:id/status", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canBonus(req)) return deny(res, "approve bonuses for");

      const status = String(req.body?.status || "").toUpperCase();
      if (status !== "APPROVED" && status !== "REJECTED") {
        return res.status(400).json({ error: "status must be APPROVED or REJECTED" });
      }
      const reason = req.body?.reason != null ? String(req.body.reason).slice(0, 1000) : undefined;

      const existingRes = await pool.query(`SELECT * FROM drm.employee_bonuses WHERE id = $1`, [req.params.id]);
      if (existingRes.rows.length === 0) return res.status(404).json({ error: "Bonus not found" });
      const existing = existingRes.rows[0];
      const current = String(existing.status).toUpperCase();
      if (current !== "PENDING") {
        return res.status(409).json({ error: `Cannot ${status.toLowerCase()} a ${current} bonus` });
      }

      const updated = await pool.query(
        `UPDATE drm.employee_bonuses
            SET status = $1, approved_by_user_id = $2, approved_at = now(), updated_at = now()
          WHERE id = $3 RETURNING *`,
        [status, req.user.userId, req.params.id],
      );

      await recordAuditLog({
        actorUserId: req.user.userId,
        action: status === "APPROVED" ? "salary.bonus.approve" : "salary.bonus.reject",
        module: "salary",
        entityType: "employee_bonus",
        entityId: req.params.id,
        previousStatus: current,
        nextStatus: status,
        reason,
        req,
      });
      res.json({ bonus: updated.rows[0] });
    } catch (err) {
      console.error("Error updating employee bonus status:", err);
      res.status(500).json({ error: "Failed to update employee bonus status" });
    }
  });

  // DELETE /api/salary/bonuses/:id — remove a PENDING bonus.
  app.delete("/api/salary/bonuses/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canBonus(req)) return deny(res, "delete bonuses for");

      const existingRes = await pool.query(`SELECT * FROM drm.employee_bonuses WHERE id = $1`, [req.params.id]);
      if (existingRes.rows.length === 0) return res.status(404).json({ error: "Bonus not found" });
      const existing = existingRes.rows[0];
      if (String(existing.status).toUpperCase() !== "PENDING") {
        return res.status(409).json({ error: "Only PENDING bonuses can be deleted" });
      }

      await pool.query(`DELETE FROM drm.employee_bonuses WHERE id = $1`, [req.params.id]);

      await recordAuditLog({
        actorUserId: req.user.userId,
        action: "salary.bonus.delete",
        module: "salary",
        entityType: "employee_bonus",
        entityId: req.params.id,
        before: {
          userId: existing.user_id, period: { month: existing.period_month, year: existing.period_year },
          amount: toNum(existing.amount), reason: existing.reason,
        },
        req,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting employee bonus:", err);
      res.status(500).json({ error: "Failed to delete employee bonus" });
    }
  });

  // GET /api/salary/runs/:id/payment-summary — scoped paid/unpaid line counts
  // for a FINALIZED run, so the UI can warn how many lines a bulk mark
  // paid/unpaid would change across the whole run (not just the visible page).
  // Reuses the same can("mark_paid"), scope and FINALIZED-only guards as the
  // bulk endpoint so the count reflects exactly what that action would touch.
  app.get("/api/salary/runs/:id/payment-summary", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!can(req, "mark_paid")) return deny(res, "mark salary as paid");

      const runRes = await pool.query(`SELECT * FROM drm.salary_runs WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
      if (runRes.rows.length === 0) return res.status(404).json({ error: "Salary run not found" });
      const run = runRes.rows[0];
      const runStatus = String(run.status || "DRAFT").toUpperCase();
      if (runStatus !== "FINALIZED") {
        return res.status(409).json({ error: "Only FINALIZED salary runs can be marked paid or unpaid" });
      }

      const scope = await resolveScope(req);
      const where: string[] = ["run_id = $1"];
      const params: any[] = [req.params.id];
      if (scope.kind === "department") {
        if (!scope.department) return res.status(403).json({ error: "Not authorized for this run" });
        params.push(scope.department); where.push(`department = $${params.length}`);
      } else if (scope.kind === "self") {
        params.push(scope.userId); where.push(`user_id = $${params.length}`);
      }

      const itemsRes = await pool.query(
        `SELECT payment_status FROM drm.salary_run_items WHERE ${where.join(" AND ")}`, params,
      );
      if (scope.kind !== "all" && itemsRes.rows.length === 0) {
        return res.status(403).json({ error: "Not authorized for this run" });
      }

      let paid = 0;
      let unpaid = 0;
      for (const it of itemsRes.rows) {
        if (String(it.payment_status || "UNPAID").toUpperCase() === "PAID") paid += 1;
        else unpaid += 1;
      }
      res.json({ runId: req.params.id, paid, unpaid, total: itemsRes.rows.length });
    } catch (err) {
      console.error("Error fetching salary run payment summary:", err);
      res.status(500).json({ error: "Failed to fetch salary run payment summary" });
    }
  });

  registerSalaryReportRoutes(app);
}

// ---------------------------------------------------------------------------
// Report endpoints (compat path for the Salary Report screen). Registered here
// (salary routes are mounted BEFORE the reports catch-all) so /api/reports/salary
// wins over the parameterized /reports/:type route.
// ---------------------------------------------------------------------------

function buildReportFilters(req: Request, scope: Scope): { where: string; params: any[] } {
  const where: string[] = ["sr.deleted_at IS NULL"];
  const params: any[] = [];
  const add = (val: any, frag: (p: number) => string) => { params.push(val); where.push(frag(params.length)); };

  if (req.query.month) add(Number(req.query.month), (p) => `sr.period_month = $${p}`);
  if (req.query.year) add(Number(req.query.year), (p) => `sr.period_year = $${p}`);
  if (req.query.employeeId) add(String(req.query.employeeId), (p) => `sri.user_id = $${p}`);
  if (req.query.department) add(String(req.query.department), (p) => `sri.department = $${p}`);
  if (req.query.branch) add(String(req.query.branch), (p) => `sri.branch = $${p}`);
  if (req.query.status) add(String(req.query.status).toUpperCase(), (p) => `sr.status = $${p}`);
  if (req.query.paymentStatus) add(String(req.query.paymentStatus).toUpperCase(), (p) => `sri.payment_status = $${p}`);
  if (req.query.generatedBy) {
    params.push(String(req.query.generatedBy));
    where.push(`(sr.generated_by = $${params.length} OR sr.created_by_user_id = $${params.length})`);
  }
  if (req.query.search) add(`%${String(req.query.search)}%`, (p) => `sri.employee_name ILIKE $${p}`);

  if (scope.kind === "department") {
    if (!scope.department) { where.push("false"); }
    else add(scope.department, (p) => `sri.department = $${p}`);
  } else if (scope.kind === "self") {
    add(scope.userId, (p) => `sri.user_id = $${p}`);
  }
  return { where: `WHERE ${where.join(" AND ")}`, params };
}

const REPORT_COLUMNS = `
  sri.id, sri.user_id, sri.employee_name, sri.department, sri.branch,
  sri.basic_salary, sri.per_day_salary, sri.days_present, sri.days_absent,
  sri.leave_days, sri.unpaid_leave_days, sri.unpaid_leave_deduction,
  sri.late_minutes, sri.late_deduction, sri.overtime_minutes, sri.overtime_amount,
  sri.allowance_amount, sri.bonus_amount, sri.gross_salary,
  sri.absence_deduction, sri.penalty_amount, sri.loan_deduction, sri.other_deductions,
  sri.total_deductions, sri.net_salary, sri.payable_salary, sri.payment_status, sri.remarks,
  sri.paid_by_user_id, sri.paid_at,
  COALESCE(pu.full_name, pu.name, pu.username) AS paid_by_name,
  sr.id AS run_id, sr.period_month, sr.period_year, sr.status AS run_status,
  sr.generated_by, sr.created_by_user_id, sr.approved_at, sr.finalized_at`;

function registerSalaryReportRoutes(app: Express) {
  // GET /api/reports/salary — item-level report with filters, totals, pagination.
  app.get("/api/reports/salary", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!can(req, "view")) return deny(res, "view");
      const scope = await resolveScope(req);
      const { where, params } = buildReportFilters(req, scope);

      let page = Number(req.query.page ?? 1); if (!Number.isInteger(page) || page < 1) page = 1;
      let pageSize = Number(req.query.pageSize ?? 50); if (!Number.isInteger(pageSize) || pageSize < 1) pageSize = 50; if (pageSize > 200) pageSize = 200;
      const offset = (page - 1) * pageSize;

      const base = `FROM drm.salary_run_items sri JOIN drm.salary_runs sr ON sr.id = sri.run_id LEFT JOIN drm.users pu ON pu.id = sri.paid_by_user_id ${where}`;
      const countRes = await pool.query(`SELECT COUNT(*)::int AS total ${base}`, params);
      const total = countRes.rows[0]?.total ?? 0;
      const totalsRes = await pool.query(
        `SELECT COALESCE(SUM(sri.gross_salary),0) g, COALESCE(SUM(sri.total_deductions),0) d,
                COALESCE(SUM(sri.net_salary),0) n, COALESCE(SUM(sri.payable_salary),0) p ${base}`,
        params,
      );
      const rowsRes = await pool.query(
        `SELECT ${REPORT_COLUMNS} ${base} ORDER BY sr.period_year DESC, sr.period_month DESC, sri.employee_name ASC LIMIT ${pageSize} OFFSET ${offset}`,
        params,
      );
      const tt = totalsRes.rows[0];
      res.json({
        rows: rowsRes.rows, total, page, pageSize,
        totals: {
          totalGross: round2(toNum(tt.g)), totalDeductions: round2(toNum(tt.d)),
          totalNet: round2(toNum(tt.n)), totalPayable: round2(toNum(tt.p)),
        },
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
      if (!can(req, "export")) return deny(res, "export");
      const scope = await resolveScope(req);
      const { where, params } = buildReportFilters(req, scope);
      const rowsRes = await pool.query(
        `SELECT ${REPORT_COLUMNS}
           FROM drm.salary_run_items sri JOIN drm.salary_runs sr ON sr.id = sri.run_id
           LEFT JOIN drm.users pu ON pu.id = sri.paid_by_user_id
           ${where} ORDER BY sr.period_year DESC, sr.period_month DESC, sri.employee_name ASC LIMIT 10000`,
        params,
      );

      const header = [
        "Month", "Year", "Employee", "Department", "Branch", "Basic", "Per Day",
        "Present", "Absent", "Leave Days", "Unpaid Leave Days", "Allowance", "Bonus",
        "Overtime Mins", "Overtime Amt", "Gross", "Absence Ded", "Unpaid Leave Ded",
        "Penalty", "Loan", "Other Ded", "Total Deductions", "Net", "Payable",
        "Salary Status", "Payment Status", "Paid By", "Paid At",
      ];
      const csvCell = (v: unknown) => {
        if (v === null || v === undefined) return "";
        const s = v instanceof Date ? v.toISOString() : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [header.join(",")];
      for (const r of rowsRes.rows) {
        lines.push([
          r.period_month, r.period_year, r.employee_name, r.department, r.branch,
          r.basic_salary, r.per_day_salary, r.days_present, r.days_absent, r.leave_days,
          r.unpaid_leave_days, r.allowance_amount, r.bonus_amount, r.overtime_minutes,
          r.overtime_amount, r.gross_salary, r.absence_deduction, r.unpaid_leave_deduction,
          r.penalty_amount, r.loan_deduction, r.other_deductions, r.total_deductions,
          r.net_salary, r.payable_salary, r.run_status, r.payment_status,
          r.paid_by_name, r.paid_at,
        ].map(csvCell).join(","));
      }

      await recordAuditLog({
        actorUserId: req.user.userId, action: "salary.export", module: "salary",
        entityType: "salary_report", entityId: "export", after: { rows: rowsRes.rows.length }, req,
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${buildExportFilename("salary_report", {
          from: req.query.year
            ? `${req.query.year}${req.query.month ? `-${String(req.query.month).padStart(2, "0")}` : ""}`
            : undefined,
          branch: req.query.branch,
          user: req.query.employeeId ?? req.query.userId,
        })}"`,
      );
      res.send(lines.join("\n"));
    } catch (err) {
      console.error("Error exporting salary report:", err);
      res.status(500).json({ error: "Failed to export salary report" });
    }
  });
}
