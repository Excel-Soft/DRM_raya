// Old DRM "Salary Report" page (salaryreport.php + func.php handlers) on the
// copied data. Monthly salary slips = legacy_archive.webxl_tem_salary_ship (the
// copy is read-only; it was not copied into drm.salary_run_items), users =
// legacy_archive.webxl_user. Donations and penalties come from drm.donations /
// drm.penalties, which hold the copied old rows plus everything added in the
// new app.
//
//   GET    /api/reports/old-salary/months            months that have slips
//   GET    /api/reports/old-salary?month=YYYY-MM     all tabs of the old main view
//   GET    /api/reports/old-salary/view-report       old "View Report" (attendanceGander)
//   GET    /api/reports/old-salary/month-wise        old "View Month Wise"
//   DELETE /api/reports/old-salary/slips/:id         old delete = hide the copied slip
//                                                     (needs drm.legacy_salary_slip_hidden,
//                                                     scripts/migration/create-legacy-salary-slip-hidden.sql)
import type { Express, Request, Response } from "express";
import { pool } from "../db";
import { salaryClassForRole } from "./salary-routes";
import { recordAuditLog } from "../services/activity-service";

const HIDDEN_TABLE = "drm.legacy_salary_slip_hidden";

function callerRole(req: Request): string {
  const u = req.user as any;
  return String(u?.activeRoleId ?? u?.roleId ?? u?.role ?? "");
}
// The old page was an accounts page: admin / super HOD / accounts / HR.
function canView(req: Request): boolean {
  const cls = salaryClassForRole(callerRole(req));
  return cls === "full" || cls === "accounts" || cls === "hr";
}
function canDelete(req: Request): boolean {
  const cls = salaryClassForRole(callerRole(req));
  return cls === "full" || cls === "accounts";
}

/** PHP-style numeric value of a text column (leading number, else 0). */
function num(v: unknown): number {
  const m = String(v ?? "").match(/^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/);
  return m ? Number(m[1]) : 0;
}
/** PHP round(): half away from zero. */
function phpRound(v: number, p = 0): number {
  const f = 10 ** p;
  const s = Number((Math.abs(v) * f).toPrecision(15));
  return (Math.sign(v) * Math.round(s)) / f;
}

function monthBounds(ym: string): { start: string; next: string } {
  const [y, m] = ym.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: `${ym}-01`, next: `${next}-01` };
}
function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
function workedMonthParts(ym: string): { month: number; year: number } {
  const w = prevMonth(ym);
  const [year, month] = w.split("-").map(Number);
  return { month, year };
}
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

async function hiddenTableExists(): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [HIDDEN_TABLE]);
  return !!r.rows[0]?.ok;
}

const SLIP_COLUMNS = `
  s.id, s.user_id, s."grossSalary" AS gross_salary, s.present, s.leave, s."cuttingMin" AS cutting_min,
  s."pendingLeave" AS pending_leave, s.pendingleavesrupes AS pending_leaves_rupees, s.vas,
  s.commission3, s.alibaba, s."projectCommission" AS project_commission, s.pppcommission,
  s."postingCommission" AS posting_commission, s.overtimemin, s.overtimers, s.reward,
  s."basicCutting" AS basic_cutting, s.tcutting, s.penalty, s."totalSalary" AS total_salary,
  s.create_date, s.cus_paid_leave, s.cus_unpaid_leave, s.user_salary_status,
  u.name, u.att_id, u.gender, u.branch, u."netSalary" AS net_salary, m.modern_id`;

const SLIP_FROM = `
  FROM legacy_archive.webxl_tem_salary_ship s
  JOIN legacy_archive.webxl_user u ON u.user_id = s.user_id
  LEFT JOIN migration_meta.migration_legacy_ids m
         ON m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.legacy_id = u.user_id`;

