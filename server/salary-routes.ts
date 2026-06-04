import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { normalizeRole } from "./utils/role-utils";

// Roles permitted to view/manage payroll. Salary is sensitive, so this is a
// deliberately narrow allow-list (does NOT expose to all authenticated users).
const SALARY_ROLES = new Set([
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

function canManageSalary(req: Request): boolean {
  const candidates: string[] = [];
  const u: any = req.user || {};
  if (u.roleId) candidates.push(String(u.roleId));
  if (u.role) candidates.push(String(u.role));
  if (Array.isArray(u.roles)) candidates.push(...u.roles.map(String));
  return candidates.some((r) => SALARY_ROLES.has(normalizeRole(r)));
}

function periodBounds(month: number, year: number) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999); // last day of month
  return { start, end };
}

interface PreviewItem {
  userId: string;
  employeeName: string;
  department: string | null;
  branch: string | null;
  grossSalary: number;
  perDaySalary: number;
  daysPresent: number;
  daysAbsent: number;
  absenceDeduction: number;
  otherDeductions: number;
  overtimeAmount: number;
  netSalary: number;
}

// Computes per-employee salary lines for a period from real data only:
//   gross   = users.basic_salary (0 when unset)
//   perDay  = gross / 30  (matches existing /api/attendance/salary convention)
//   absent  = attendance rows with status 'Absent' in the period
//   net     = gross - (absent * perDay) - otherDeductions + overtime
// Overtime/other deductions are 0 unless real source data exists (no rate
// configured in the system), so they are never fabricated.
async function computePreview(
  month: number,
  year: number,
  filters: { branch?: string; department?: string; userId?: string },
): Promise<PreviewItem[]> {
  const { start, end } = periodBounds(month, year);

  const where: string[] = ["u.is_active = true"];
  const params: any[] = [];
  if (filters.branch) {
    params.push(filters.branch);
    where.push(`u.branch = $${params.length}`);
  }
  if (filters.department) {
    params.push(filters.department);
    where.push(`u.department = $${params.length}`);
  }
  if (filters.userId) {
    params.push(filters.userId);
    where.push(`u.id = $${params.length}`);
  }

  const usersRes = await pool.query(
    `SELECT u.id, COALESCE(u.full_name, u.name, u.username) AS name,
            u.department, u.branch, u.basic_salary
     FROM drm.users u
     WHERE ${where.join(" AND ")}
     ORDER BY name ASC`,
    params,
  );

  const attRes = await pool.query(
    `SELECT user_id,
            COUNT(*) FILTER (WHERE status IN ('Present','Late')) AS present,
            COUNT(*) FILTER (WHERE status = 'Absent') AS absent
     FROM drm.attendance
     WHERE date >= $1 AND date <= $2
     GROUP BY user_id`,
    [start, end],
  );
  const attMap = new Map<string, { present: number; absent: number }>();
  for (const row of attRes.rows) {
    attMap.set(String(row.user_id), {
      present: Number(row.present || 0),
      absent: Number(row.absent || 0),
    });
  }

  return usersRes.rows.map((u: any) => {
    const gross = Number(u.basic_salary || 0);
    const perDay = gross / 30;
    const att = attMap.get(String(u.id)) || { present: 0, absent: 0 };
    const absenceDeduction = Math.round(att.absent * perDay * 100) / 100;
    const otherDeductions = 0;
    const overtimeAmount = 0;
    const net = Math.max(0, gross - absenceDeduction - otherDeductions + overtimeAmount);
    return {
      userId: String(u.id),
      employeeName: u.name || "",
      department: u.department ?? null,
      branch: u.branch ?? null,
      grossSalary: gross,
      perDaySalary: Math.round(perDay * 100) / 100,
      daysPresent: att.present,
      daysAbsent: att.absent,
      absenceDeduction,
      otherDeductions,
      overtimeAmount,
      netSalary: Math.round(net * 100) / 100,
    };
  });
}

function parsePeriod(req: Request): { month: number; year: number } | null {
  const month = Number(req.query.month ?? req.body?.month);
  const year = Number(req.query.year ?? req.body?.year);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return { month, year };
}

