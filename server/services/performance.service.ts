/**
 * Performance System service.
 *
 * Read-only. Calculates an employee performance score from EXISTING DRM data
 * across multiple modules using the formula:
 *   Final = 40% Work Completion + 30% Quality + 20% Target Achievement + 10% Timeliness
 *
 * Missing data is handled honestly: a component with no usable data returns a
 * null score, is listed in `missingMetrics`, and the final score is normalized
 * over the available component weights (see calculateFinalScore).
 *
 * Each source adapter never throws on empty/missing tables; it returns [] so a
 * department with no rows simply contributes nothing rather than failing.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { pool } from "../db";

// Request-scoped collector for adapter failures. A thrown query error (missing
// table/column, bad cast, etc.) is a genuine failure that must NOT be silently
// turned into "no data" — it is recorded here and surfaced to the caller as
// `dataWarnings` / `partialDataFailure` so the UI can distinguish "no rows" from
// "a source failed to load".
const perfWarnings = new AsyncLocalStorage<string[]>();

function adapterCatch(label: string, e: any): void {
  const code = e?.code ? ` [${e.code}]` : "";
  console.warn(`[performance] ${label} skipped:${code}`, e?.message);
  const store = perfWarnings.getStore();
  if (store) store.push(`${label}: ${e?.message || "query failed"}${code}`);
}

export interface PerfRecord {
  sourceModule: string;
  sourceId: string;
  activityType: string;
  clientCompany: string | null;
  title: string | null;
  taskValue: number | null;
  status: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  dueAt: string | null;
  isCompleted: boolean;
  isApproved: boolean;
  isRejected: boolean;
  isReturned: boolean;
  revisionCount: number;
  isOnTime: boolean | null;
  remarks: string | null;
  // internal flags (not part of the public record contract)
  _assignable: boolean;
  _reviewable: boolean;
}

export interface ComponentResult {
  weight: number;
  score: number | null;
  weightedScore: number | null;
  status: "available" | "N/A";
  details: string;
  [key: string]: any;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const iso = (v: any): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

// The set of "approval" columns on drm.gm_entries differs between the Drizzle
// schema (shared/schema.ts) and the live database, so we detect which columns
// actually exist at runtime and build the approval predicate (and SELECT list)
// only from those. This keeps every gm_entries query schema-grounded and avoids
// referencing a non-existent column.
const GM_APPROVAL_COLS = ["approval_status", "final_status", "hod_status", "super_hod_status"] as const;
let _gmColsCache: Set<string> | null = null;
async function getGmColumns(): Promise<Set<string>> {
  if (_gmColsCache) return _gmColsCache;
  try {
    const { rows } = await pool.query(
      `select column_name from information_schema.columns
        where table_schema = 'drm' and table_name = 'gm_entries'`,
    );
    _gmColsCache = new Set(rows.map((r: any) => String(r.column_name)));
  } catch {
    _gmColsCache = new Set<string>(["status"]);
  }
  return _gmColsCache;
}
async function gmApprovedClause(): Promise<string> {
  const cols = await getGmColumns();
  const parts: string[] = [];
  if (cols.has("status")) parts.push(`lower(coalesce(status::text,'')) in ('approved','completed')`);
  if (cols.has("approval_status")) parts.push(`lower(coalesce(approval_status::text,'')) in ('approved','approved_by_account')`);
  if (cols.has("final_status")) parts.push(`lower(coalesce(final_status::text,'')) = 'approved'`);
  if (cols.has("hod_status")) parts.push(`lower(coalesce(hod_status::text,'')) = 'approved'`);
  if (cols.has("super_hod_status")) parts.push(`lower(coalesce(super_hod_status::text,'')) = 'approved'`);
  return parts.length ? `(${parts.join(" or ")})` : `(false)`;
}
function gmApprovalSelectCols(cols: Set<string>): string {
  const out = GM_APPROVAL_COLS.filter((c) => cols.has(c));
  return out.length ? ", " + out.map((c) => `${c}::text as ${c}`).join(", ") : "";
}

// ----------------------------------------------------------------------------
// Source adapters. Signature: (userId, from, to) => PerfRecord[]
// ----------------------------------------------------------------------------

export async function getSalesPerformanceData(userId: string, from: Date, to: Date): Promise<PerfRecord[]> {
  const records: PerfRecord[] = [];
  // GM / BV entries (achievement + approval quality signal; not "assignable" work)
  try {
    const cols = await getGmColumns();
    const approvedClause = await gmApprovedClause();
    const { rows } = await pool.query(
      `select id, company_name, amount_usd, status::text as status${gmApprovalSelectCols(cols)},
              created_at, approved_at,
              ${approvedClause} as is_approved
         from drm.gm_entries
        where coalesce(is_deleted,false) = false
          and (sales_person_id::text = $1::text or created_by::text = $1::text)
          and created_at between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      const approved = r.is_approved === true;
      const rejected = String(r.status).toLowerCase() === "rejected";
      records.push({
        sourceModule: "sales",
        sourceId: String(r.id),
        activityType: "GM Entry",
        clientCompany: r.company_name ?? null,
        title: r.company_name ?? "GM Entry",
        taskValue: num(r.amount_usd),
        status: r.status ?? null,
        assignedAt: iso(r.created_at),
        completedAt: approved ? iso(r.approved_at ?? r.created_at) : null,
        dueAt: null,
        isCompleted: approved,
        isApproved: approved,
        isRejected: rejected,
        isReturned: false,
        revisionCount: 0,
        isOnTime: null,
        remarks: null,
        _assignable: false,
        _reviewable: true,
      });
    }
  } catch (e: any) {
    adapterCatch("sales gm_entries adapter skipped", e);
  }
  // Follow-ups (assignable work: Open vs Completed, has a due date)
  try {
    const { rows } = await pool.query(
      `select id, status, method, due_at, date_time, created_at, updated_at
         from drm.follow_ups
        where coalesce(is_deleted,false) = false
          and (assigned_to::text = $1::text or created_by::text = $1::text)
          and coalesce(date_time, due_at, created_at) between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      const completed = String(r.status ?? "").toLowerCase() === "completed";
      const due = r.due_at ? new Date(r.due_at) : null;
      const done = completed ? new Date(r.updated_at ?? r.date_time ?? r.created_at) : null;
      records.push({
        sourceModule: "sales",
        sourceId: String(r.id),
        activityType: "Follow-up",
        clientCompany: null,
        title: r.method ? `Follow-up (${r.method})` : "Follow-up",
        taskValue: null,
        status: r.status ?? null,
        assignedAt: iso(r.created_at),
        completedAt: iso(done),
        dueAt: iso(due),
        isCompleted: completed,
        isApproved: false,
        isRejected: false,
        isReturned: false,
        revisionCount: 0,
        isOnTime: completed && due && done ? done.getTime() <= due.getTime() : null,
        remarks: null,
        _assignable: true,
        _reviewable: false,
      });
    }
  } catch (e: any) {
    adapterCatch("sales follow_ups adapter skipped", e);
  }
  // Activities (logged completed actions; context only, not assignable/reviewed)
  try {
    const { rows } = await pool.query(
      `select id, type, activity_date, duration_minutes, notes
         from drm.activities
        where coalesce(is_deleted,false) = false
          and created_by::text = $1::text
          and activity_date between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      records.push({
        sourceModule: "sales",
        sourceId: String(r.id),
        activityType: r.type ? `Activity: ${r.type}` : "Activity",
        clientCompany: null,
        title: r.type ?? "Activity",
        taskValue: null,
        status: "Logged",
        assignedAt: iso(r.activity_date),
        completedAt: iso(r.activity_date),
        dueAt: null,
        isCompleted: true,
        isApproved: false,
        isRejected: false,
        isReturned: false,
        revisionCount: 0,
        isOnTime: null,
        remarks: r.notes ?? null,
        _assignable: false,
        _reviewable: false,
      });
    }
  } catch (e: any) {
    adapterCatch("sales activities adapter skipped", e);
  }
  return records;
}

export async function getPmsPerformanceData(userId: string, from: Date, to: Date): Promise<PerfRecord[]> {
  const records: PerfRecord[] = [];
  try {
    const { rows } = await pool.query(
      `select t.id, t.title, t.status::text as status, t.start_date, t.due_date, t.created_at,
              p.name as project_name,
              (select max(h.changed_at) from drm.task_status_history h
                 where h.task_id::text = t.id::text and h.to_status::text = 'Completed') as completed_at
         from drm.tasks t
         left join drm.projects p on p.id::text = t.project_id::text
        where coalesce(t.is_deleted,false) = false
          and (t.assigned_to_user_id::text = $1::text or t.owner_user_id::text = $1::text)
          and t.created_at between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      const completed = String(r.status ?? "") === "Completed";
      const due = r.due_date ? new Date(r.due_date) : null;
      const done = r.completed_at ? new Date(r.completed_at) : completed ? new Date(r.created_at) : null;
      records.push({
        sourceModule: "pms",
        sourceId: String(r.id),
        activityType: "Task",
        clientCompany: r.project_name ?? null,
        title: r.title ?? "Task",
        taskValue: null,
        status: r.status ?? null,
        assignedAt: iso(r.start_date ?? r.created_at),
        completedAt: iso(done),
        dueAt: iso(due),
        isCompleted: completed,
        isApproved: false,
        isRejected: false,
        isReturned: String(r.status ?? "") === "Blocked",
        revisionCount: 0,
        isOnTime: completed && due && done ? done.getTime() <= due.getTime() : null,
        remarks: null,
        _assignable: true,
        _reviewable: false,
      });
    }
  } catch (e: any) {
    adapterCatch("pms adapter skipped", e);
  }
  return records;
}

async function getWorkflowPerformanceData(
  table: "product_posting_workflows" | "software_workflows",
  moduleName: string,
  activityType: string,
  userId: string,
  from: Date,
  to: Date,
): Promise<PerfRecord[]> {
  const records: PerfRecord[] = [];
  try {
    const { rows } = await pool.query(
      `select w.id, w.current_phase, w.assigned_at, w.assigned_duration_minutes,
              w.executive_submitted_at, w.manager_completed_at, w.qa_reviewed_at, w.verification_reviewed_at,
              coalesce(w.return_count,0) as return_count, w.last_return_reason, w.created_at,
              p.name as project_name
         from drm.${table} w
         left join drm.projects p on p.id::text = w.project_id::text
        where (w.executive_user_id::text = $1::text or w.manager_user_id::text = $1::text
               or w.qa_user_id::text = $1::text or w.verification_user_id::text = $1::text)
          and w.created_at between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      const completedRaw = r.verification_reviewed_at ?? r.qa_reviewed_at ?? r.manager_completed_at ?? r.executive_submitted_at;
      const done = completedRaw ? new Date(completedRaw) : null;
      const returns = Number(r.return_count ?? 0);
      const reviewed = !!(r.qa_reviewed_at || r.verification_reviewed_at);
      let due: Date | null = null;
      if (r.assigned_at && r.assigned_duration_minutes != null) {
        due = new Date(new Date(r.assigned_at).getTime() + Number(r.assigned_duration_minutes) * 60000);
      }
      records.push({
        sourceModule: moduleName,
        sourceId: String(r.id),
        activityType,
        clientCompany: r.project_name ?? null,
        title: r.project_name ? `${activityType}: ${r.project_name}` : activityType,
        taskValue: null,
        status: r.current_phase ?? null,
        assignedAt: iso(r.assigned_at ?? r.created_at),
        completedAt: iso(done),
        dueAt: iso(due),
        isCompleted: !!done,
        isApproved: reviewed && returns === 0,
        isRejected: false,
        isReturned: returns > 0,
        revisionCount: returns,
        isOnTime: done && due ? done.getTime() <= due.getTime() : null,
        remarks: r.last_return_reason ?? null,
        _assignable: true,
        _reviewable: reviewed || returns > 0,
      });
    }
  } catch (e: any) {
    adapterCatch(`${table} adapter`, e);
  }
  return records;
}

export const getProductPostingPerformanceData = (userId: string, from: Date, to: Date) =>
  getWorkflowPerformanceData("product_posting_workflows", "product_posting", "Product Posting", userId, from, to);

export const getSoftwarePerformanceData = (userId: string, from: Date, to: Date) =>
  getWorkflowPerformanceData("software_workflows", "software", "Software Workflow", userId, from, to);

export async function getServicePerformanceData(userId: string, from: Date, to: Date): Promise<PerfRecord[]> {
  const records: PerfRecord[] = [];
  // Complaints (assignable; resolved/closed = completed)
  try {
    const { rows } = await pool.query(
      `select id, title, status::text as status, priority, resolved_at, created_at
         from drm.service_complaints
        where assigned_to::text = $1::text
          and created_at between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      const st = String(r.status ?? "").toLowerCase();
      const completed = st === "resolved" || st === "closed";
      records.push({
        sourceModule: "service",
        sourceId: String(r.id),
        activityType: "Complaint",
        clientCompany: null,
        title: r.title ?? "Complaint",
        taskValue: null,
        status: r.status ?? null,
        assignedAt: iso(r.created_at),
        completedAt: iso(r.resolved_at),
        dueAt: null,
        isCompleted: completed,
        isApproved: false,
        isRejected: false,
        isReturned: false,
        revisionCount: 0,
        isOnTime: null,
        remarks: r.priority ? `Priority: ${r.priority}` : null,
        _assignable: true,
        _reviewable: false,
      });
    }
  } catch (e: any) {
    adapterCatch("service_complaints adapter skipped", e);
  }
  // Service activities (context; carry target/achieved for target-achievement)
  try {
    const { rows } = await pool.query(
      `select id, method, target_value, achieved_value, activity_date, remarks
         from drm.service_activities
        where user_id::text = $1::text
          and activity_date between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      records.push({
        sourceModule: "service",
        sourceId: String(r.id),
        activityType: r.method ? `Service Activity (${r.method})` : "Service Activity",
        clientCompany: null,
        title: "Service Activity",
        taskValue: num(r.achieved_value),
        status: "Logged",
        assignedAt: iso(r.activity_date),
        completedAt: iso(r.activity_date),
        dueAt: null,
        isCompleted: true,
        isApproved: false,
        isRejected: false,
        isReturned: false,
        revisionCount: 0,
        isOnTime: null,
        remarks: r.remarks ?? null,
        _assignable: false,
        _reviewable: false,
      });
    }
  } catch (e: any) {
    adapterCatch("service_activities adapter skipped", e);
  }
  // Dropout recoveries (context)
  try {
    const { rows } = await pool.query(
      `select id, status::text as status, reason, recovered_at, created_at
         from drm.service_dropouts
        where created_by::text = $1::text
          and created_at between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      const recovered = String(r.status ?? "").toLowerCase() === "recovered";
      records.push({
        sourceModule: "service",
        sourceId: String(r.id),
        activityType: "Dropout Recovery",
        clientCompany: null,
        title: "Dropout Recovery",
        taskValue: null,
        status: r.status ?? null,
        assignedAt: iso(r.created_at),
        completedAt: iso(r.recovered_at),
        dueAt: null,
        isCompleted: recovered,
        isApproved: false,
        isRejected: false,
        isReturned: false,
        revisionCount: 0,
        isOnTime: null,
        remarks: r.reason ?? null,
        _assignable: true,
        _reviewable: false,
      });
    }
  } catch (e: any) {
    adapterCatch("service_dropouts adapter skipped", e);
  }
  return records;
}

export async function getSupportPerformanceData(userId: string, from: Date, to: Date): Promise<PerfRecord[]> {
  const records: PerfRecord[] = [];
  try {
    const { rows } = await pool.query(
      `select id, subject, status::text as status, priority, created_at, updated_at
         from drm.support_tickets
        where coalesce(is_deleted,false) = false
          and assigned_to_user_id::text = $1::text
          and created_at between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      const st = String(r.status ?? "");
      const completed = st === "Resolved";
      const failed = st === "Failed";
      records.push({
        sourceModule: "support",
        sourceId: String(r.id),
        activityType: "Support Ticket",
        clientCompany: null,
        title: r.subject ?? "Support Ticket",
        taskValue: null,
        status: r.status ?? null,
        assignedAt: iso(r.created_at),
        completedAt: completed ? iso(r.updated_at) : null,
        dueAt: null,
        isCompleted: completed,
        isApproved: completed,
        isRejected: failed,
        isReturned: false,
        revisionCount: 0,
        isOnTime: null,
        remarks: r.priority ? `Priority: ${r.priority}` : null,
        _assignable: true,
        _reviewable: completed || failed,
      });
    }
  } catch (e: any) {
    adapterCatch("support adapter skipped", e);
  }
  return records;
}

export async function getCallSessionsPerformanceData(userId: string, from: Date, to: Date): Promise<PerfRecord[]> {
  const records: PerfRecord[] = [];
  try {
    const { rows } = await pool.query(
      `select id, status::text as status, direction, started_at, ended_at, duration_seconds, created_at
         from drm.call_sessions
        where (user_id::text = $1::text or assigned_to::text = $1::text)
          and coalesce(started_at, created_at) between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      const completed = !!r.ended_at;
      records.push({
        sourceModule: "sales",
        sourceId: String(r.id),
        activityType: r.direction ? `Call (${r.direction})` : "Call",
        clientCompany: null,
        title: "Call Session",
        taskValue: num(r.duration_seconds),
        status: r.status ?? (completed ? "ended" : "started"),
        assignedAt: iso(r.started_at ?? r.created_at),
        completedAt: iso(r.ended_at),
        dueAt: null,
        isCompleted: completed,
        isApproved: false,
        isRejected: false,
        isReturned: false,
        revisionCount: 0,
        isOnTime: null,
        remarks: null,
        _assignable: false,
        _reviewable: false,
      });
    }
  } catch (e: any) {
    adapterCatch("call_sessions adapter skipped", e);
  }
  return records;
}

export async function getAppointmentsPerformanceData(userId: string, from: Date, to: Date): Promise<PerfRecord[]> {
  const records: PerfRecord[] = [];
  try {
    const { rows } = await pool.query(
      `select id, starts_at, notes, created_at
         from drm.appointments
        where coalesce(is_deleted,false) = false
          and assigned_to::text = $1::text
          and coalesce(starts_at, created_at) between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      records.push({
        sourceModule: "sales",
        sourceId: String(r.id),
        activityType: "Appointment",
        clientCompany: null,
        title: "Appointment",
        taskValue: null,
        status: "Scheduled",
        assignedAt: iso(r.created_at),
        completedAt: iso(r.starts_at),
        dueAt: null,
        isCompleted: r.starts_at ? new Date(r.starts_at).getTime() <= Date.now() : false,
        isApproved: false,
        isRejected: false,
        isReturned: false,
        revisionCount: 0,
        isOnTime: null,
        remarks: r.notes ?? null,
        _assignable: false,
        _reviewable: false,
      });
    }
  } catch (e: any) {
    adapterCatch("appointments adapter skipped", e);
  }
  return records;
}

export async function getTaskTimeLogsPerformanceData(userId: string, from: Date, to: Date): Promise<PerfRecord[]> {
  const records: PerfRecord[] = [];
  try {
    const { rows } = await pool.query(
      `select l.id, l.duration_minutes, l.notes, l.start_at, l.created_at, t.title
         from drm.task_time_logs l
         left join drm.tasks t on t.id::text = l.task_id::text
        where l.user_id::text = $1::text
          and coalesce(l.start_at, l.created_at) between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      records.push({
        sourceModule: "pms",
        sourceId: String(r.id),
        activityType: "Task Time Log",
        clientCompany: null,
        title: r.title ?? "Task Time Log",
        taskValue: num(r.duration_minutes),
        status: "Logged",
        assignedAt: iso(r.start_at ?? r.created_at),
        completedAt: iso(r.start_at ?? r.created_at),
        dueAt: null,
        isCompleted: true,
        isApproved: false,
        isRejected: false,
        isReturned: false,
        revisionCount: 0,
        isOnTime: null,
        remarks: r.notes ?? null,
        _assignable: false,
        _reviewable: false,
      });
    }
  } catch (e: any) {
    adapterCatch("task_time_logs adapter skipped", e);
  }
  return records;
}

export async function getServiceRenewalsPerformanceData(userId: string, from: Date, to: Date): Promise<PerfRecord[]> {
  const records: PerfRecord[] = [];
  try {
    const { rows } = await pool.query(
      `select id, renewal_type, amount, status::text as status, created_at
         from drm.service_renewals
        where created_by::text = $1::text
          and created_at between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      const completed = String(r.status ?? "").toLowerCase() === "completed";
      records.push({
        sourceModule: "service",
        sourceId: String(r.id),
        activityType: r.renewal_type ? `Renewal (${r.renewal_type})` : "Renewal",
        clientCompany: null,
        title: "Service Renewal",
        taskValue: num(r.amount),
        status: r.status ?? null,
        assignedAt: iso(r.created_at),
        completedAt: completed ? iso(r.created_at) : null,
        dueAt: null,
        isCompleted: completed,
        isApproved: false,
        isRejected: false,
        isReturned: false,
        revisionCount: 0,
        isOnTime: null,
        remarks: null,
        _assignable: false,
        _reviewable: false,
      });
    }
  } catch (e: any) {
    adapterCatch("service_renewals adapter skipped", e);
  }
  return records;
}

async function getReworkHistoryData(
  table: "product_posting_rework_history" | "software_rework_history",
  moduleName: string,
  userId: string,
  from: Date,
  to: Date,
): Promise<PerfRecord[]> {
  const records: PerfRecord[] = [];
  try {
    // Context/visibility only — workflow return_count already feeds the quality
    // penalty, so these rework rows are NOT marked reviewable/returned to avoid
    // double-counting in the score.
    const { rows } = await pool.query(
      `select id, from_phase, to_phase, action, remarks, created_at
         from drm.${table}
        where actor_user_id::text = $1::text
          and created_at between $2 and $3`,
      [userId, from, to],
    );
    for (const r of rows) {
      records.push({
        sourceModule: moduleName,
        sourceId: String(r.id),
        activityType: r.action ? `Rework: ${r.action}` : "Rework",
        clientCompany: null,
        title: [r.from_phase, r.to_phase].filter(Boolean).join(" → ") || "Rework",
        taskValue: null,
        status: r.action ?? null,
        assignedAt: iso(r.created_at),
        completedAt: iso(r.created_at),
        dueAt: null,
        isCompleted: true,
        isApproved: false,
        isRejected: false,
        isReturned: false,
        revisionCount: 0,
        isOnTime: null,
        remarks: r.remarks ?? null,
        _assignable: false,
        _reviewable: false,
      });
    }
  } catch (e: any) {
    adapterCatch(`${table} adapter`, e);
  }
  return records;
}

export const getProductPostingReworkData = (userId: string, from: Date, to: Date) =>
  getReworkHistoryData("product_posting_rework_history", "product_posting", userId, from, to);

export const getSoftwareReworkData = (userId: string, from: Date, to: Date) =>
  getReworkHistoryData("software_rework_history", "software", userId, from, to);

export interface TargetData {
  assignedTarget: number;
  achievedTarget: number;
  hasTarget: boolean;
  details: string;
}

export async function getTargetAchievementData(userId: string, from: Date, to: Date): Promise<TargetData> {
  let assignedTarget = 0;
  let achievedTarget = 0;
  let hasTarget = false;
  const notes: string[] = [];
  // Assigned target from target_system_user_targets (date ranges overlapping window)
  try {
    const { rows } = await pool.query(
      `select coalesce(sum(coalesce(nullif(total,0), nullif(price,0), 0)),0)::float as total, count(*)::int as cnt
         from drm.target_system_user_targets
        where user_id::text = $1::text
          and coalesce(start_date, '-infinity'::timestamp) <= $3
          and coalesce(end_date, 'infinity'::timestamp) >= $2`,
      [userId, from, to],
    );
    const t = Number(rows[0]?.total ?? 0);
    if (Number(rows[0]?.cnt ?? 0) > 0 && t > 0) {
      assignedTarget += t;
      hasTarget = true;
      notes.push(`assigned target ${t} from target system`);
    }
  } catch (e: any) {
    adapterCatch("target_system_user_targets adapter skipped", e);
  }
  // Achieved = approved GM amount in window
  try {
    const approvedClause = await gmApprovedClause();
    const { rows } = await pool.query(
      `select coalesce(sum(coalesce(amount_usd,0)),0)::float as amount
         from drm.gm_entries
        where coalesce(is_deleted,false) = false
          and (sales_person_id::text = $1::text or created_by::text = $1::text)
          and created_at between $2 and $3
          and ${approvedClause}`,
      [userId, from, to],
    );
    achievedTarget += Number(rows[0]?.amount ?? 0);
  } catch (e: any) {
    adapterCatch("gm achieved adapter", e);
  }
  // Service activity targets (additive, only counts as target if values present)
  try {
    const { rows } = await pool.query(
      `select coalesce(sum(coalesce(target_value,0)),0)::float as target,
              coalesce(sum(coalesce(achieved_value,0)),0)::float as achieved
         from drm.service_activities
        where user_id::text = $1::text
          and activity_date between $2 and $3`,
      [userId, from, to],
    );
    const st = Number(rows[0]?.target ?? 0);
    const sa = Number(rows[0]?.achieved ?? 0);
    if (st > 0) {
      assignedTarget += st;
      achievedTarget += sa;
      hasTarget = true;
      notes.push(`service target ${st}`);
    }
  } catch (e: any) {
    adapterCatch("service target adapter skipped", e);
  }
  return {
    assignedTarget: round1(assignedTarget),
    achievedTarget: round1(achievedTarget),
    hasTarget,
    details: hasTarget ? notes.join("; ") : "No assigned targets found for this user in range",
  };
}

export interface AttendanceContext {
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
  totalDays: number;
  overtimeApprovedMinutes: number;
  available: boolean;
}

export async function getAttendanceContext(userId: string, from: Date, to: Date): Promise<AttendanceContext> {
  const ctx: AttendanceContext = {
    present: 0, absent: 0, late: 0, halfDay: 0, leave: 0,
    totalDays: 0, overtimeApprovedMinutes: 0, available: false,
  };
  try {
    const { rows } = await pool.query(
      `select status::text as status, count(*)::int as c, bool_or(coalesce(is_late,false)) as any_late
         from drm.attendance
        where user_id::text = $1::text and date between $2 and $3
        group by status::text`,
      [userId, from, to],
    );
    for (const r of rows) {
      const c = Number(r.c ?? 0);
      ctx.totalDays += c;
      switch (String(r.status)) {
        case "Present": ctx.present += c; break;
        case "Absent": ctx.absent += c; break;
        case "Late": ctx.late += c; break;
        case "HalfDay": ctx.halfDay += c; break;
        case "Leave": ctx.leave += c; break;
      }
    }
    if (rows.length > 0) ctx.available = true;
  } catch (e: any) {
    adapterCatch("attendance context skipped", e);
  }
  // count "Late" flag separately for Present-but-late days
  try {
    const { rows } = await pool.query(
      `select count(*)::int as c from drm.attendance
        where user_id::text = $1::text and date between $2 and $3 and coalesce(is_late,false) = true`,
      [userId, from, to],
    );
    const lateFlag = Number(rows[0]?.c ?? 0);
    if (lateFlag > ctx.late) ctx.late = lateFlag;
  } catch { /* ignore */ }
  try {
    const { rows } = await pool.query(
      `select coalesce(sum(coalesce(time_spent,0)),0)::int as mins
         from drm.overtime_records
        where user_id::text = $1::text and date between $2 and $3 and status::text = 'Approved'`,
      [userId, from, to],
    );
    ctx.overtimeApprovedMinutes = Number(rows[0]?.mins ?? 0);
    if (ctx.overtimeApprovedMinutes > 0) ctx.available = true;
  } catch (e: any) {
    adapterCatch("overtime context skipped", e);
  }
  return ctx;
}