// Old: users ordered by att_id (int; NULL first in MySQL ASC), ties in table
// (user_id) order, each user's slips in id order.
const USER_ORDER = `
  CASE WHEN u.att_id ~ '^-?[0-9]+$' THEN u.att_id::numeric END ASC NULLS FIRST,
  CASE WHEN u.user_id ~ '^[0-9]+$' THEN u.user_id::numeric END,
  CASE WHEN s.id ~ '^[0-9]+$' THEN s.id::numeric END`;

function slipRow(r: any, loanByUser: Map<string, number>) {
  const net = num(r.net_salary);
  const perDay = net / 30;
  const perMin = net / 30 / 8 / 60;
  const leave = num(r.leave);
  const cuttingMin = num(r.cutting_min);
  const leavesRs = phpRound(leave * perDay, 2);
  const cuttingMinRs = cuttingMin > 0 ? phpRound(cuttingMin * perMin, 2) : 0;
  const loan = loanByUser.get(String(r.user_id));
  return {
    id: String(r.id),
    userId: String(r.user_id),
    modernUserId: r.modern_id ?? null,
    attId: r.att_id ?? "",
    name: r.name ?? "",
    gender: r.gender ?? "",
    branch: r.branch ?? "",
    netSalary: r.net_salary ?? "",
    grossSalary: r.gross_salary ?? "",
    present: r.present ?? "",
    leave: r.leave ?? "",
    leavesRsLabel: `${leave} x ${phpRound(perDay, 2)} = ${leavesRs}`,
    leavesRs,
    cuttingMin: r.cutting_min ?? "",
    cuttingMinRsLabel: cuttingMin > 0 ? `${cuttingMin} x ${phpRound(perMin, 2)} = ${cuttingMinRs}` : "0",
    cuttingMinRs,
    pendingLeave: r.pending_leave ?? "",
    pendingLeavesRupees: r.pending_leaves_rupees ?? "",
    vas: r.vas ?? "",
    commission3: r.commission3 ?? "",
    alibaba: r.alibaba ?? "",
    projectCommission: r.project_commission ?? "",
    pppCommission: r.pppcommission ?? "",
    postingCommission: r.posting_commission ?? "",
    overtimeMin: r.overtimemin ?? "",
    overtimeRs: r.overtimers ?? "",
    reward: r.reward ?? "",
    penalty: r.penalty ?? "",
    loan: loan == null ? "" : String(loan),
    // Old page labels: "Cp Leave"/"Paid Leave" = cus_unpaid_leave,
    // "Cup Leave"/"Unpaid Leave" = cus_paid_leave (kept as the old page showed them).
    cusUnpaidLeave: r.cus_unpaid_leave ?? "",
    cusPaidLeave: r.cus_paid_leave ?? "",
    basicCutting: r.basic_cutting ?? "",
    tcutting: r.tcutting ?? "",
    totalSalaryRaw: r.total_salary ?? "",
    totalSalary: phpRound(num(r.total_salary), 0),
    createDate: r.create_date ?? "",
    salaryStatus: r.user_salary_status ?? "",
  };
}

type SlipRow = ReturnType<typeof slipRow>;
const sumTotal = (rows: SlipRow[]) => phpRound(rows.reduce((a, r) => a + num(r.totalSalaryRaw), 0), 0);

