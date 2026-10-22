/**
 * Increment Management service — all calculations for the Increment module.
 *
 * Design notes:
 *  - The LIVE drm.users table may or may not have the "extended" HR columns
 *    (basic_salary, relaxation_minutes, join_date, increment, attendance_id).
 *    The migration that adds them (20260216_add_extended_user_fields.sql) is not
 *    guaranteed to be applied, so we DETECT which columns exist at runtime and
 *    degrade gracefully to honest "missing data" instead of crashing or faking
 *    values.
 *  - All queries use the `drm` schema explicitly and are parameterized.
 *  - No mock/fake data is ever produced. Missing inputs are reported via the
 *    `missingData` map and surfaced to the UI.
 */
import { pool } from "../db";
import { normalizeRole } from "../utils/role-utils";

const DAY_MS = 86_400_000;

// ─── Configurable thresholds (env with safe defaults) ────────────────────────
function numEnv(name: string, def: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return def;
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
}
export const INCREMENT_CONFIG = {
  allowedLeavesPerMonth: numEnv("INCREMENT_ALLOWED_LEAVES_PER_MONTH", 2),
  minCompletionRate: numEnv("INCREMENT_MIN_COMPLETION_RATE", 0.75),
  maxNoticeCount: numEnv("INCREMENT_MAX_NOTICE_COUNT", 0),
  salaryDaysPerMonth: numEnv("INCREMENT_SALARY_DAYS_PER_MONTH", 30),
};

// ─── User column detection (cached) ──────────────────────────────────────────
const OPTIONAL_USER_COLUMNS = [
  "basic_salary",
  "relaxation_minutes",
  "join_date",
  "increment",
  "attendance_id",
  "role_type",
  "under_works",
] as const;
type OptionalUserColumn = (typeof OPTIONAL_USER_COLUMNS)[number];