// ----------------------------------------------------------------------------
// Calculation helpers
// ----------------------------------------------------------------------------

export function calculateWorkCompletion(records: PerfRecord[]): ComponentResult {
  const assignable = records.filter((r) => r._assignable);
  const assigned = assignable.length;
  const completed = assignable.filter((r) => r.isCompleted).length;
  if (assigned === 0) {
    return { weight: 40, score: null, weightedScore: null, assigned: 0, completed: 0, status: "N/A", details: "No assignable work items found in range" };
  }
  const score = round1(clamp((completed / assigned) * 100, 0, 100));
  return {
    weight: 40, score, weightedScore: round1(score * 0.4),
    assigned, completed, status: "available",
    details: `${completed}/${assigned} assignable items completed`,
  };
}

export function calculateQuality(records: PerfRecord[]): ComponentResult {
  const reviewable = records.filter((r) => r._reviewable);
  const reviewed = reviewable.length;
  if (reviewed === 0) {
    return { weight: 30, score: null, weightedScore: null, approved: 0, reviewed: 0, rejected: 0, revisions: 0, returns: 0, approvalRate: null, status: "N/A", details: "No reviewed/approved items found in range" };
  }
  const approved = reviewable.filter((r) => r.isApproved).length;
  const rejected = records.filter((r) => r.isRejected).length;
  const returns = records.filter((r) => r.isReturned).length;
  const revisions = records.reduce((s, r) => s + (r.revisionCount || 0), 0);
  const complaints = records.filter((r) => r.sourceModule === "service" && r.activityType === "Complaint" && !r.isCompleted).length;
  const approvalRate = (approved / reviewed) * 100;
  const score = round1(clamp(approvalRate - revisions * 2 - returns * 2 - rejected * 5 - complaints * 5, 0, 100));
  return {
    weight: 30, score, weightedScore: round1(score * 0.3),
    approved, reviewed, rejected, revisions, returns,
    approvalRate: round1(approvalRate), status: "available",
    details: `${approved}/${reviewed} approved; ${revisions} revisions, ${returns} returns, ${rejected} rejected`,
  };
}