/** New-app salary runs for worked month M appear in the report month M+1 (slip create month). */
async function modernSlipDbRows(
  reportMonth: string,
  slipStart: string,
  slipEnd: string,
  hidden: boolean,
): Promise<any[]> {
  const { month, year } = workedMonthParts(reportMonth);
  const hiddenSlip = hidden
    ? `AND NOT EXISTS (SELECT 1 FROM ${HIDDEN_TABLE} h WHERE h.slip_id = s.id)`
    : "";
  const r = await pool.query(
    `SELECT ('sri-' || sri.id::text) AS id, m.legacy_id AS user_id, m.modern_id,
            coalesce(sri.calculation_snapshot->'slip', '{}'::jsonb) AS slip_json,
            sri.gross_salary, sri.net_salary, sri.loan_deduction,
            to_char(sri.created_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI:SS') AS create_date,
            u.name, u.att_id, u.gender, u.branch, u."netSalary" AS net_salary
       FROM drm.salary_run_items sri
       JOIN drm.salary_runs sr ON sr.id = sri.run_id
       JOIN migration_meta.migration_legacy_ids m
         ON m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.modern_id = sri.user_id::text
       JOIN legacy_archive.webxl_user u ON u.user_id = m.legacy_id
      WHERE sr.period_month = $1 AND sr.period_year = $2
        AND sr.deleted_at IS NULL AND sr.status <> 'CANCELLED'
        AND NOT EXISTS (
          SELECT 1 FROM legacy_archive.webxl_tem_salary_ship s
           WHERE s.user_id = m.legacy_id
             AND s.create_date >= $3 AND s.create_date < $4 ${hiddenSlip}
        )`,
    [month, year, slipStart, slipEnd],
  );
  return r.rows.map((row: any) => {
    const slip = row.slip_json ?? {};
    const str = (k: string, alt?: unknown) => String(slip[k] ?? alt ?? "");
    return {
      ...row,
      gross_salary: str("grossSalary", row.gross_salary),
      present: str("present"),
      leave: str("leave"),
      cutting_min: str("cuttingMin"),
      pending_leave: str("pendingLeave"),
      pending_leaves_rupees: str("pendingleavesrupes"),
      vas: str("vas"),
      commission3: str("commission3"),
      alibaba: str("alibaba"),
      project_commission: str("projectCommission"),
      pppcommission: str("pppcommission"),
      posting_commission: str("postingCommission"),
      overtimemin: str("overtimemin"),
      overtimers: str("overtimers"),
      reward: str("reward"),
      basic_cutting: str("basicCutting"),
      tcutting: str("tcutting"),
      penalty: str("penalty"),
      total_salary: str("totalSalary", row.net_salary),
      cus_paid_leave: str("cus_paid_leave"),
      cus_unpaid_leave: str("cus_unpaid_leave"),
      user_salary_status: str("user_salary_status"),
    };
  });
}