let userColumnCache: Set<string> | null = null;
export async function getUserColumns(): Promise<Set<string>> {
  if (userColumnCache) return userColumnCache;
  const { rows } = await pool.query(
    `select column_name from information_schema.columns
      where table_schema = 'drm' and table_name = 'users'`,
  );
  userColumnCache = new Set(rows.map((r: any) => String(r.column_name)));
  return userColumnCache;
}
function has(cols: Set<string>, c: OptionalUserColumn): boolean {
  return cols.has(c);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function daysInclusive(from: Date, to: Date): number {
  return Math.max(1, Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1);
}
function monthsInRange(from: Date, to: Date): number {
  return Math.max(1, Math.round(daysInclusive(from, to) / 30));
}
function toNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// task / workflow status mapping (spec §4). Returns 'pending' | 'running' | 'completed' | 'other'
function categorizeStatus(status: string | null | undefined): "pending" | "running" | "completed" | "other" {
  const s = String(status ?? "").toUpperCase();
  if (["TODO", "PENDING", "PENDING_PROJECT", "DATA_VERIFY", "TASK_ASSIGNMENT"].includes(s)) return "pending";
  if (["INPROGRESS", "IN_EXECUTION", "RUNNING_PROJECT", "BLOCKED", "READY_FOR_QA"].includes(s)) return "running";
  if (["COMPLETED", "MANAGER_COMPLETE", "QA_COMPLETE", "VERIFICATION_COMPLETE"].includes(s)) return "completed";
  return "other";
}

export interface UserRecord {
  id: string;
  name: string | null;
  fullName: string | null;
  email: string | null;
  role: string | null;
  roleId: string | null;
  department: string | null;
  designation: string | null;
  branch: string | null;
  isActive: boolean;
  attendanceId: string | null;
  basicSalary: number | null;
  joinDate: string | null;
  relaxationMinutes: number | null;
  increment: number | null;
}

/** Build a SELECT list that only references columns that actually exist. */
async function userSelectColumns(): Promise<string> {
  const cols = await getUserColumns();
  const parts = [
    `id::text as id`,
    `name`,
    `full_name as "fullName"`,
    `email`,
    `role`,
    `role_id as "roleId"`,
    `department`,
    `designation`,
    `branch`,
    `is_active as "isActive"`,
    has(cols, "attendance_id") ? `attendance_id as "attendanceId"` : `null as "attendanceId"`,
    has(cols, "basic_salary") ? `basic_salary as "basicSalary"` : `null as "basicSalary"`,
    has(cols, "join_date") ? `join_date as "joinDate"` : `null as "joinDate"`,
    has(cols, "relaxation_minutes") ? `relaxation_minutes as "relaxationMinutes"` : `null as "relaxationMinutes"`,
    has(cols, "increment") ? `increment as "increment"` : `null as "increment"`,
  ];
  return parts.join(", ");
}

function mapUserRow(r: any): UserRecord {
  return {
    id: String(r.id),
    name: r.name ?? null,
    fullName: r.fullName ?? null,
    email: r.email ?? null,
    role: r.role ?? null,
    roleId: r.roleId ?? null,
    department: r.department ?? null,
    designation: r.designation ?? null,
    branch: r.branch ?? null,
    isActive: r.isActive !== false,
    attendanceId: r.attendanceId ? String(r.attendanceId) : null,
    basicSalary: toNum(r.basicSalary),
    joinDate: r.joinDate ? new Date(r.joinDate).toISOString().slice(0, 10) : null,
    relaxationMinutes: toNum(r.relaxationMinutes),
    increment: toNum(r.increment),
  };
}

export async function fetchUsers(opts: {
  allowedIds: string[] | null;
  activeOnly?: boolean;
  department?: string;
  role?: string;
  search?: string;
}): Promise<UserRecord[]> {
  const select = await userSelectColumns();
  const where: string[] = ["1=1"];
  const params: any[] = [];
  if (opts.activeOnly !== false) where.push("is_active = true");
  if (opts.allowedIds !== null) {
    params.push(opts.allowedIds);
    where.push(`id::text = ANY($${params.length}::text[])`);
  }
  if (opts.department) {
    params.push(opts.department);
    where.push(`department = $${params.length}`);
  }
  if (opts.role) {
    params.push(opts.role);
    where.push(`(role = $${params.length} or role_id = $${params.length})`);
  }
  if (opts.search) {
    params.push(`%${opts.search}%`);
    where.push(
      `(coalesce(full_name,'') ilike $${params.length} or coalesce(name,'') ilike $${params.length} or coalesce(email,'') ilike $${params.length})`,
    );
  }
  const { rows } = await pool.query(
    `select ${select} from drm.users where ${where.join(" and ")}
      order by coalesce(full_name, name, email) asc limit 1000`,
    params,
  );
  return rows.map(mapUserRow);
}

function roleLabel(roleId: string): string {
  return roleId
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface UserGroup {
  roleId: string;
  roleLabel: string;
  users: UserRecord[];
}

export function groupUsersByRole(users: UserRecord[]): UserGroup[] {
  const map = new Map<string, UserRecord[]>();
  for (const u of users) {
    const key = normalizeRole(u.role || u.roleId || "");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(u);
  }
  return Array.from(map.entries())
    .map(([roleId, list]) => ({ roleId, roleLabel: roleLabel(roleId), users: list }))
    .sort((a, b) => a.roleLabel.localeCompare(b.roleLabel));
}

// ─── Metrics ─────────────────────────────────────────────────────────────────
export interface IncrementMetrics {
  employee: UserRecord;
  // salary
  basicSalary: number | null;
  perDaySalary: number | null;
  // leaves
  approvedLeaveDays: number;
  absentDays: number;
  halfDays: number;
  lateDays: number;
  presentDays: number;
  totalLeaveDays: number;
  allowedLeaves: number;
  incrementLeaves: number;
  leaveDeductionAmount: number | null;
  monthsInRange: number;
  // minutes
  totalMin: number;
  relaxationMin: number;
  incrementMin: number;
  attendanceRecordCount: number;
  // tasks
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  // notices
  noticeCount: number;
  notices: Array<{ title: string | null; assignedAt: string | null; readStatus: string | null; status: string | null; assignedByUserId: string | null }>;
  // increment history
  lastIncrementDate: string | null;
  lastIncrementType: string | null;
  lastIncrementValue: number | null;
  incrementCycleStartDate: string | null;
  // evaluation
  eligibilityStatus: "Eligible" | "Review Required" | "Not Eligible" | "Missing Data";
  eligibilityReasons: string[];
  missingData: Record<string, boolean>;
}

async function computeSalary(user: UserRecord, missing: Record<string, boolean>) {
  const basicSalary = user.basicSalary;
  if (basicSalary === null) missing.salary = true;
  const perDaySalary = basicSalary === null ? null : round2(basicSalary / INCREMENT_CONFIG.salaryDaysPerMonth);
  return { basicSalary, perDaySalary };
}

async function computeAttendance(employeeId: string, from: Date, to: Date, missing: Record<string, boolean>) {
  let presentDays = 0, absentDays = 0, halfDays = 0, lateDays = 0, totalMin = 0, count = 0;
  try {
    const { rows } = await pool.query(
      `select status::text as status, check_in, check_out, working_hours
         from drm.attendance
        where user_id::text = $1::text and date >= $2 and date <= $3`,
      [employeeId, from, to],
    );
    count = rows.length;
    for (const r of rows) {
      const status = String(r.status ?? "");
      if (status === "Present") presentDays++;
      else if (status === "Absent") absentDays++;
      else if (status === "HalfDay") halfDays++;
      else if (status === "Late") { lateDays++; presentDays++; }
      // minutes
      if (r.check_in && r.check_out) {
        const mins = (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 60000;
        if (Number.isFinite(mins) && mins > 0) totalMin += mins;
      } else if (r.working_hours !== null && r.working_hours !== undefined) {
        const wh = toNum(r.working_hours);
        if (wh !== null) totalMin += wh * 60;
      }
    }
  } catch (err) {
    console.error("[increment] attendance query failed", err);
    missing.attendance = true;
  }
  if (count === 0) missing.attendance = true;
  return { presentDays, absentDays, halfDays, lateDays, totalMin: Math.round(totalMin), attendanceRecordCount: count };
}

async function computeApprovedLeaveDays(employeeId: string, from: Date, to: Date) {
  let approvedLeaveDays = 0;
  try {
    const { rows } = await pool.query(
      `select from_date, to_date, leave_type::text as leave_type
         from drm.leave_requests
        where user_id::text = $1::text and status = 'Approved'
          and from_date <= $3 and to_date >= $2`,
      [employeeId, from, to],
    );
    for (const r of rows) {
      if (String(r.leave_type) === "HalfDay") {
        approvedLeaveDays += 0.5;
        continue;
      }
      const lf = new Date(r.from_date);
      const lt = new Date(r.to_date);
      const start = lf.getTime() > from.getTime() ? lf : from;
      const end = lt.getTime() < to.getTime() ? lt : to;
      const days = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
      if (days > 0) approvedLeaveDays += days;
    }
  } catch (err) {
    console.error("[increment] leave query failed", err);
  }
  return approvedLeaveDays;
}

async function computeTaskStats(employeeId: string, from: Date, to: Date, missing: Record<string, boolean>) {
  // key -> category, deduped so the same task counted from multiple sources is counted once.
  const byKey = new Map<string, "pending" | "running" | "completed" | "other">();

  // 1) tasks table
  try {
    const { rows } = await pool.query(
      `select id::text as id, status::text as status
         from drm.tasks
        where coalesce(is_deleted, false) = false
          and (assigned_to_user_id::text = $1::text
               or owner_user_id::text = $1::text
               or $1::text = ANY(coalesce(participants, '{}')::text[]))
          and coalesce(start_date, created_at) >= $2
          and coalesce(start_date, created_at) <= $3`,
      [employeeId, from, to],
    );
    for (const r of rows) byKey.set("t:" + r.id, categorizeStatus(r.status));
  } catch (err) {
    console.error("[increment] tasks query failed", err);
    missing.tasks = true;
  }

  // 2) product posting + software workflows (dedup by task_id)
  for (const table of ["product_posting_workflows", "software_workflows"]) {
    try {
      const { rows } = await pool.query(
        `select id::text as id, task_id::text as task_id, current_phase
           from drm.${table}
          where (executive_user_id::text = $1::text
                 or manager_user_id::text = $1::text
                 or qa_user_id::text = $1::text
                 or verification_user_id::text = $1::text)
            and coalesce(assigned_at, created_at) >= $2
            and coalesce(assigned_at, created_at) <= $3`,
        [employeeId, from, to],
      );
      for (const r of rows) {
        const taskKey = r.task_id ? "t:" + r.task_id : table + ":" + r.id;
        if (byKey.has(taskKey)) continue; // already counted from tasks table
        byKey.set(taskKey, categorizeStatus(r.current_phase));
      }
    } catch (err) {
      console.error(`[increment] ${table} query failed`, err);
    }
  }

  let pending = 0, running = 0, completed = 0;
  for (const cat of Array.from(byKey.values())) {
    if (cat === "pending") pending++;
    else if (cat === "running") running++;
    else if (cat === "completed") completed++;
  }
  const total = byKey.size;
  if (total === 0) missing.tasks = true;
  return { totalTasks: total, pendingTasks: pending, runningTasks: running, completedTasks: completed };
}

async function computeNotices(employeeId: string, from: Date, to: Date) {
  const notices: IncrementMetrics["notices"] = [];
  try {
    const { rows } = await pool.query(
      `select na.assigned_at, na.read_status::text as read_status,
              n.title, n.status::text as notice_status, n.assigned_by_user_id::text as assigned_by
         from drm.notice_assignments na
         left join drm.notices n on n.id = na.notice_id
        where na.user_id::text = $1::text
          and na.assigned_at >= $2 and na.assigned_at <= $3
        order by na.assigned_at desc`,
      [employeeId, from, to],
    );
    for (const r of rows) {
      notices.push({
        title: r.title ?? null,
        assignedAt: r.assigned_at ? new Date(r.assigned_at).toISOString() : null,
        readStatus: r.read_status ?? null,
        status: r.notice_status ?? null,
        assignedByUserId: r.assigned_by ?? null,
      });
    }
  } catch (err) {
    console.error("[increment] notices query failed", err);
  }
  return { noticeCount: notices.length, notices };
}

async function computeIncrementHistory(employeeId: string, user: UserRecord, from: Date) {
  let lastIncrementDate: string | null = null;
  let lastIncrementType: string | null = null;
  let lastIncrementValue: number | null = null;
  let lastApprovedEffective: Date | null = null;
  try {
    const { rows } = await pool.query(
      `select effective_date, approved_at, proposed_increment_type, proposed_increment_value
         from drm.increment_evaluations
        where employee_id::text = $1::text and status = 'APPROVED'
        order by coalesce(effective_date, approved_at, created_at) desc
        limit 1`,
      [employeeId],
    );
    if (rows[0]) {
      const eff = rows[0].effective_date || rows[0].approved_at;
      if (eff) {
        lastApprovedEffective = new Date(eff);
        lastIncrementDate = new Date(eff).toISOString().slice(0, 10);
      }
      lastIncrementType = rows[0].proposed_increment_type ?? null;
      lastIncrementValue = toNum(rows[0].proposed_increment_value);
    }
  } catch (err) {
    console.error("[increment] history query failed", err);
  }

  // increment cycle start date
  let incrementCycleStartDate: string | null = null;
  if (lastApprovedEffective) {
    const d = new Date(lastApprovedEffective.getTime() + DAY_MS);
    incrementCycleStartDate = d.toISOString().slice(0, 10);
  } else if (user.joinDate) {
    incrementCycleStartDate = user.joinDate;
  } else {
    incrementCycleStartDate = from.toISOString().slice(0, 10);
  }
  return { lastIncrementDate, lastIncrementType, lastIncrementValue, incrementCycleStartDate };
}

function evaluateEligibility(m: {
  missing: Record<string, boolean>;
  incrementMin: number;
  incrementLeaves: number;
  allowedLeaves: number;
  totalTasks: number;
  completedTasks: number;
  noticeCount: number;
  attendanceRecordCount: number;
}): { status: IncrementMetrics["eligibilityStatus"]; reasons: string[] } {
  const hasAttendance = m.attendanceRecordCount > 0;
  const hasTasks = m.totalTasks > 0;
  const completionRate = hasTasks ? m.completedTasks / m.totalTasks : null;
  const reasons: string[] = [];

  // Missing Data: no salary AND no work signal at all.
  if (m.missing.salary && !hasAttendance && !hasTasks) {
    return { status: "Missing Data", reasons: ["No salary, attendance, or task data available for this period"] };
  }

  // Not Eligible (hard conditions)
  const veryHighLeaves = m.incrementLeaves > m.allowedLeaves;
  const veryLowCompletion = hasTasks && (completionRate as number) < 0.5;
  const excessiveNotices = m.noticeCount > Math.max(INCREMENT_CONFIG.maxNoticeCount, 2);
  const noMeaningfulWork = !hasAttendance && !hasTasks && m.incrementMin <= 0;
  if (veryHighLeaves) reasons.push(`Excess leaves (${m.incrementLeaves}) above allowed (${m.allowedLeaves})`);
  if (veryLowCompletion) reasons.push(`Task completion below 50% (${Math.round((completionRate as number) * 100)}%)`);
  if (excessiveNotices) reasons.push(`Excessive notices (${m.noticeCount})`);
  if (noMeaningfulWork) reasons.push("No meaningful work records in this period");
  if (veryHighLeaves || veryLowCompletion || excessiveNotices || noMeaningfulWork) {
    return { status: "Not Eligible", reasons };
  }

  // Eligible conditions (spec §8)
  const okMinutes = m.incrementMin > 0;
  const okLeaves = m.incrementLeaves <= 0;
  const okTasks = !hasTasks || (completionRate as number) >= INCREMENT_CONFIG.minCompletionRate;
  const okNotices = m.noticeCount <= INCREMENT_CONFIG.maxNoticeCount;
  if (okMinutes && okLeaves && okTasks && okNotices && !m.missing.salary) {
    return { status: "Eligible", reasons: ["Meets minutes, leave, task-completion and discipline thresholds"] };
  }

  // Otherwise Review Required
  if (!okMinutes) reasons.push("Increment-eligible minutes are zero");
  if (!okLeaves) reasons.push(`Leave deduction applies (${m.incrementLeaves} increment leaves)`);
  if (hasTasks && !okTasks) reasons.push(`Task completion below ${Math.round(INCREMENT_CONFIG.minCompletionRate * 100)}%`);
  if (!okNotices) reasons.push(`Has ${m.noticeCount} notice(s)`);
  if (m.missing.salary) reasons.push("Salary data missing");
  if (reasons.length === 0) reasons.push("Partial data — manager review recommended");
  return { status: "Review Required", reasons };
}

export async function computeMetrics(user: UserRecord, from: Date, to: Date): Promise<IncrementMetrics> {
  const missing: Record<string, boolean> = {};
  const cols = await getUserColumns();
  if (!has(cols, "basic_salary")) missing.salaryColumn = true;
  if (!has(cols, "relaxation_minutes")) missing.relaxationColumn = true;
  if (!has(cols, "join_date")) missing.joinDateColumn = true;

  const employeeId = user.id;
  const { basicSalary, perDaySalary } = await computeSalary(user, missing);

  const att = await computeAttendance(employeeId, from, to, missing);
  const approvedLeaveDays = await computeApprovedLeaveDays(employeeId, from, to);

  const months = monthsInRange(from, to);
  const allowedLeaves = months * INCREMENT_CONFIG.allowedLeavesPerMonth;
  const totalLeaveDays = round2(approvedLeaveDays + att.absentDays + att.halfDays * 0.5);
  const incrementLeaves = round2(Math.max(0, totalLeaveDays - allowedLeaves));
  const leaveDeductionAmount = perDaySalary === null ? null : round2(incrementLeaves * perDaySalary);

  // relaxation minutes
  let relaxationMin = 0;
  if (user.relaxationMinutes === null) missing.relaxation = true;
  else relaxationMin = user.relaxationMinutes;
  const incrementMin = Math.max(0, att.totalMin - relaxationMin);

  const tasks = await computeTaskStats(employeeId, from, to, missing);
  const noticesRes = await computeNotices(employeeId, from, to);
  const history = await computeIncrementHistory(employeeId, user, from);

  const elig = evaluateEligibility({
    missing,
    incrementMin,
    incrementLeaves,
    allowedLeaves,
    totalTasks: tasks.totalTasks,
    completedTasks: tasks.completedTasks,
    noticeCount: noticesRes.noticeCount,
    attendanceRecordCount: att.attendanceRecordCount,
  } as any);

  return {
    employee: user,
    basicSalary,
    perDaySalary,
    approvedLeaveDays: round2(approvedLeaveDays),
    absentDays: att.absentDays,
    halfDays: att.halfDays,
    lateDays: att.lateDays,
    presentDays: att.presentDays,
    totalLeaveDays,
    allowedLeaves,
    incrementLeaves,
    leaveDeductionAmount,
    monthsInRange: months,
    totalMin: att.totalMin,
    relaxationMin,
    incrementMin,
    attendanceRecordCount: att.attendanceRecordCount,
    totalTasks: tasks.totalTasks,
    pendingTasks: tasks.pendingTasks,
    runningTasks: tasks.runningTasks,
    completedTasks: tasks.completedTasks,
    noticeCount: noticesRes.noticeCount,
    notices: noticesRes.notices,
    lastIncrementDate: history.lastIncrementDate,
    lastIncrementType: history.lastIncrementType,
    lastIncrementValue: history.lastIncrementValue,
    incrementCycleStartDate: history.incrementCycleStartDate,
    eligibilityStatus: elig.status,
    eligibilityReasons: elig.reasons,
    missingData: missing,
  };
}

// ─── Report row shaping (spec response §report) ──────────────────────────────
export interface ReportRow {
  no: number;
  employeeId: string;
  name: string;
  salary: number | null;
  leavesPerDayText: string;
  leaveDeductionAmount: number | null;
  totalMin: number;
  relaxationMin: number;
  incrementMin: number;
  totalLeavesText: string;
  incrementLeaves: number;
  fullDetail: string;
  noticeCount: number;
  lastIncrementDate: string | null;
  incrementCycleStartDate: string | null;
  eligibilityStatus: string;
  missingData: Record<string, boolean>;
  actionState: { canDecide: boolean; reason: string | null };
}

function toReportRow(m: IncrementMetrics, no: number): ReportRow {
  const perDayText = m.perDaySalary === null ? "—" : String(Math.round(m.perDaySalary));
  const hasCriticalMissing = !!m.missingData.salary;
  return {
    no,
    employeeId: m.employee.id,
    name: m.employee.fullName || m.employee.name || m.employee.email || "Unknown",
    salary: m.basicSalary,
    leavesPerDayText: `${m.incrementLeaves} x ${perDayText}`,
    leaveDeductionAmount: m.leaveDeductionAmount,
    totalMin: m.totalMin,
    relaxationMin: m.relaxationMin,
    incrementMin: m.incrementMin,
    totalLeavesText: `Leaves (${m.totalLeaveDays} - ${m.allowedLeaves}) = ${m.incrementLeaves}`,
    incrementLeaves: m.incrementLeaves,
    fullDetail: `Total Task ${m.totalTasks} / Pending ${m.pendingTasks} / Running ${m.runningTasks} / Completed ${m.completedTasks}`,
    noticeCount: m.noticeCount,
    lastIncrementDate: m.lastIncrementDate,
    incrementCycleStartDate: m.incrementCycleStartDate,
    eligibilityStatus: m.eligibilityStatus,
    missingData: m.missingData,
    actionState: {
      canDecide: !hasCriticalMissing,
      reason: hasCriticalMissing ? "Salary data is missing — cannot finalize a decision" : null,
    },
  };
}

export interface ReportResult {
  dateRange: { startDate: string; endDate: string };
  summary: {
    totalEmployees: number;
    eligibleCount: number;
    reviewRequiredCount: number;
    notEligibleCount: number;
    missingDataCount: number;
  };
  rows: ReportRow[];
  page: number;
  limit: number;
  total: number;
  config: typeof INCREMENT_CONFIG;
}

export async function buildReport(
  users: UserRecord[],
  from: Date,
  to: Date,
  opts: { page?: number; limit?: number; search?: string } = {},
): Promise<ReportResult> {
  const search = (opts.search || "").trim().toLowerCase();
  const filtered = search
    ? users.filter((u) =>
        [u.fullName, u.name, u.email].some((v) => (v || "").toLowerCase().includes(search)),
      )
    : users;

  const page = Math.max(1, opts.page || 1);
  const limit = Math.min(200, Math.max(1, opts.limit || 30));
  const start = (page - 1) * limit;

  // Compute metrics for the full filtered set so the summary counts reflect the
  // whole dataset, not just the current page. Rows are then sliced for pagination.
  const allMetrics = await Promise.all(filtered.map((u) => computeMetrics(u, from, to)));

  let eligibleCount = 0, reviewRequiredCount = 0, notEligibleCount = 0, missingDataCount = 0;
  for (const m of allMetrics) {
    if (m.eligibilityStatus === "Eligible") eligibleCount++;
    else if (m.eligibilityStatus === "Review Required") reviewRequiredCount++;
    else if (m.eligibilityStatus === "Not Eligible") notEligibleCount++;
    else missingDataCount++;
  }

  const rows: ReportRow[] = allMetrics
    .slice(start, start + limit)
    .map((m, i) => toReportRow(m, start + 1 + i));

  return {
    dateRange: { startDate: from.toISOString().slice(0, 10), endDate: to.toISOString().slice(0, 10) },
    summary: {
      totalEmployees: filtered.length,
      eligibleCount,
      reviewRequiredCount,
      notEligibleCount,
      missingDataCount,
    },
    rows,
    page,
    limit,
    total: filtered.length,
    config: INCREMENT_CONFIG,
  };
}

// ─── Detail (spec §detail) ───────────────────────────────────────────────────
export async function buildDetail(user: UserRecord, from: Date, to: Date) {
  const m = await computeMetrics(user, from, to);
  const history = await getHistory(user.id);
  return {
    employee: {
      id: user.id,
      name: user.fullName || user.name,
      email: user.email,
      role: user.role,
      roleId: user.roleId,
      department: user.department,
      designation: user.designation,
      branch: user.branch,
      joinDate: user.joinDate,
      attendanceId: user.attendanceId,
    },
    salary: {
      basicSalary: m.basicSalary,
      perDaySalary: m.perDaySalary,
      leaveDeductionAmount: m.leaveDeductionAmount,
      currentIncrementValue: user.increment,
      recommendedStatus: m.eligibilityStatus,
    },
    attendance: {
      totalWorkingDays: m.presentDays + m.absentDays + m.halfDays + m.lateDays,
      presentDays: m.presentDays,
      lateDays: m.lateDays,
      halfDays: m.halfDays,
      absentDays: m.absentDays,
      approvedLeaveDays: m.approvedLeaveDays,
      attendanceRecords: m.attendanceRecordCount,
    },
    workMinutes: {
      totalMin: m.totalMin,
      relaxationMin: m.relaxationMin,
      incrementMin: m.incrementMin,
    },
    leave: {
      totalLeaveDays: m.totalLeaveDays,
      allowedLeaves: m.allowedLeaves,
      incrementLeaves: m.incrementLeaves,
      leaveDeductionAmount: m.leaveDeductionAmount,
      monthsInRange: m.monthsInRange,
      formula: `incrementLeaves = max(0, totalLeaveDays(${m.totalLeaveDays}) - allowedLeaves(${m.allowedLeaves})) = ${m.incrementLeaves}`,
    },
    taskStats: {
      totalTasks: m.totalTasks,
      pendingTasks: m.pendingTasks,
      runningTasks: m.runningTasks,
      completedTasks: m.completedTasks,
    },
    notices: {
      noticeCount: m.noticeCount,
      list: m.notices,
    },
    incrementHistory: {
      lastIncrementDate: m.lastIncrementDate,
      lastIncrementType: m.lastIncrementType,
      lastIncrementValue: m.lastIncrementValue,
      incrementCycleStartDate: m.incrementCycleStartDate,
      previousDecisions: history,
    },
    recommendation: {
      eligibilityStatus: m.eligibilityStatus,
      reasons: m.eligibilityReasons,
    },
    missingData: m.missingData,
    config: INCREMENT_CONFIG,
  };
}

// ─── Persistence ─────────────────────────────────────────────────────────────
export async function getHistory(employeeId: string) {
  try {
    const { rows } = await pool.query(
      `select e.id::text as id, e.review_start_date as "reviewStartDate", e.review_end_date as "reviewEndDate",
              e.status, e.current_salary as "previousSalary",
              e.proposed_increment_type as "proposedIncrementType",
              e.proposed_increment_value as "proposedIncrementValue",
              e.effective_date as "effectiveDate",
              e.reviewed_by::text as "reviewedById",
              coalesce(r.full_name, r.name) as "reviewedBy",
              coalesce(e.manager_remarks, '') as remarks,
              e.rejection_reason as "rejectionReason",
              e.created_at as "createdAt", e.approved_at as "approvedAt"
         from drm.increment_evaluations e
         left join drm.users r on r.id = e.reviewed_by
        where e.employee_id::text = $1::text
        order by e.created_at desc`,
      [employeeId],
    );
    return rows;
  } catch (err) {
    console.error("[increment] getHistory failed", err);
    return [];
  }
}

export interface SaveEvaluationInput {
  employeeId: string;
  calculatedBy: string;
  from: Date;
  to: Date;
  recommendedStatus?: string;
  proposedIncrementType?: string;
  proposedIncrementValue?: number | null;
  managerRemarks?: string;
}

export async function saveEvaluation(user: UserRecord, input: SaveEvaluationInput) {
  const m = await computeMetrics(user, input.from, input.to);
  const snapshot = m;
  const { rows } = await pool.query(
    `insert into drm.increment_evaluations
       (employee_id, calculated_by, review_start_date, review_end_date,
        current_salary, per_day_salary, leave_days, allowed_leave_days, increment_leaves,
        leave_deduction_amount, total_minutes, relaxation_minutes, increment_minutes,
        total_tasks, pending_tasks, running_tasks, completed_tasks, notice_count,
        eligibility_status, proposed_increment_type, proposed_increment_value,
        status, manager_remarks, calculation_snapshot, missing_data)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
     returning id::text as id, status, eligibility_status as "eligibilityStatus", created_at as "createdAt"`,
    [
      input.employeeId,
      input.calculatedBy,
      input.from.toISOString().slice(0, 10),
      input.to.toISOString().slice(0, 10),
      m.basicSalary,
      m.perDaySalary,
      m.totalLeaveDays,
      m.allowedLeaves,
      m.incrementLeaves,
      m.leaveDeductionAmount,
      m.totalMin,
      m.relaxationMin,
      m.incrementMin,
      m.totalTasks,
      m.pendingTasks,
      m.runningTasks,
      m.completedTasks,
      m.noticeCount,
      input.recommendedStatus || m.eligibilityStatus,
      input.proposedIncrementType ?? null,
      input.proposedIncrementValue ?? null,
      "PENDING",
      input.managerRemarks ?? null,
      JSON.stringify(snapshot),
      JSON.stringify(m.missingData),
    ],
  );
  return rows[0];
}

export type DecisionStatus = "APPROVED" | "HOLD" | "REJECTED";

export async function applyDecision(
  evaluationId: string,
  reviewerId: string,
  input: {
    status: DecisionStatus;
    proposedIncrementType?: string;
    proposedIncrementValue?: number | null;
    effectiveDate?: string | null;
    remarks?: string;
  },
) {
  const sets: string[] = [
    "status = $2",
    "reviewed_by = $3",
    "updated_at = now()",
  ];
  const params: any[] = [evaluationId, input.status, reviewerId];

  if (input.proposedIncrementType !== undefined) {
    params.push(input.proposedIncrementType);
    sets.push(`proposed_increment_type = $${params.length}`);
  }
  if (input.proposedIncrementValue !== undefined) {
    params.push(input.proposedIncrementValue);
    sets.push(`proposed_increment_value = $${params.length}`);
  }
  if (input.status === "APPROVED") {
    params.push(input.effectiveDate ?? null);
    sets.push(`effective_date = $${params.length}`);
    sets.push(`approved_at = now()`);
    if (input.remarks !== undefined) {
      params.push(input.remarks);
      sets.push(`manager_remarks = $${params.length}`);
    }
  } else if (input.status === "REJECTED") {
    params.push(input.remarks ?? null);
    sets.push(`rejection_reason = $${params.length}`);
  } else {
    // HOLD
    if (input.remarks !== undefined) {
      params.push(input.remarks);
      sets.push(`manager_remarks = $${params.length}`);
    }
  }

  const { rows } = await pool.query(
    `update drm.increment_evaluations set ${sets.join(", ")}
      where id::text = $1::text
      returning id::text as id, employee_id::text as "employeeId", status,
                effective_date as "effectiveDate", approved_at as "approvedAt"`,
    params,
  );
  return rows[0] ?? null;
}

export async function getEvaluationOwner(evaluationId: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `select employee_id::text as "employeeId" from drm.increment_evaluations where id::text = $1::text limit 1`,
      [evaluationId],
    );
    return rows[0]?.employeeId ?? null;
  } catch {
    return null;
  }
}

export async function fetchUserById(id: string): Promise<UserRecord | null> {
  const select = await userSelectColumns();
  const { rows } = await pool.query(`select ${select} from drm.users where id::text = $1::text limit 1`, [id]);
  return rows[0] ? mapUserRow(rows[0]) : null;
}
