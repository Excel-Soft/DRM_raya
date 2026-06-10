import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { normalizeRole, isManagerialRole } from "./utils/role-utils";
import { recordAuditLog } from "./services/activity-service";

// ---------------------------------------------------------------------------
// Permissions (Patch 2 Stage 4) — action-aware, role-based.
//
// Salary is sensitive. The previous flat allow-list is replaced by a class +
// per-action matrix, all compared on NORMALIZED role keys (normalizeRole
// collapses super_admin/administrator -> admin, accountant/accounts_office ->
// account_manager, etc). Row-level scoping ("own"/"department"/"all") is layered
// on top by resolveScope().
// ---------------------------------------------------------------------------

type SalaryAction =
  | "preview"
  | "generate"
  | "view"
  | "export"
  | "approve"
  | "finalize"
  | "edit"
  | "cancel";

type SalaryClass = "full" | "accounts" | "hr" | "hod" | "manager" | "executive";

// What each class may do. `full` (admin/super_hod) may do everything.
const CLASS_ACTIONS: Record<SalaryClass, Set<SalaryAction>> = {
  full: new Set<SalaryAction>([
    "preview", "generate", "view", "export", "approve", "finalize", "edit", "cancel",
  ]),
  accounts: new Set<SalaryAction>([
    "preview", "generate", "view", "export", "approve", "finalize", "edit", "cancel",
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

function salaryClass(req: Request): SalaryClass {
  const role = normalizeRole(callerRole(req));
  if (role === "admin" || role === "super_hod") return "full";
  if (role === "account_manager") return "accounts";
  if (role === "hr" || role === "hr_manager") return "hr";
  if (role === "hod") return "hod";
  if (isManagerialRole(role)) return "manager";
  return "executive";
}

function can(req: Request, action: SalaryAction): boolean {
  return CLASS_ACTIONS[salaryClass(req)].has(action);
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

// Validate a manual money input: must be a finite number >= 0. Returns the
// parsed number, or null when invalid (so the route can 400 honestly).
function parseManualMoney(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return 0;
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
//   loanDeduction          = 0  (no loan tables; manual field)
//   overtimeAmount         = 0  (no overtime rate; minutes informational, manual)
//   totalDeductions        = unpaidLeave + absence + late + penalty + loan + other
//   netSalary              = gross - totalDeductions
//   payableSalary          = max(0, netSalary)
// Values without a real source (allowance/bonus/loan/overtimeAmount/other) are
// 0 by default and only set via manual adjustments — never fabricated.
// ---------------------------------------------------------------------------

interface ManualAdj {
  bonusAmount?: number;
  allowanceAmount?: number;
  overtimeAmount?: number;
  loanDeduction?: number;
  otherDeductions?: number;
  remarks?: string | null;
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
            u.department, u.branch, u.basic_salary
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
    `SELECT user_id, leave_type, from_date, to_date
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
  const otRes = await pool.query(
    `SELECT user_id, COALESCE(SUM(time_spent),0) AS minutes
       FROM drm.overtime_records
      WHERE status = 'Approved' AND date >= $1 AND date <= $2
      GROUP BY user_id`,
    [start, end],
  );
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

  return usersRes.rows.map((u: any) => {
    const id = String(u.id);
    const basicSalary = round2(toNum(u.basic_salary));
    const perDaySalary = round2(basicSalary / 30);
    const att = attMap.get(id) || { present: 0, absent: 0 };
    const lv = leaveMap.get(id) || { unpaid: 0, other: 0 };
    const overtimeMinutes = otMap.get(id) || 0;
    const penaltyAmount = round2(penMap.get(id) || 0);

    const m = manual[id] || {};
    const allowanceAmount = round2(toNum(m.allowanceAmount));
    const bonusAmount = round2(toNum(m.bonusAmount));
    const overtimeAmount = round2(toNum(m.overtimeAmount)); // no rate policy -> manual only
    const loanDeduction = round2(toNum(m.loanDeduction));
    const otherDeductions = round2(toNum(m.otherDeductions));

    const lateMinutes = 0; // no late-minutes source column
    const lateDeduction = 0; // no late-penalty policy

    const unpaidLeaveDeduction = round2(lv.unpaid * perDaySalary);
    const absenceDeduction = round2(att.absent * perDaySalary);
    const grossSalary = round2(basicSalary + allowanceAmount + bonusAmount + overtimeAmount);
    const totalDeductions = round2(
      unpaidLeaveDeduction + absenceDeduction + lateDeduction + penaltyAmount + loanDeduction + otherDeductions,
    );
    const netSalary = round2(grossSalary - totalDeductions);
    const payableSalary = round2(Math.max(0, netSalary));

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
          loanDeduction: "manual (no loan tables)",
          allowanceBonus: "manual (no source tables)",
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

const LOCKED_STATUSES = new Set(["FINALIZED", "LOCKED"]);
const ALLOWED_NEXT: Record<string, string[]> = {
  DRAFT: ["GENERATED", "CANCELLED"],
  GENERATED: ["APPROVED", "CANCELLED"],
  APPROVED: ["FINALIZED", "CANCELLED"],
  FINALIZED: [],
  LOCKED: [],
  CANCELLED: [],
};
const STATUS_ACTION: Record<string, SalaryAction> = {
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
          const v = parseManualMoney((adj as any)?.[f]);
          if (v === null) { return res.status(400).json({ error: `Invalid numeric value for ${f}` }); }
          (parsed as any)[f] = v;
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

      const base = `FROM drm.salary_run_items sri JOIN drm.salary_runs sr ON sr.id = sri.run_id ${where}`;
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
           ${where} ORDER BY sr.period_year DESC, sr.period_month DESC, sri.employee_name ASC LIMIT 10000`,
        params,
      );

      const header = [
        "Month", "Year", "Employee", "Department", "Branch", "Basic", "Per Day",
        "Present", "Absent", "Leave Days", "Unpaid Leave Days", "Allowance", "Bonus",
        "Overtime Mins", "Overtime Amt", "Gross", "Absence Ded", "Unpaid Leave Ded",
        "Penalty", "Loan", "Other Ded", "Total Deductions", "Net", "Payable",
        "Salary Status", "Payment Status",
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
        ].map(csvCell).join(","));
      }

      await recordAuditLog({
        actorUserId: req.user.userId, action: "salary.export", module: "salary",
        entityType: "salary_report", entityId: "export", after: { rows: rowsRes.rows.length }, req,
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="salary_report.csv"`);
      res.send(lines.join("\n"));
    } catch (err) {
      console.error("Error exporting salary report:", err);
      res.status(500).json({ error: "Failed to export salary report" });
    }
  });
}