export function registerOldSalaryReportRoutes(app: Express) {
  app.get("/api/reports/old-salary/lookup", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canView(req)) return res.status(403).json({ error: "You are not authorized to view salary." });
      const month = String(req.query.month ?? "");
      const q = String(req.query.q ?? "").trim();
      if (!YM.test(month)) return res.status(400).json({ error: "month must be YYYY-MM" });
      if (q.length < 1) return res.json({ matches: [], workedMonth: prevMonth(month) });
      const { start, next } = monthBounds(month);
      const like = `%${q.replace(/[%_\\]/g, "")}%`;
      const users = await pool.query(
        `SELECT u.user_id, u.att_id, u.name, u.gender, u.branch
           FROM legacy_archive.webxl_user u
          WHERE u.att_id ILIKE $1 OR u.name ILIKE $1 OR u.user_id = $2
          ORDER BY CASE WHEN u.att_id ~ '^-?[0-9]+$' THEN u.att_id::numeric END NULLS LAST, u.name
          LIMIT 25`,
        [like, q],
      );
      const matches: any[] = [];
      for (const u of users.rows) {
        const inMonth = await pool.query(
          `SELECT 1 FROM legacy_archive.webxl_tem_salary_ship s
            WHERE s.user_id = $1 AND s.create_date >= $2 AND s.create_date < $3 LIMIT 1`,
          [u.user_id, start, next],
        );
        const last = await pool.query(
          `SELECT left(create_date, 7) AS ym FROM legacy_archive.webxl_tem_salary_ship
            WHERE user_id = $1 AND create_date ~ '^[0-9]{4}-[0-9]{2}'
            ORDER BY create_date DESC LIMIT 1`,
          [u.user_id],
        );
        matches.push({
          userId: String(u.user_id),
          attId: u.att_id ?? "",
          name: u.name ?? "",
          inSelectedMonth: inMonth.rows.length > 0,
          lastSlipMonth: last.rows[0]?.ym ?? null,
        });
      }
      res.json({
        query: q,
        selectedMonth: month,
        workedMonth: prevMonth(month),
        matches,
      });
    } catch (err) {
      console.error("[old-salary] lookup error:", err);
      res.status(500).json({ error: "Failed to look up employee" });
    }
  });

  app.get("/api/reports/old-salary/months", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canView(req)) return res.status(403).json({ error: "You are not authorized to view salary." });
      const r = await pool.query(
        `SELECT left(create_date, 7) AS month, count(*)::int AS slips
           FROM legacy_archive.webxl_tem_salary_ship
          WHERE create_date ~ '^[0-9]{4}-[0-9]{2}'
          GROUP BY 1 ORDER BY 1 DESC`,
      );
      const now = new Date();
      const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      res.json({ months: r.rows, current, latest: r.rows[0]?.month ?? current });
    } catch (err) {
      console.error("[old-salary] months error:", err);
      res.status(500).json({ error: "Failed to load salary months" });
    }
  });

  // Main view: every tab for one month (old = current month by create_date).
  app.get("/api/reports/old-salary", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canView(req)) return res.status(403).json({ error: "You are not authorized to view salary." });
      const month = String(req.query.month ?? "");
      if (!YM.test(month)) return res.status(400).json({ error: "month must be YYYY-MM" });
      const { start, next } = monthBounds(month);
      const hidden = await hiddenTableExists();
      const hiddenWhere = hidden
        ? `AND NOT EXISTS (SELECT 1 FROM ${HIDDEN_TABLE} h WHERE h.slip_id = s.id)`
        : "";

      const [slipsRes, loanRes, donRes, penRes] = await Promise.all([
        pool.query(
          `SELECT ${SLIP_COLUMNS} ${SLIP_FROM}
            WHERE s.create_date >= $1 AND s.create_date < $2 ${hiddenWhere}
            ORDER BY ${USER_ORDER}`,
          [start, next],
        ),
        // CountCurrentMonthLoanAmount(): SUM(webxl_pay_loan.pay) of the month.
        pool.query(
          `SELECT user_id, sum(CASE WHEN pay ~ '^\\s*-?[0-9]+(\\.[0-9]+)?' THEN substring(pay FROM '^\\s*(-?[0-9]+(?:\\.[0-9]+)?)')::numeric ELSE 0 END) AS total
             FROM legacy_archive.webxl_pay_loan
            WHERE pay_date >= $1 AND pay_date < $2
            GROUP BY user_id`,
          [start, next],
        ),
        // Donations: every donation (old rows were copied into drm.donations).
        pool.query(
          `SELECT d.id, d.person_name AS name, d.amount, d.comment AS detail,
                  to_char(d.created_at, 'YYYY-MM-DD') AS create_at, d.status
             FROM drm.donations d
            WHERE coalesce(lower(d.status), '') <> 'rejected'
            ORDER BY d.created_at, d.id`,
        ),
        // Penalties of the PREVIOUS month (old webxl_penalty rows were copied into
        // drm.penalties; new-app penalties are there too — no double counting).
        pool.query(
          `SELECT p.id::text AS id,
                  coalesce(nullif(trim(w.name), ''), nullif(trim(u.full_name), ''), u.username) AS name,
                  p.amount, p.penalty_head AS detail,
                  CASE WHEN m.legacy_id IS NOT NULL THEN to_char(p.created_at, 'YYYY-MM-DD HH24:MI:SS')
                       ELSE to_char(p.penalty_date, 'YYYY-MM-DD') END AS create_at,
                  (m.legacy_id IS NOT NULL) AS copied, p.approval_status
             FROM drm.penalties p
             JOIN drm.users u ON u.id = p.employee_id
             LEFT JOIN migration_meta.migration_legacy_ids m
                    ON m.legacy_table = 'webxl_penalty' AND m.modern_id = p.id::text
             LEFT JOIN migration_meta.migration_legacy_ids mu
                    ON mu.entity_type = 'user' AND mu.legacy_table = 'webxl_user' AND mu.modern_id = u.id::text
             LEFT JOIN legacy_archive.webxl_user w ON w.user_id = mu.legacy_id
            WHERE p.deleted_at IS NULL
              AND coalesce(p.status, 'ACTIVE') <> 'VOIDED'
              AND coalesce(p.approval_status, '') <> 'REJECTED'
              AND p.penalty_date >= $1::date AND p.penalty_date < $2::date
            ORDER BY p.penalty_date, p.created_at`,
          [`${prevMonth(month)}-01`, start],
        ),
      ]);

      const loanByUser = new Map<string, number>();
      for (const r of loanRes.rows) loanByUser.set(String(r.user_id), Number(r.total));
      const extraLegacy = await modernSlipDbRows(month, start, next, hidden);
      const rows = [...slipsRes.rows, ...extraLegacy].map((r: any) => slipRow(r, loanByUser));
      const isG = (r: SlipRow, g: string) => String(r.gender).trim().toLowerCase() === g;
      const male = rows.filter((r) => isG(r, "male"));
      const female = rows.filter((r) => isG(r, "female"));
      const lahore = (list: SlipRow[]) => list.filter((r) => String(r.branch).trim().toLowerCase() === "lahore");
      const lahoreMale = lahore(male);
      const lahoreFemale = lahore(female);

      const donations = donRes.rows.map((d: any) => ({ ...d, amount: Number(d.amount) }));
      const donationsTotal = phpRound(donations.reduce((a: number, d: any) => a + d.amount, 0), 2);
      const penalties = penRes.rows.map((p: any) => ({ ...p, amount: Number(p.amount) }));
      const penaltiesTotal = phpRound(penalties.reduce((a: number, p: any) => a + p.amount, 0), 2);

      // SalaryHeadAndBranch(Gender)(): SUM(totalSalary) of the month's slips by
      // user branch (and gender) — MySQL compares case-insensitively.
      const headSum = (branch: string, gender?: string) =>
        phpRound(
          rows
            .filter((r) => String(r.branch).trim().toLowerCase() === branch.toLowerCase())
            .filter((r) => !gender || String(r.gender).trim().toLowerCase() === gender.toLowerCase())
            .reduce((a, r) => a + num(r.totalSalaryRaw), 0),
          0,
        );
      const head = [
        { label: "Male Salary Sialkot", amount: headSum("Sialkot", "Male") },
        { label: "Female Salary Sialkot", amount: headSum("Sialkot", "Female") },
        { label: "Lahore Salary", amount: headSum("Lahore") },
        { label: "Karachi Salary", amount: headSum("Karachi") },
        { label: "Donations", amount: donationsTotal },
        { label: "Penalties", amount: penaltiesTotal },
      ];
      const headTotal = phpRound(head.reduce((a, h) => a + h.amount, 0), 2);

      res.json({
        month,
        workedMonth: prevMonth(month),
        penaltyMonth: prevMonth(month),
        deleteEnabled: hidden && canDelete(req),
        male: { rows: male, total: sumTotal(male) },
        female: { rows: female, total: sumTotal(female) },
        both: { rows: [...male, ...female], total: sumTotal([...male, ...female]) },
        onlySalary: { rows: [...male, ...female], total: sumTotal([...male, ...female]) },
        onlySalaryLahore: { rows: [...lahoreMale, ...lahoreFemale], total: sumTotal([...lahoreMale, ...lahoreFemale]) },
        donations: { rows: donations, total: donationsTotal },
        penalties: { rows: penalties, total: penaltiesTotal },
        monthlyHead: { rows: head, total: headTotal },
      });
    } catch (err) {
      console.error("[old-salary] report error:", err);
      res.status(500).json({ error: "Failed to load the old salary report" });
    }
  });

  // Old "View Report" (func.php attendanceGander). gender = All | Male | Female |
  // <new user id>; start/end = MM/YYYY (start 'All' = every slip of that user);
  // addCommission = 1 appends the user's approved webxl_vas_comm_final rows.
  app.get("/api/reports/old-salary/view-report", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canView(req)) return res.status(403).json({ error: "You are not authorized to view salary." });
      const gender = String(req.query.gender ?? "All");
      const startQ = String(req.query.start ?? "");
      const endQ = String(req.query.end ?? startQ);
      const addCommission = req.query.addCommission === "1" || req.query.addCommission === "true";
      const mmYyyy = /^(0?[1-9]|1[0-2])\/\d{4}$/;
      if (startQ !== "All" && (!mmYyyy.test(startQ) || !mmYyyy.test(endQ))) {
        return res.status(400).json({ error: "start/end must be MM/YYYY (or start=All)" });
      }
      const [sm, sy] = startQ === "All" ? ["", ""] : startQ.split("/");
      const [em, ey] = startQ === "All" ? ["", ""] : endQ.split("/");
      // Old: $start_date = Y-m-01, $end_date = Y-m-31 (compared to the datetime).
      const startDate = startQ === "All" ? "" : `${sy}-${sm.padStart(2, "0")}-01`;
      const endDate = startQ === "All" ? "" : `${ey}-${em.padStart(2, "0")}-31`;

      let legacyUser: string | null = null;
      let userWhere = "";
      let order = `u.gender ASC, CASE WHEN u.user_id ~ '^[0-9]+$' THEN u.user_id::numeric END`;
      const params: unknown[] = [];
      if (gender === "Male" || gender === "Female") {
        params.push(gender);
        userWhere = `AND lower(rtrim(u.gender)) = lower($${params.length})`;
        order = `CASE WHEN u.att_id ~ '^-?[0-9]+$' THEN u.att_id::numeric END ASC NULLS FIRST,
                 CASE WHEN u.user_id ~ '^[0-9]+$' THEN u.user_id::numeric END`;
      } else if (gender !== "All") {
        const m = await pool.query(
          `SELECT legacy_id FROM migration_meta.migration_legacy_ids
            WHERE entity_type = 'user' AND legacy_table = 'webxl_user' AND modern_id = $1 LIMIT 1`,
          [gender],
        );
        legacyUser = m.rows[0]?.legacy_id ?? null;
        if (!legacyUser) return res.json({ rows: [], total: 0 });
        params.push(legacyUser);
        userWhere = `AND u.user_id = $${params.length}`;
      }
      let slipWhere: string;
      let slipOrder: string;
      if (startQ !== "All") {
        params.push(startDate, endDate);
        slipWhere = `AND s.create_date >= $${params.length - 1} AND s.create_date <= $${params.length}`;
        slipOrder = `CASE WHEN s.id ~ '^[0-9]+$' THEN s.id::numeric END`;
      } else {
        // Old: "where user_id = '$attendanceGander' order by id desc" (only a single user matches).
        params.push(gender);
        slipWhere = `AND s.user_id = $${params.length}::text AND $${params.length}::text NOT IN ('All','Male','Female')`;
        if (legacyUser) params[params.length - 1] = legacyUser;
        slipOrder = `CASE WHEN s.id ~ '^[0-9]+$' THEN s.id::numeric END DESC`;
      }
      const hidden = await hiddenTableExists();
      const hiddenWhere = hidden ? `AND NOT EXISTS (SELECT 1 FROM ${HIDDEN_TABLE} h WHERE h.slip_id = s.id)` : "";
      const slips = (await pool.query(
        `SELECT s.id, s.user_id, s.create_date, s."grossSalary" AS gross_salary, s.vas, s.commission3, s.alibaba,
                s."projectCommission" AS project_commission, s.pppcommission, s."postingCommission" AS posting_commission,
                s.overtimers, s.reward, s.tcutting, s."totalSalary" AS total_salary, u.name
           FROM legacy_archive.webxl_tem_salary_ship s
           JOIN legacy_archive.webxl_user u ON u.user_id = s.user_id
          WHERE true ${userWhere} ${slipWhere} ${hiddenWhere}
          ORDER BY ${order}, ${slipOrder}`,
        params,
      )).rows;

      // add_commission: the old code looked these up by user_id = attendanceGander
      // inside the per-slip loop, so they repeat after every slip of that user.
      let commissions: any[] = [];
      if (addCommission && legacyUser && startQ !== "All") {
        commissions = (await pool.query(
          `SELECT id, create_at, comm_type, comm, reward, team_reward, user_status, manager_approve, hod_status, final_pay_amount
             FROM legacy_archive.webxl_vas_comm_final
            WHERE user_id = $1 AND create_at >= $2 AND create_at <= $3
              AND user_status = 'Verified' AND manager_approve = 'Approved' AND hod_status = 'Approved'
            ORDER BY CASE WHEN id ~ '^[0-9]+$' THEN id::numeric END DESC`,
          [legacyUser, startDate, endDate],
        )).rows;
      }
      const mY = (d: string) => (/^\d{4}-\d{2}/.test(d) ? `${d.slice(5, 7)}-${d.slice(0, 4)}` : "");
      const out: any[] = [];
      let total = 0;
      for (const s of slips) {
        total += num(s.total_salary);
        out.push({
          kind: "slip", id: s.id, create: mY(String(s.create_date)), name: s.name,
          grossSalary: s.gross_salary, vas: s.vas, commission3: s.commission3, alibaba: s.alibaba,
          projectCommission: s.project_commission, pppCommission: s.pppcommission,
          postingCommission: s.posting_commission, overtimeRs: s.overtimers, reward: s.reward,
          tcutting: s.tcutting, totalSalary: phpRound(num(s.total_salary), 0),
        });
        for (const c of commissions) {
          total += num(c.final_pay_amount);
          out.push({
            kind: "commission", id: c.id, create: mY(String(c.create_at)), name: s.name,
            grossSalary: c.comm_type, vas: c.comm, commission3: c.reward, alibaba: c.team_reward,
            projectCommission: c.user_status, pppCommission: c.manager_approve, postingCommission: c.hod_status,
            overtimeRs: "0", reward: "0", tcutting: "0", totalSalary: phpRound(num(c.final_pay_amount), 0),
          });
        }
      }

      let hint: Record<string, unknown> | null = null;
      if (out.length === 0 && legacyUser && gender !== "All" && gender !== "Male" && gender !== "Female") {
        const last = await pool.query(
          `SELECT left(create_date, 7) AS ym, left(create_date, 10) AS slip_day
             FROM legacy_archive.webxl_tem_salary_ship WHERE user_id = $1 AND create_date ~ '^[0-9]{4}-[0-9]{2}'
             ORDER BY create_date DESC LIMIT 1`,
          [legacyUser],
        );
        let slipsInRange = 0;
        if (startQ !== "All" && startDate) {
          const endYm = `${ey}-${em.padStart(2, "0")}`;
          const { start: rStart, next: rNext } = monthBounds(endYm);
          const cnt = await pool.query(
            `SELECT count(*)::int AS c FROM legacy_archive.webxl_tem_salary_ship s
              WHERE s.user_id = $1 AND s.create_date >= $2 AND s.create_date < $3`,
            [legacyUser, startDate, rNext],
          );
          slipsInRange = cnt.rows[0]?.c ?? 0;
        }
        const att = await pool.query(
          `SELECT att_id, name FROM legacy_archive.webxl_user WHERE user_id = $1 LIMIT 1`,
          [legacyUser],
        );
        hint = {
          attId: att.rows[0]?.att_id ?? "",
          name: att.rows[0]?.name ?? "",
          lastSlipMonth: last.rows[0]?.ym ?? null,
          lastSlipDate: last.rows[0]?.slip_day ?? null,
          rangeStart: startQ === "All" ? "All" : startQ,
          rangeEnd: startQ === "All" ? "All" : endQ,
          slipsInRange,
        };
      }

      res.json({ rows: out, total: phpRound(total, 0), hint });
    } catch (err) {
      console.error("[old-salary] view-report error:", err);
      res.status(500).json({ error: "Failed to load the salary view report" });
    }
  });

  // Old "View Month Wise": SUM(totalSalary) per month of create_date.
  app.get("/api/reports/old-salary/month-wise", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canView(req)) return res.status(403).json({ error: "You are not authorized to view salary." });
      const start = String(req.query.start ?? "");
      const end = String(req.query.end ?? "");
      if (!YM.test(start) || !YM.test(end)) return res.status(400).json({ error: "start/end must be YYYY-MM" });
      const hidden = await hiddenTableExists();
      const hiddenWhere = hidden ? `AND NOT EXISTS (SELECT 1 FROM ${HIDDEN_TABLE} h WHERE h.slip_id = s.id)` : "";
      // Old: DATE(create_date) BETWEEN 'Y-m-01' AND 'Y-m-31'.
      const r = await pool.query(
        `SELECT left(s.create_date, 7) AS month,
                sum(CASE WHEN s."totalSalary" ~ '^\\s*-?[0-9.]' THEN substring(s."totalSalary" FROM '^\\s*(-?[0-9]*\\.?[0-9]+(?:[eE][+-]?[0-9]+)?)')::numeric ELSE 0 END) AS total
           FROM legacy_archive.webxl_tem_salary_ship s
          WHERE left(s.create_date, 10) >= $1 AND left(s.create_date, 10) <= $2 ${hiddenWhere}
          GROUP BY 1 ORDER BY 1`,
        [`${start}-01`, `${end}-31`],
      );
      const rows = r.rows.map((x: any, i: number) => ({ n: i + 1, month: x.month, total: phpRound(Number(x.total), 0) }));
      const total = phpRound(r.rows.reduce((a: number, x: any) => a + Number(x.total), 0), 0);
      res.json({ rows, total });
    } catch (err) {
      console.error("[old-salary] month-wise error:", err);
      res.status(500).json({ error: "Failed to load month-wise salary" });
    }
  });

  // Old delete of a slip row. The copied rows are read-only, so the slip is
  // hidden in drm.legacy_salary_slip_hidden (un-run migration until applied).
  app.delete("/api/reports/old-salary/slips/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      if (!canDelete(req)) return res.status(403).json({ error: "You are not authorized to delete salary slips." });
      if (!(await hiddenTableExists())) {
        return res.status(503).json({
          error: "Deleting old salary slips needs the migration scripts/migration/create-legacy-salary-slip-hidden.sql.",
        });
      }
      const id = String(req.params.id);
      const slip = await pool.query(
        `SELECT s.id, s.user_id, s.create_date, s."totalSalary" AS total_salary
           FROM legacy_archive.webxl_tem_salary_ship s WHERE s.id = $1 LIMIT 1`,
        [id],
      );
      if (slip.rows.length === 0) return res.status(404).json({ error: "Salary slip not found" });
      await pool.query(
        `INSERT INTO ${HIDDEN_TABLE} (slip_id, hidden_by) VALUES ($1, $2) ON CONFLICT (slip_id) DO NOTHING`,
        [id, req.user.userId],
      );
      await recordAuditLog({
        actorUserId: req.user.userId,
        action: "salary.old_slip.delete",
        module: "salary",
        entityType: "LegacySalarySlip",
        entityId: id,
        before: slip.rows[0],
        reason: "Old salary report delete (hidden, old copy kept)",
        req,
      }).catch((e) => console.error("[old-salary] audit log failed:", e));
      res.json({ success: true });
    } catch (err) {
      console.error("[old-salary] delete error:", err);
      res.status(500).json({ error: "Failed to delete salary slip" });
    }
  });
}