export function registerSalaryRoutes(app: Express) {
  // GET /api/salary/preview - live computed lines, not persisted
  app.get("/api/salary/preview", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canManageSalary(req)) return res.status(403).json({ error: "Not authorized for salary" });
      const period = parsePeriod(req);
      if (!period) return res.status(400).json({ error: "Valid month (1-12) and year are required" });

      const items = await computePreview(period.month, period.year, {
        branch: (req.query.branch as string) || undefined,
        department: (req.query.department as string) || undefined,
        userId: (req.query.userId as string) || undefined,
      });
      const totals = items.reduce(
        (acc, it) => {
          acc.totalGross += it.grossSalary;
          acc.totalDeductions += it.absenceDeduction + it.otherDeductions;
          acc.totalNet += it.netSalary;
          return acc;
        },
        { totalGross: 0, totalDeductions: 0, totalNet: 0 },
      );
      res.json({ period, items, totals, employeeCount: items.length });
    } catch (err) {
      console.error("Error computing salary preview:", err);
      res.status(500).json({ error: "Failed to compute salary preview" });
    }
  });

  // POST /api/salary/runs - persist a salary run (with duplicate-period guard)
  app.post("/api/salary/runs", async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canManageSalary(req)) return res.status(403).json({ error: "Not authorized for salary" });
      const period = parsePeriod(req);
      if (!period) return res.status(400).json({ error: "Valid month (1-12) and year are required" });

      const branch = (req.body?.branch as string) || null;
      const department = (req.body?.department as string) || null;
      const notes = (req.body?.notes as string) || null;

      // Duplicate-period guard: same month/year/branch/department not already present.
      const dup = await client.query(
        `SELECT id FROM drm.salary_runs
         WHERE period_month = $1 AND period_year = $2
           AND COALESCE(branch,'') = COALESCE($3,'')
           AND COALESCE(department,'') = COALESCE($4,'')
         LIMIT 1`,
        [period.month, period.year, branch, department],
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({
          error: "A salary run for this period and scope already exists",
          existingRunId: dup.rows[0].id,
        });
      }

      const items = await computePreview(period.month, period.year, {
        branch: branch || undefined,
        department: department || undefined,
      });
      const totals = items.reduce(
        (acc, it) => {
          acc.gross += it.grossSalary;
          acc.ded += it.absenceDeduction + it.otherDeductions;
          acc.net += it.netSalary;
          return acc;
        },
        { gross: 0, ded: 0, net: 0 },
      );

      await client.query("BEGIN");
      const runRes = await client.query(
        `INSERT INTO drm.salary_runs
           (period_month, period_year, branch, department, status, notes,
            employee_count, total_gross, total_deductions, total_net, created_by_user_id)
         VALUES ($1,$2,$3,$4,'DRAFT',$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          period.month, period.year, branch, department, notes,
          items.length, totals.gross, totals.ded, totals.net, req.user.userId,
        ],
      );
      const run = runRes.rows[0];
      for (const it of items) {
        await client.query(
          `INSERT INTO drm.salary_run_items
             (run_id, user_id, employee_name, department, branch, gross_salary,
              per_day_salary, days_present, days_absent, absence_deduction,
              other_deductions, overtime_amount, net_salary)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            run.id, it.userId, it.employeeName, it.department, it.branch,
            it.grossSalary, it.perDaySalary, it.daysPresent, it.daysAbsent,
            it.absenceDeduction, it.otherDeductions, it.overtimeAmount, it.netSalary,
          ],
        );
      }
      await client.query("COMMIT");
      res.status(201).json({ run, items });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Error creating salary run:", err);
      res.status(500).json({ error: "Failed to create salary run" });
    } finally {
      client.release();
    }
  });

  // GET /api/salary/runs - list runs
  app.get("/api/salary/runs", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canManageSalary(req)) return res.status(403).json({ error: "Not authorized for salary" });
      const where: string[] = [];
      const params: any[] = [];
      if (req.query.month) { params.push(Number(req.query.month)); where.push(`period_month = $${params.length}`); }
      if (req.query.year) { params.push(Number(req.query.year)); where.push(`period_year = $${params.length}`); }
      if (req.query.status) { params.push(String(req.query.status)); where.push(`status = $${params.length}`); }
      if (req.query.branch) { params.push(String(req.query.branch)); where.push(`branch = $${params.length}`); }
      if (req.query.department) { params.push(String(req.query.department)); where.push(`department = $${params.length}`); }
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
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

  // GET /api/salary/runs/:id - run + items
  app.get("/api/salary/runs/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canManageSalary(req)) return res.status(403).json({ error: "Not authorized for salary" });
      const runRes = await pool.query(`SELECT * FROM drm.salary_runs WHERE id = $1`, [req.params.id]);
      if (runRes.rows.length === 0) return res.status(404).json({ error: "Salary run not found" });
      const itemsRes = await pool.query(
        `SELECT * FROM drm.salary_run_items WHERE run_id = $1 ORDER BY employee_name ASC`,
        [req.params.id],
      );
      res.json({ run: runRes.rows[0], items: itemsRes.rows });
    } catch (err) {
      console.error("Error fetching salary run:", err);
      res.status(500).json({ error: "Failed to fetch salary run" });
    }
  });

  // PATCH /api/salary/runs/:id/status - DRAFT|FINALIZED|APPROVED|LOCKED
  app.patch("/api/salary/runs/:id/status", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canManageSalary(req)) return res.status(403).json({ error: "Not authorized for salary" });
      const status = String(req.body?.status || "").toUpperCase();
      const allowed = ["DRAFT", "FINALIZED", "APPROVED", "LOCKED"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: `status must be one of ${allowed.join(", ")}` });
      }
      const existing = await pool.query(`SELECT status FROM drm.salary_runs WHERE id = $1`, [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: "Salary run not found" });
      if (existing.rows[0].status === "LOCKED") {
        return res.status(409).json({ error: "Locked salary runs cannot be modified" });
      }
      const approvedCols = status === "APPROVED"
        ? `, approved_by_user_id = $3, approved_at = now()`
        : "";
      const params = status === "APPROVED"
        ? [status, req.params.id, req.user.userId]
        : [status, req.params.id];
      const updated = await pool.query(
        `UPDATE drm.salary_runs SET status = $1, updated_at = now()${approvedCols} WHERE id = $2 RETURNING *`,
        params,
      );
      res.json({ run: updated.rows[0] });
    } catch (err) {
      console.error("Error updating salary run status:", err);
      res.status(500).json({ error: "Failed to update salary run status" });
    }
  });
}
