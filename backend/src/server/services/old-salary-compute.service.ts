// Salary Create = the OLD DRM salary-create.php page (Male / Female tabs), on the
// new tables. Per user (old webxl_user, roleId != 54, no slip saved yet in the
// generation month, ordered by att_id) and per attendance_month row of the
// worked month:
//   totalMin   = lateHour * 60 + lateMin
//   cuttingMin = LateComingWitoutInform(user, month, year) + (totalMin - relaxationMin)
//   perDay     = netSalary / 30          perMin = perDay / 8 / 60
//   cutMinSalary = cuttingMin < 0 ? 0 : cuttingMin * perMin
//   if (leaves > 1) { paidleave = 2; unpaidleave = leaves - 2;
//                     leaveCut = perDay * unpaidleave; cutSalary = cutMinSalary + leaveCut }
//   (leaves <= 1 -> NO cutting at all, not even late minutes — old quirk, kept)
//   totalSalary = netSalary - cutSalary      (rows with netSalary 0 are hidden)
// Period M = the worked month (old default: last month); its slips were saved in
// M+1, so users with an old slip created in M+1 (or a new-app run line for M)
// are left out, like the old page.
import { pool } from "../db";

const OLD_WORK_DAYS = 26;

function num(v: unknown): number {
  const m = String(v ?? "").match(/^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/);
  return m ? Number(m[1]) : 0;
}
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Format like old MySQL `create_date` on salary slips (Asia/Karachi). */
function legacySlipTimestamp(d = new Date()): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** Persist Salary Make into legacy_archive so Old DRM Salary Report lists it (old INSERT). */
export async function insertLegacySalarySlip(
  legacyUserId: string,
  slip: Record<string, unknown>,
  createDate?: Date,
): Promise<string> {
  const next = await pool.query(
    `SELECT coalesce(max(CASE WHEN id ~ '^[0-9]+$' THEN id::numeric END), 0)::bigint + 1 AS n
       FROM legacy_archive.webxl_tem_salary_ship`,
  );
  const id = String(next.rows[0]?.n ?? 1);
  const create = legacySlipTimestamp(createDate);
  const s = (k: string, alt?: unknown) => String(slip[k] ?? alt ?? "");
  await pool.query(
    `INSERT INTO legacy_archive.webxl_tem_salary_ship (
       _legacy_pk, _legacy_pk_column, id, user_id, "grossSalary", present, leave, "cuttingMin",
       "pendingLeave", pendingleavesrupes, vas, commission3, alibaba, "projectCommission",
       pppcommission, "postingCommission", overtimemin, overtimers, reward, "basicCutting",
       tcutting, penalty, "totalSalary", create_date, cus_paid_leave, cus_unpaid_leave, user_salary_status)
     VALUES ($1,'id',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
    [
      id, id, legacyUserId,
      s("grossSalary"), s("present"), s("leave"), s("cuttingMin"), s("pendingLeave"), s("pendingleavesrupes"),
      s("vas"), s("commission3"), s("alibaba"), s("projectCommission"), s("pppcommission"), s("postingCommission"),
      s("overtimemin"), s("overtimers"), s("reward"), s("basicCutting"), s("tcutting"), s("penalty"), s("totalSalary"),
      create, s("cus_paid_leave"), s("cus_unpaid_leave"), String(slip.user_salary_status ?? ""),
    ],
  );
  return id;
}

export interface OldManualAdj {
  bonusAmount?: number;
  allowanceAmount?: number;
  overtimeAmount?: number;
  loanDeduction?: number;
  otherDeductions?: number;
  remarks?: string | null;
}

export type OldSlip = {
  id: string; createDate: string; grossSalary: number; present: number; leave: number; cuttingMin: number;
  overtimeMin: number; overtimeRs: number; reward: number; penalty: number; loan: number;
  vas: number; commission3: number; alibaba: number; projectCommission: number; pppCommission: number;
  postingCommission: number; cusPaidLeave: number; cusUnpaidLeave: number; pendingLeave: number;
  basicCutting: number; tcutting: number; totalSalary: number; salaryStatus: string;
};

export type OldPreviewItem = {
  userId: string; employeeName: string; department: string | null; branch: string | null;
  basicSalary: number; perDaySalary: number; daysPresent: number; daysAbsent: number; leaveDays: number;
  unpaidLeaveDays: number; lateMinutes: number; overtimeMinutes: number; allowanceAmount: number;
  bonusAmount: number; overtimeAmount: number; grossSalary: number; unpaidLeaveDeduction: number;
  absenceDeduction: number; lateDeduction: number; penaltyAmount: number; loanDeduction: number;
  otherDeductions: number; totalDeductions: number; netSalary: number; payableSalary: number;
  calculationSnapshot: Record<string, unknown>;
  // old salary-create.php columns
  legacyUserId: string | null; attId: string | null; gender: string | null; attendanceMonthId: string;
  month: number; year: number; relaxationMin: number; totalLateMin: number; lateComingWithoutInform: number;
  paidLeave: number; earnDays: number; absentsRs: number; cuttingMinRs: number; perDayRs: number;
  totalCutting: number; totalSalary: number; salarySource: "old" | "new";
  suggested: { overtimeMinutes: number; overtimeAmount: number; penalty: number; loan: number; reward: number };
  oldSlip: OldSlip | null;
};

/** Slips the old system saved for worked month M (created during M+1). */
export type OldSlipRow = OldSlip & {
  legacyUserId: string; modernUserId: string | null; name: string; attId: string | null; createdMonth: string;
};

export async function loadOldSlipsForPeriod(month: number, year: number): Promise<Map<string, OldSlip>> {
  const out = new Map<string, OldSlip>();
  // Latest slip wins when a user got two in the same month.
  for (const s of await listOldSlipsForPeriod(month, year)) if (s.modernUserId) out.set(s.modernUserId, s);
  return out;
}

/** Every old slip saved for worked month M (created in M+1), with the employee's old name. */
export async function listOldSlipsForPeriod(month: number, year: number): Promise<OldSlipRow[]> {
  const nm = month === 12 ? 1 : month + 1;
  const ny = month === 12 ? year + 1 : year;
  const start = `${ny}-${String(nm).padStart(2, "0")}-01`;
  const nnm = nm === 12 ? 1 : nm + 1;
  const nny = nm === 12 ? ny + 1 : ny;
  const end = `${nny}-${String(nnm).padStart(2, "0")}-01`;
  const r = await pool.query(
    // Loan of a slip = the webxl_pay_loan row the old save wrote at the same moment.
    `WITH pl AS (
       SELECT user_id, pay_date,
              sum(CASE WHEN pay ~ '^\\s*[0-9]' THEN substring(pay FROM '^\\s*([0-9]+(?:\\.[0-9]+)?)')::numeric ELSE 0 END) AS paid
         FROM legacy_archive.webxl_pay_loan
        WHERE pay_date >= $1 AND pay_date < $2
        GROUP BY user_id, pay_date),
     -- materialized first: the planner badly misestimates the id-map join otherwise (2.5 s)
     s AS MATERIALIZED (
       SELECT * FROM legacy_archive.webxl_tem_salary_ship
        WHERE create_date >= $1 AND create_date < $2)
     SELECT s.*, m.modern_id, pl.paid AS loan_paid, u.name AS old_name, u.att_id AS old_att_id
       FROM s
       LEFT JOIN migration_meta.migration_legacy_ids m
         ON m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.legacy_id = s.user_id
       LEFT JOIN legacy_archive.webxl_user u ON u.user_id = s.user_id
       LEFT JOIN pl ON pl.user_id = s.user_id AND pl.pay_date = s.create_date
      ORDER BY CASE WHEN s.id ~ '^[0-9]+$' THEN s.id::numeric END`,
    [start, end],
  );
  return r.rows.map((s: any) => ({
      legacyUserId: String(s.user_id), modernUserId: s.modern_id ?? null, name: s.old_name ?? "",
      attId: s.old_att_id ?? null, createdMonth: start.slice(0, 7),
      id: String(s.id), createDate: String(s.create_date ?? ""),
      grossSalary: num(s.grossSalary), present: num(s.present), leave: num(s.leave),
      cuttingMin: num(s.cuttingMin), overtimeMin: num(s.overtimemin), overtimeRs: num(s.overtimers),
      reward: num(s.reward), penalty: num(s.penalty), loan: num(s.loan_paid),
      vas: num(s.vas), commission3: num(s.commission3), alibaba: num(s.alibaba),
      projectCommission: num(s.projectCommission), pppCommission: num(s.pppcommission),
      postingCommission: num(s.postingCommission), cusPaidLeave: num(s.cus_paid_leave),
      cusUnpaidLeave: num(s.cus_unpaid_leave), pendingLeave: num(s.pendingLeave),
      basicCutting: num(s.basicCutting), tcutting: num(s.tcutting), totalSalary: num(s.totalSalary),
      salaryStatus: String(s.user_salary_status ?? ""),
  }));
}

/**
 * LateComingWitoutInform($user_id, $month, $year) from func.php:
 *   SELECT SUM(time) FROM webxl_overtime
 *    WHERE dep='Pending' AND type='late coming' AND user_id=… AND MONTH/YEAR(create_date)=…
 * Old rows come from the archive (the copy in drm.overtime_records dropped `type`);
 * late-coming entries added in the new app (drm.late_coming_entries) are added on top.
 */
export async function lateComingWithoutInform(month: number, year: number): Promise<Map<string, number>> {
  const mm = String(month).padStart(2, "0");
  const first = `${year}-${mm}-01`;
  const r = await pool.query(
    `SELECT user_id, SUM(minutes) AS minutes FROM (
       SELECT m.modern_id AS user_id,
              CASE WHEN o.time ~ '^\\s*-?[0-9]' THEN substring(o.time FROM '^\\s*(-?[0-9]+(?:\\.[0-9]+)?)')::numeric ELSE 0 END AS minutes
         FROM legacy_archive.webxl_overtime o
         JOIN migration_meta.migration_legacy_ids m
           ON m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.legacy_id = o.user_id
        WHERE o.dep = 'Pending' AND o.type = 'late coming' AND o.create_date LIKE $1
       UNION ALL
       SELECT e.user_id::text, e.late_minutes
         FROM drm.late_coming_entries e
        WHERE (e.entry_date AT TIME ZONE 'Asia/Karachi') >= $2::date
          AND (e.entry_date AT TIME ZONE 'Asia/Karachi') < ($2::date + interval '1 month')
     ) x GROUP BY user_id`,
    [`${year}-${mm}-%`, first],
  );
  return new Map(r.rows.map((x: any) => [String(x.user_id), Number(x.minutes) || 0]));
}

export async function computeOldSalaryPreview(
  month: number,
  year: number,
  filters: { branch?: string; department?: string; userId?: string; includePaid?: boolean },
  manual: Record<string, OldManualAdj> = {},
): Promise<OldPreviewItem[]> {
  const mm = String(month).padStart(2, "0");
  const first = `${year}-${mm}-01`;
  const genMonth = month === 12 ? 1 : month + 1;
  const genYear = month === 12 ? year + 1 : year;
  const genStart = `${genYear}-${String(genMonth).padStart(2, "0")}-01`;
  const genEnd = genMonth === 12 ? `${genYear + 1}-01-01` : `${genYear}-${String(genMonth + 1).padStart(2, "0")}-01`;

  // Old: webxl_user WHERE roleId != 54 (MySQL numeric compare: "54," = 54, NULL excluded)
  //      AND user_id NOT IN (slips created this month) ORDER BY att_id ASC.
  const where: string[] = [
    "u.is_active = true",
    `(l.user_id IS NULL OR (l."roleId" IS NOT NULL
        AND COALESCE(substring(l."roleId" FROM '^\\s*([+-]?[0-9]+)')::numeric, 0) <> 54))`,
  ];
  const params: any[] = [genStart, genEnd, month, year];
  if (!filters.includePaid) {
    where.push(`NOT EXISTS (SELECT 1 FROM paid_old po WHERE po.user_id = l.user_id)`);
    where.push(`NOT EXISTS (
      SELECT 1 FROM drm.salary_run_items sri JOIN drm.salary_runs sr ON sr.id = sri.run_id
       WHERE sri.user_id = u.id AND sr.deleted_at IS NULL AND sr.status <> 'CANCELLED'
         AND sr.period_month = $3 AND sr.period_year = $4)`);
  }
  if (filters.branch) { params.push(filters.branch); where.push(`u.branch = $${params.length}`); }
  if (filters.department) { params.push(filters.department); where.push(`u.department = $${params.length}`); }
  if (filters.userId) { params.push(filters.userId); where.push(`u.id::text = $${params.length}`); }

  const [usersRes, lateNoInform, otRes, penRes, bonusRes, loanRes, oldSlips] = await Promise.all([
    pool.query(
      `WITH paid_old AS MATERIALIZED (
         SELECT DISTINCT user_id FROM legacy_archive.webxl_tem_salary_ship
          WHERE create_date >= $1 AND create_date < $2)
       SELECT u.id::text AS id, COALESCE(NULLIF(trim(l.name), ''), NULLIF(trim(u.full_name), ''), u.name, u.username) AS name,
              u.department, u.branch, u.gender AS new_gender,
              u.basic_salary, u.daily_allowance, u.mobile_allowance, u.admin_allowance, u.conveyance_allowance,
              u.relaxation_minutes,
              l.user_id AS legacy_id, l.att_id, l.gender AS old_gender,
              l."netSalary" AS old_net, l."relaxationMin" AS old_relax,
              am.id::text AS am_id, am.leaves, am.half_leave, am.late_hour, am.late_min
         FROM drm.users u
         LEFT JOIN migration_meta.migration_legacy_ids m
                ON m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.modern_id = u.id::text
         LEFT JOIN legacy_archive.webxl_user l ON l.user_id = m.legacy_id
         JOIN drm.attendance_month am ON am.user_id = u.id AND am.month = $3 AND am.year = $4
        WHERE ${where.join(" AND ")}
        ORDER BY CASE WHEN l.att_id ~ '^-?[0-9]+$' THEN l.att_id::numeric END ASC NULLS FIRST,
                 CASE WHEN l.user_id ~ '^[0-9]+$' THEN l.user_id::numeric END, name`,
      params,
    ),
    lateComingWithoutInform(month, year),
    pool.query(
      `SELECT user_id::text AS user_id, COALESCE(SUM(time_spent), 0) AS minutes
         FROM drm.overtime_records
        WHERE status = 'Approved' AND date >= $1::date AND date < ($1::date + interval '1 month')
        GROUP BY user_id`,
      [first],
    ),
    pool.query(
      `SELECT employee_id::text AS user_id, COALESCE(SUM(amount), 0) AS total
         FROM drm.penalties
        WHERE approval_status = 'APPROVED' AND COALESCE(status, 'ACTIVE') <> 'VOIDED' AND deleted_at IS NULL
          AND penalty_date >= $1::date AND penalty_date < ($1::date + interval '1 month')
        GROUP BY employee_id`,
      [first],
    ),
    pool.query(
      `SELECT user_id::text AS user_id, COALESCE(SUM(amount), 0) AS total
         FROM drm.employee_bonuses
        WHERE status = 'APPROVED' AND period_month = $1 AND period_year = $2
        GROUP BY user_id`,
      [month, year],
    ),
    // Old advance rule (usernameTempSalaryAll): status 'Pending', manager + HOD
    // 'Approved', remaning >= instalment -> one instalment. Old advances from the
    // archive (the drm.loan_requests copy lost those statuses) + new-app loans.
    pool.query(
      `SELECT user_id, SUM(total) AS total FROM (
         SELECT m.modern_id AS user_id,
                substring(a.instalment FROM '^\\s*([0-9]+(?:\\.[0-9]+)?)')::numeric AS total
           FROM legacy_archive.webxl_addvance_salary a
           JOIN migration_meta.migration_legacy_ids m
             ON m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.legacy_id = a.user_id
          WHERE a.status = 'Pending' AND a.manager = 'Approved' AND a.hod = 'Approved'
            AND a.instalment ~ '^\\s*[0-9]' AND a.remaning ~ '^\\s*-?[0-9]'
            AND substring(a.instalment FROM '^\\s*([0-9]+(?:\\.[0-9]+)?)')::numeric > 0
            AND substring(a.remaning FROM '^\\s*(-?[0-9]+(?:\\.[0-9]+)?)')::numeric
                >= substring(a.instalment FROM '^\\s*([0-9]+(?:\\.[0-9]+)?)')::numeric
         UNION ALL
         SELECT lr.user_id::text, LEAST(lr.installment_amount, lr.remaining_amount)
           FROM drm.loan_requests lr
          WHERE lr.status = 'HODApproved' AND lr.remaining_amount > 0 AND lr.installment_amount > 0
            AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids ml
                             WHERE ml.modern_table = 'loan_requests' AND ml.modern_id = lr.id::text
                               AND ml.legacy_table = 'webxl_addvance_salary')
       ) x GROUP BY user_id`,
    ),
    loadOldSlipsForPeriod(month, year),
  ]);
  const byUser = (rows: any[]) => new Map(rows.map((r) => [String(r.user_id), Number(r.minutes ?? r.total) || 0]));
  const otMap = byUser(otRes.rows);
  const penMap = byUser(penRes.rows);
  const bonusMap = byUser(bonusRes.rows);
  const loanMap = byUser(loanRes.rows);

  const items: OldPreviewItem[] = [];
  for (const u of usersRes.rows as any[]) {
    const id = String(u.id);
    const m = manual[id] || {};
    const oldNet = num(u.old_net);
    const newNet = num(u.basic_salary) + num(u.daily_allowance) + num(u.mobile_allowance)
      + num(u.admin_allowance) + num(u.conveyance_allowance);
    const net = u.legacy_id && String(u.old_net ?? "").trim() !== "" ? oldNet : newNet;
    // Old: the row is only shown when netSalary != 0.
    if (net === 0) continue;
    const salarySource: "old" | "new" = u.legacy_id && String(u.old_net ?? "").trim() !== "" ? "old" : "new";
    const relax = u.old_relax != null && String(u.old_relax).trim() !== "" ? num(u.old_relax) : num(u.relaxation_minutes);

    // ---- old salary-create.php, line for line ----
    const hour = num(u.late_hour);
    const min = num(u.late_min);
    const leave = num(u.leaves);
    const totalMin = hour * 60 + min;
    const lateNoInf = lateNoInform.get(id) ?? 0;
    const cuttingMin = lateNoInf + (totalMin - relax);
    const perDay = net / 30;
    const perMin = perDay / 8 / 60;
    const cutMinSalary = cuttingMin < 0 ? 0 : cuttingMin * perMin;
    let paidleave = 0, unpaidleave = 0, leaveCut = 0, cutSalary = 0;
    if (leave > 1) {
      paidleave = 2;
      unpaidleave = leave - 2;
      leaveCut = perDay * unpaidleave;
      cutSalary = cutMinSalary + leaveCut;
    }
    const totalCuting = cutSalary;
    const totalSalaryExact = net - totalCuting;
    // ---------------------------------------------

    // Additional (old salary-make) inputs: editable, default 0. The data-based
    // values are returned as suggestions only, so the line equals the old page.
    const suggested = {
      overtimeMinutes: otMap.get(id) ?? 0,
      overtimeAmount: Math.round((otMap.get(id) ?? 0) * perMin),
      penalty: r2(penMap.get(id) ?? 0),
      loan: r2(loanMap.get(id) ?? 0),
      reward: r2(bonusMap.get(id) ?? 0),
    };
    const allowanceAmount = m.allowanceAmount ?? 0;
    const bonusAmount = m.bonusAmount ?? 0;
    const overtimeAmount = m.overtimeAmount ?? 0;
    const loan = m.loanDeduction ?? 0;
    const otherDeductions = m.otherDeductions ?? 0;

    const absenceDeduction = r2(leaveCut);
    const lateDeduction = r2(leave > 1 ? cutMinSalary : 0);
    const grossSalary = r2(net + allowanceAmount + bonusAmount + overtimeAmount);
    const totalDeductions = r2(absenceDeduction + lateDeduction + loan + otherDeductions);
    const netSalary = r2(grossSalary - totalDeductions);
    const gender = String(u.old_gender ?? u.new_gender ?? "").trim();

    items.push({
      userId: id,
      employeeName: u.name || "",
      department: u.department ?? null,
      branch: u.branch ?? null,
      basicSalary: r2(net),
      perDaySalary: r2(perDay),
      daysPresent: OLD_WORK_DAYS - leave,
      daysAbsent: unpaidleave,
      leaveDays: leave,
      unpaidLeaveDays: 0,
      lateMinutes: cuttingMin,
      overtimeMinutes: suggested.overtimeMinutes,
      allowanceAmount,
      bonusAmount,
      overtimeAmount,
      grossSalary,
      unpaidLeaveDeduction: 0,
      absenceDeduction,
      lateDeduction,
      penaltyAmount: 0,
      loanDeduction: loan,
      otherDeductions,
      totalDeductions,
      netSalary,
      payableSalary: r2(Math.max(0, netSalary)),
      legacyUserId: u.legacy_id ?? null,
      attId: u.att_id ?? null,
      gender: /^f/i.test(gender) ? "Female" : /^m/i.test(gender) ? "Male" : gender || null,
      attendanceMonthId: u.am_id,
      month, year,
      relaxationMin: relax,
      totalLateMin: totalMin,
      lateComingWithoutInform: lateNoInf,
      paidLeave: paidleave,
      earnDays: OLD_WORK_DAYS - leave,
      absentsRs: Math.round(leaveCut),
      cuttingMinRs: Math.round(cutMinSalary),
      perDayRs: Math.round(perDay),
      totalCutting: Math.round(totalCuting),
      totalSalary: Math.round(totalSalaryExact),
      salarySource,
      suggested,
      oldSlip: oldSlips.get(id) ?? null,
      calculationSnapshot: {
        method: "old-drm salary-create.php",
        period: { month, year },
        inputs: {
          netSalary: net, salarySource, relaxationMin: relax, lateHour: hour, lateMin: min, leaves: leave,
          lateComingWithoutInform: lateNoInf, attendanceMonthId: u.am_id,
          allowanceAmount, bonusAmount, overtimeAmount, loanDeduction: loan, otherDeductions,
        },
        outputs: {
          totalMin, cuttingMin, perDay, perMin, cutMinSalary, paidleave, unpaidleave, leaveCut, cutSalary,
          totalCuting, totalSalary: Math.round(totalSalaryExact), netSalary,
        },
        rule: "cutting only when leaves > 1 (old salary-create.php): then (leaves-2) x net/30 + max(0, cuttingMin) x net/30/8/60",
        suggestedFromData: suggested,
        computedAt: new Date().toISOString(),
      },
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Old "SALARY MAKE" page (salary-make=<attendance_month id>-<user_id>): the
// per-employee slip form. Its PHP/JS is not on the server; the Submit handler
// (func.php `usernameTempSalary`) and the formulas below were fitted on the
// saved slips (webxl_tem_salary_ship, May–Nov 2026: tcutting 1629/1637,
// totalSalary 1633/1637, basicCutting 1298/1637 + 326 rows saved as 0 by the
// bulk pages):
//   perDay = gross / 30, perMin = perDay / 8 / 60
//   Total Cutting  = unpaidLeave*perDay + max(0, cuttingMin)*perMin + penalty + loan
//                    (+ halfLeave*perDay/2 — Half Leave is not a slip column; assumed)
//   Basic Salary Cutting = gross - Total Cutting + penalty
//   Total Salary   = gross - Total Cutting + VAS bonus + 5% + Alibaba + Project + PPP
//                    + Product Posting + OT Rs + Reward + Pending Leave Rs
//                    + (Paid Holiday - Unpaid Holiday) * perDay
// Field -> slip column: VAS Bonus -> vas, 5 % Bonus -> commission3, Unpaid
// Holiday -> cus_paid_leave, Paid Holiday -> cus_unpaid_leave (old names crossed).
// "VAS" is the employee's own VAS (informational, not stored on the slip).
// ---------------------------------------------------------------------------

export type SalaryMakeInput = {
  grossSalary: number; present: number; unpaidLeave: number; cuttingMin: number;
  pendingLeave: number; pendingLeaveRupees: number; vas: number | null; vasBonus: number;
  bonus5: number; alibabaBonus: number; projectBonus: number; pppBonus: number; postingBonus: number;
  overtimeMin: number; overtimeRs: number; reward: number; loan: number;
  unpaidHoliday: number; paidHoliday: number; penalty: number; halfLeave: number;
};

export function computeSalaryMake(i: SalaryMakeInput) {
  const perDay = i.grossSalary / 30;
  const perMin = perDay / 8 / 60;
  const leaveCut = i.unpaidLeave * perDay;
  const lateCut = Math.max(0, i.cuttingMin) * perMin;
  const halfLeaveCut = i.halfLeave * perDay / 2;
  const totalCutting = leaveCut + lateCut + halfLeaveCut + i.penalty + i.loan;
  const basicSalaryCutting = i.grossSalary - totalCutting + i.penalty;
  const bonuses = i.vasBonus + i.bonus5 + i.alibabaBonus + i.projectBonus + i.pppBonus + i.postingBonus;
  const holidayRs = (i.paidHoliday - i.unpaidHoliday) * perDay;
  const totalExact = i.grossSalary - totalCutting + bonuses + i.overtimeRs + i.reward + i.pendingLeaveRupees + holidayRs;
  return {
    perDay, perMin, leaveCut, lateCut, halfLeaveCut, bonuses, holidayRs,
    totalCutting: r2(totalCutting),
    basicSalaryCutting: r2(basicSalaryCutting),
    totalSalaryExact: totalExact,
    totalSalary: Math.round(totalExact),
  };
}

/** Prefill of the salary-make form for one employee + worked month. */
export async function getSalaryMakePrefill(month: number, year: number, modernUserId: string) {
  const mm = String(month).padStart(2, "0");
  const first = `${year}-${mm}-01`;
  const u = (await pool.query(
    `SELECT u.id::text AS id, COALESCE(NULLIF(trim(l.name), ''), NULLIF(trim(u.full_name), ''), u.username) AS name,
            l.user_id AS legacy_id, am.id::text AS am_id, am.leaves, am.half_leave, am.late_hour, am.late_min,
            l."netSalary" AS old_net, l."relaxationMin" AS old_relax, u.relaxation_minutes,
            u.basic_salary, u.daily_allowance, u.mobile_allowance, u.admin_allowance, u.conveyance_allowance
       FROM drm.users u
       LEFT JOIN migration_meta.migration_legacy_ids m
              ON m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.modern_id = u.id::text
       LEFT JOIN legacy_archive.webxl_user l ON l.user_id = m.legacy_id
       LEFT JOIN drm.attendance_month am ON am.user_id = u.id AND am.month = $2 AND am.year = $3
      WHERE u.id::text = $1`,
    [modernUserId, month, year],
  )).rows[0];
  if (!u) return null;
  const legacyId: string | null = u.legacy_id ?? null;
  const like = `${year}-${mm}-%`;

  // SalaryMakeFunTeamVas(): team members (underWork = this user) and their
  // invoice payments in the month. Old data only (archive ends 2026-11-03).
  const teamVas = legacyId
    ? (await pool.query(
        `SELECT w.user_id, w.name, SUM(CASE WHEN p.amount ~ '^\\s*-?[0-9]' THEN substring(p.amount FROM '^\\s*(-?[0-9]+(?:\\.[0-9]+)?)')::numeric ELSE 0 END) AS amount
           FROM legacy_archive.webxl_user w
           JOIN legacy_archive.webxl_invoice i ON i.user_id = w.user_id
           JOIN legacy_archive.webxl_payments p ON p.invoice_id = i.invoice_id AND p.com_id = i.com_id
          WHERE w."underWork" = $1 AND p.create_date LIKE $2
          GROUP BY w.user_id, w.name ORDER BY w.name`,
        [legacyId, like],
      )).rows.map((r: any) => ({ userId: String(r.user_id), name: r.name ?? "", amount: Number(r.amount) || 0 }))
    : [];
  // SalaryMakeFunPersonalVas(): own invoice payments of the month (user 43: domain_renewal = 0 only).
  const personalVas = legacyId
    ? (await pool.query(
        `SELECT SUM(CASE WHEN p.amount ~ '^\\s*-?[0-9]' THEN substring(p.amount FROM '^\\s*(-?[0-9]+(?:\\.[0-9]+)?)')::numeric ELSE 0 END) AS total
           FROM legacy_archive.webxl_invoice i
           JOIN legacy_archive.webxl_payments p ON p.invoice_id = i.invoice_id AND p.com_id = i.com_id
          WHERE i.user_id = $1 AND p.create_date LIKE $2 AND ($1 <> '43' OR i.domain_renewal = '0')`,
        [legacyId, like],
      )).rows[0]?.total
    : null;
  // SalaryMakeFunPPppLinks(): number of product-posting links of the month.
  const postingLinks = legacyId
    ? Number((await pool.query(
        `SELECT count(l.link)::int AS n
           FROM legacy_archive.webxl_task_assign a
           LEFT JOIN legacy_archive.webxl_task_links l ON l.pro_id = a.pro_id AND l.task_id = a.id
          WHERE a.user_id = $1 AND a.assign_date LIKE $2`,
        [legacyId, like],
      )).rows[0]?.n ?? 0)
    : 0;
  // advSalaryTotalInstal() / advSalaryTotalLoan(): instalments and remaining of
  // advances with status Pending + manager/HOD Approved (+ new-app loans).
  const loanRow = (await pool.query(
    `SELECT COALESCE(SUM(inst), 0) AS instalment, COALESCE(SUM(rem), 0) AS remaining FROM (
       SELECT CASE WHEN a.instalment ~ '^\\s*[0-9]' THEN substring(a.instalment FROM '^\\s*([0-9]+(?:\\.[0-9]+)?)')::numeric ELSE 0 END AS inst,
              CASE WHEN a.remaning ~ '^\\s*-?[0-9]' THEN substring(a.remaning FROM '^\\s*(-?[0-9]+(?:\\.[0-9]+)?)')::numeric ELSE 0 END AS rem
         FROM legacy_archive.webxl_addvance_salary a
        WHERE a.user_id = $1 AND a.status = 'Pending' AND a.manager = 'Approved' AND a.hod = 'Approved'
       UNION ALL
       SELECT LEAST(lr.installment_amount, lr.remaining_amount), lr.remaining_amount
         FROM drm.loan_requests lr
        WHERE lr.user_id::text = $2 AND lr.status = 'HODApproved' AND lr.remaining_amount > 0
          AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids ml
                           WHERE ml.modern_table = 'loan_requests' AND ml.modern_id = lr.id::text
                             AND ml.legacy_table = 'webxl_addvance_salary')
     ) x`,
    [legacyId ?? "", modernUserId],
  )).rows[0];
  // Pending leave balance = the last old slip's pendingLeave (old increment page kept it there).
  const lastSlip = legacyId
    ? (await pool.query(
        `SELECT "pendingLeave" FROM legacy_archive.webxl_tem_salary_ship
          WHERE user_id = $1 AND create_date < $2
          ORDER BY CASE WHEN id ~ '^[0-9]+$' THEN id::numeric END DESC LIMIT 1`,
        [legacyId, `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`],
      )).rows[0]
    : null;

  // Same inputs as the list page, computed here too so the form also works for
  // employees the list leaves out (old role 54, net 0, already paid).
  const leaves = num(u.leaves);
  const oldNetSet = !!legacyId && String(u.old_net ?? "").trim() !== "";
  const gross = oldNetSet ? num(u.old_net)
    : num(u.basic_salary) + num(u.daily_allowance) + num(u.mobile_allowance) + num(u.admin_allowance) + num(u.conveyance_allowance);
  const relax = u.old_relax != null && String(u.old_relax).trim() !== "" ? num(u.old_relax) : num(u.relaxation_minutes);
  const lateNoInf = (await lateComingWithoutInform(month, year)).get(modernUserId) ?? 0;
  const cuttingMin = u.am_id ? lateNoInf + (num(u.late_hour) * 60 + num(u.late_min) - relax) : 0;
  const perMin = gross / 30 / 8 / 60;
  const [otRow, penRow, bonusRow, oldSlips] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(time_spent), 0) AS v FROM drm.overtime_records
        WHERE user_id::text = $1 AND status = 'Approved' AND date >= $2::date AND date < ($2::date + interval '1 month')`,
      [modernUserId, first]),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS v FROM drm.penalties
        WHERE employee_id::text = $1 AND approval_status = 'APPROVED' AND COALESCE(status, 'ACTIVE') <> 'VOIDED'
          AND deleted_at IS NULL AND penalty_date >= $2::date AND penalty_date < ($2::date + interval '1 month')`,
      [modernUserId, first]),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS v FROM drm.employee_bonuses
        WHERE user_id::text = $1 AND status = 'APPROVED' AND period_month = $2 AND period_year = $3`,
      [modernUserId, month, year]),
    loadOldSlipsForPeriod(month, year),
  ]);
  const otMin = Number(otRow.rows[0]?.v) || 0;
  const input: SalaryMakeInput = {
    grossSalary: gross,
    present: OLD_WORK_DAYS - leaves,
    unpaidLeave: leaves > 1 ? leaves - 2 : 0,
    cuttingMin,
    pendingLeave: lastSlip ? num(lastSlip.pendingLeave) : 0,
    pendingLeaveRupees: 0,
    vas: personalVas == null ? null : Number(personalVas),
    vasBonus: 0, bonus5: 0, alibabaBonus: 0, projectBonus: 0, pppBonus: 0, postingBonus: 0,
    overtimeMin: otMin,
    overtimeRs: Math.round(otMin * perMin),
    reward: r2(Number(bonusRow.rows[0]?.v) || 0),
    loan: Number(loanRow?.instalment) || 0,
    unpaidHoliday: 0,
    paidHoliday: 0,
    penalty: r2(Number(penRow.rows[0]?.v) || 0),
    halfLeave: num(u.half_leave),
  };
  return {
    userId: modernUserId,
    legacyUserId: legacyId,
    name: u.name ?? "",
    attendanceMonthId: u.am_id ?? null,
    month, year,
    hasAttendance: !!u.am_id,
    input,
    computed: computeSalaryMake(input),
    teamVas,
    teamVasTotal: teamVas.reduce((a: number, t: { amount: number }) => a + t.amount, 0),
    postingLinks,
    loanRemaining: Number(loanRow?.remaining) || 0,
    oldSlip: oldSlips.get(modernUserId) ?? null,
    salarySource: oldNetSet ? "old" : "new",
  };
}