export function calculateTargetAchievement(target: TargetData): ComponentResult {
  if (!target.hasTarget || target.assignedTarget <= 0) {
    return { weight: 20, score: null, weightedScore: null, assignedTarget: target.assignedTarget, achievedTarget: target.achievedTarget, status: "N/A", details: target.details };
  }
  const score = round1(clamp((target.achievedTarget / target.assignedTarget) * 100, 0, 100));
  return {
    weight: 20, score, weightedScore: round1(score * 0.2),
    assignedTarget: target.assignedTarget, achievedTarget: target.achievedTarget,
    status: "available", details: `${target.achievedTarget} / ${target.assignedTarget} achieved`,
  };
}

export function calculateTimeliness(records: PerfRecord[]): ComponentResult {
  const completedWithDue = records.filter((r) => r.isCompleted && r.dueAt && r.completedAt);
  const completedItems = completedWithDue.length;
  if (completedItems === 0) {
    return { weight: 10, score: null, weightedScore: null, onTime: 0, late: 0, averageCompletionTime: null, status: "N/A", details: "No completed items with a deadline found in range" };
  }
  const onTime = completedWithDue.filter((r) => r.isOnTime === true).length;
  const late = completedItems - onTime;
  const durations = completedWithDue
    .filter((r) => r.assignedAt && r.completedAt)
    .map((r) => (new Date(r.completedAt!).getTime() - new Date(r.assignedAt!).getTime()) / 86400000)
    .filter((d) => d >= 0);
  const avgDays = durations.length ? round1(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  const score = round1(clamp((onTime / completedItems) * 100, 0, 100));
  return {
    weight: 10, score, weightedScore: round1(score * 0.1),
    onTime, late, averageCompletionTime: avgDays, status: "available",
    details: `${onTime}/${completedItems} completed on time` + (avgDays != null ? `; avg ${avgDays}d` : ""),
  };
}

export interface FinalScoreResult {
  finalScore: number | null;
  normalizedFinalScore: number | null;
  formulaCompletenessPercent: number;
  dataQuality: "complete" | "partial" | "none";
  missingMetrics: string[];
}

export function calculateFinalScore(components: {
  workCompletion: ComponentResult;
  quality: ComponentResult;
  targetAchievement: ComponentResult;
  timeliness: ComponentResult;
}): FinalScoreResult {
  const entries: Array<{ name: string; c: ComponentResult }> = [
    { name: "workCompletion", c: components.workCompletion },
    { name: "quality", c: components.quality },
    { name: "targetAchievement", c: components.targetAchievement },
    { name: "timeliness", c: components.timeliness },
  ];
  const available = entries.filter((e) => e.c.score !== null);
  const missingMetrics = entries.filter((e) => e.c.score === null).map((e) => e.name);
  const availableWeight = available.reduce((s, e) => s + e.c.weight, 0);
  const weightedSum = available.reduce((s, e) => s + (e.c.score as number) * e.c.weight, 0);

  const finalScore = available.length === 4 ? round1(weightedSum / 100) : null;
  const normalizedFinalScore = availableWeight > 0 ? round1(weightedSum / availableWeight) : null;
  const dataQuality = available.length === 4 ? "complete" : available.length === 0 ? "none" : "partial";
  return { finalScore, normalizedFinalScore, formulaCompletenessPercent: availableWeight, dataQuality, missingMetrics };
}

export function getPerformanceRating(score: number | null): string {
  if (score === null) return "No Data";
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Satisfactory";
  if (score >= 40) return "Needs Improvement";
  return "Critical";
}

export function getManagementSuggestions(score: number | null, components: {
  workCompletion: ComponentResult;
  quality: ComponentResult;
  targetAchievement: ComponentResult;
  timeliness: ComponentResult;
}): string[] {
  const out: string[] = [];
  const rating = getPerformanceRating(score);
  switch (rating) {
    case "Excellent": out.push("Eligible for reward, bonus, recognition, or promotion review."); break;
    case "Good": out.push("Continue current performance; consider advanced responsibilities."); break;
    case "Satisfactory": out.push("Monitor and provide improvement guidance."); break;
    case "Needs Improvement": out.push("Training required; manager review recommended."); break;
    case "Critical": out.push("Performance improvement plan required."); break;
    default: out.push("Insufficient data to evaluate performance for this period.");
  }
  const c = components;
  if (c.workCompletion.score !== null && c.workCompletion.score < 60) out.push("Low work completion: review workload, blockers, and task assignment.");
  if (c.quality.score !== null && c.quality.score < 60) out.push("Quality below target: address revisions/returns/rejections and rework causes.");
  if (c.targetAchievement.score !== null && c.targetAchievement.score < 60) out.push("Target achievement below goal: revisit targets and conversion support.");
  if (c.timeliness.score !== null && c.timeliness.score < 60) out.push("Timeliness issues: review deadlines and delivery scheduling.");
  return out;
}

// ----------------------------------------------------------------------------
// Aggregation
// ----------------------------------------------------------------------------

export async function gatherRecords(userId: string, from: Date, to: Date): Promise<PerfRecord[]> {
  const parts = await Promise.all([
    getSalesPerformanceData(userId, from, to),
    getPmsPerformanceData(userId, from, to),
    getProductPostingPerformanceData(userId, from, to),
    getSoftwarePerformanceData(userId, from, to),
    getServicePerformanceData(userId, from, to),
    getSupportPerformanceData(userId, from, to),
    getCallSessionsPerformanceData(userId, from, to),
    getAppointmentsPerformanceData(userId, from, to),
    getTaskTimeLogsPerformanceData(userId, from, to),
    getServiceRenewalsPerformanceData(userId, from, to),
    getProductPostingReworkData(userId, from, to),
    getSoftwareReworkData(userId, from, to),
  ]);
  const all = parts.flat();
  all.sort((a, b) => {
    const da = new Date(a.completedAt ?? a.assignedAt ?? 0).getTime();
    const db = new Date(b.completedAt ?? b.assignedAt ?? 0).getTime();
    return db - da;
  });
  return all;
}

function sourceBreakdown(records: PerfRecord[]) {
  const map: Record<string, { total: number; assigned: number; completed: number; approved: number; returned: number }> = {};
  for (const r of records) {
    const m = (map[r.sourceModule] = map[r.sourceModule] || { total: 0, assigned: 0, completed: 0, approved: 0, returned: 0 });
    m.total++;
    if (r._assignable) m.assigned++;
    if (r._assignable && r.isCompleted) m.completed++;
    if (r.isApproved) m.approved++;
    if (r.isReturned) m.returned++;
  }
  return map;
}

export async function getEmployee(userId: string): Promise<any | null> {
  try {
    const { rows } = await pool.query(
      `select id, name, full_name as "fullName", email, role, role_id as "roleId",
              department, branch, designation, is_active as "isActive"
         from drm.users where id::text = $1::text limit 1`,
      [userId],
    );
    return rows[0] ?? null;
  } catch (e: any) {
    adapterCatch("getEmployee skipped", e);
    return null;
  }
}

export function publicRecord(r: PerfRecord) {
  const { _assignable, _reviewable, ...rest } = r;
  return rest;
}

export async function buildSummary(userId: string, from: Date, to: Date, includeRecords: boolean) {
  const dataWarnings: string[] = [];
  return perfWarnings.run(dataWarnings, async () => {
  const employee = await getEmployee(userId);
  const [records, targetData, attendanceContext] = await Promise.all([
    gatherRecords(userId, from, to),
    getTargetAchievementData(userId, from, to),
    getAttendanceContext(userId, from, to),
  ]);

  const workCompletion = calculateWorkCompletion(records);
  const quality = calculateQuality(records);
  const targetAchievement = calculateTargetAchievement(targetData);
  const timeliness = calculateTimeliness(records);
  const components = { workCompletion, quality, targetAchievement, timeliness };

  const final = calculateFinalScore(components);
  const effectiveScore = final.normalizedFinalScore ?? final.finalScore;
  const rating = getPerformanceRating(effectiveScore);
  const managementSuggestions = getManagementSuggestions(effectiveScore, components);

  return {
    employee: employee
      ? { id: employee.id, name: employee.fullName || employee.name, email: employee.email, role: employee.role, department: employee.department }
      : { id: userId, name: null, email: null, role: null, department: null },
    dateRange: { startDate: from.toISOString(), endDate: to.toISOString() },
    components,
    finalScore: final.finalScore,
    normalizedFinalScore: final.normalizedFinalScore,
    formulaCompletenessPercent: final.formulaCompletenessPercent,
    rating,
    dataQuality: final.dataQuality,
    missingMetrics: final.missingMetrics,
    managementSuggestions,
    sourceBreakdown: sourceBreakdown(records),
    attendanceContext,
    totalRecords: records.length,
    partialDataFailure: dataWarnings.length > 0,
    dataWarnings,
    records: includeRecords ? records.map(publicRecord) : undefined,
  };
  });
}

export async function buildRecords(
  userId: string, from: Date, to: Date,
  opts: { sourceModule?: string; status?: string; page: number; limit: number },
) {
  let records = await gatherRecords(userId, from, to);
  if (opts.sourceModule) records = records.filter((r) => r.sourceModule === opts.sourceModule);
  if (opts.status) records = records.filter((r) => String(r.status ?? "").toLowerCase() === opts.status!.toLowerCase());
  const total = records.length;
  const start = (opts.page - 1) * opts.limit;
  const page = records.slice(start, start + opts.limit).map(publicRecord);
  return { records: page, pagination: { page: opts.page, limit: opts.limit, total } };
}

function periodKey(d: Date, interval: "daily" | "weekly" | "monthly"): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (interval === "monthly") return `${y}-${m}`;
  if (interval === "weekly") {
    const onejan = new Date(Date.UTC(y, 0, 1));
    const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getUTCDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, "0")}`;
  }
  return `${y}-${m}-${day}`;
}

export async function buildTrends(userId: string, from: Date, to: Date, interval: "daily" | "weekly" | "monthly") {
  const records = await gatherRecords(userId, from, to);
  const buckets: Record<string, { assigned: number; completed: number; approved: number; revisions: number; onTime: number }> = {};
  for (const r of records) {
    const ref = r.completedAt ?? r.assignedAt;
    if (!ref) continue;
    const key = periodKey(new Date(ref), interval);
    const b = (buckets[key] = buckets[key] || { assigned: 0, completed: 0, approved: 0, revisions: 0, onTime: 0 });
    if (r._assignable) b.assigned++;
    if (r._assignable && r.isCompleted) b.completed++;
    if (r.isApproved) b.approved++;
    b.revisions += r.revisionCount || 0;
    if (r.isOnTime === true) b.onTime++;
  }
  const trend = Object.keys(buckets).sort().map((period) => {
    const b = buckets[period];
    const score = b.assigned > 0 ? round1((b.completed / b.assigned) * 100) : null;
    return { period, assigned: b.assigned, completed: b.completed, approved: b.approved, revisions: b.revisions, onTime: b.onTime, score };
  });
  return { trend };
}
