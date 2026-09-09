import { pool } from "../db";
import { gmApprovedClause } from "./performance.service";

/**
 * Patch 2 Stage 5 — Daily Target Report canonical data source.
 *
 * Reports each in-scope employee's assigned target, real achievement, and live
 * activity counts over a date window. NOTHING is fabricated:
 *  - assigned target = Σ coalesce(nullif(total,0), nullif(price,0)) over the
 *    employee's `target_system_user_targets` rows whose [start_date,end_date]
 *    OVERLAP the window. Identical to performance.service's getTargetAchievementData
 *    so the two never disagree. When an employee has no target in range, assigned
 *    is `null` (NOT 0) and the employee is named in `missingData`.
 *  - achieved = approved GM `amount_usd` via the canonical `gmApprovedClause()`
 *    (sales_person_id OR created_by). One definition for both rows and summary.
 *  - pending = max(0, assigned - achieved) (null when no assigned target).
 *  - achievementPercent = assigned > 0 ? achieved/assigned*100 : null.
 *  - activities/calls/followUps/meetings = real counts from their source tables.
 *
 * Rows are PER EMPLOYEE (achieved/GM is a per-user quantity; splitting it across
 * multiple targets would fabricate per-target achievement). Multiple targets are
 * aggregated into the targetName/targetType labels.
 *
 * Known limitations (documented, not silently guessed):
 *  - target_system_user_targets.user_id is matched uuid-only. The assign-by-role
 *    path can store a NAME there; such rows are not counted (consistent with the
 *    rest of the app's performance queries).
 *  - target_system_daily_targets (role/method daily quotas) is NOT used in v1.
 *  - service_activities target source is omitted to keep one achievement
 *    definition across rows and summary.
 */

export interface DayTargetRow {
  employeeId: string;
  employeeName: string | null;
  role: string | null;
  department: string | null;
  date: string;
  targetName: string | null;
  targetType: string | null;
  assignedTarget: number | null;
  achieved: number;
  pending: number | null;
  achievementPercent: number | null;
  activities: number;
  calls: number;
  followUps: number;
  meetings: number;
  gmAmount: number;
  remarks: string | null;
}

export interface DayTargetSummary {
  totalAssigned: number;
  totalAchieved: number;
  totalPending: number;
  averageAchievementPercent: number | null;
  employeeCount: number;
}

export interface DayTargetPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DayTargetMissing {
  employeeId: string;
  employeeName: string | null;
  reason: string;
}

export interface DayTargetReport {
  filters: {
    userId: string | null;
    ourTeam: boolean;
    department: string | null;
    role: string | null;
    targetType: string | null;
    startDate: string;
    endDate: string;
  };
  rows: DayTargetRow[];
  summary: DayTargetSummary;
  pagination: DayTargetPagination;
  missingData: DayTargetMissing[];
}

export interface DayTargetQuery {
  filterUserIds: string[] | null;
  fromDate: Date;
  toDate: Date;
  startDateStr: string;
  endDateStr: string;
  userId?: string | null;
  ourTeam?: boolean;
  department?: string | null;
  role?: string | null;
  targetType?: string | null;
  page: number;
  limit: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getDayTargetReport(opts: DayTargetQuery): Promise<DayTargetReport> {
  const { filterUserIds, fromDate, toDate, startDateStr, endDateStr, page, limit } = opts;
  const department = opts.department?.trim() || null;
  const roleFilter = opts.role?.trim() || null;
  const targetType = opts.targetType?.trim() || null;
  const dateLabel = startDateStr === endDateStr ? startDateStr : `${startDateStr} – ${endDateStr}`;

  const filters: DayTargetReport["filters"] = {
    userId: opts.userId ?? null,
    ourTeam: !!opts.ourTeam,
    department,
    role: roleFilter,
    targetType,
    startDate: startDateStr,
    endDate: endDateStr,
  };

  const empty: DayTargetReport = {
    filters,
    rows: [],
    summary: {
      totalAssigned: 0,
      totalAchieved: 0,
      totalPending: 0,
      averageAchievementPercent: null,
      employeeCount: 0,
    },
    pagination: { page, limit, total: 0, totalPages: 0 },
    missingData: [],
  };

  // 1) In-scope employees. filterUserIds === null means "all users" (admin/hr).
  const empWhere: string[] = ["coalesce(u.is_active, true) = true"];
  const empParams: any[] = [];
  if (filterUserIds !== null) {
    empParams.push(filterUserIds);
    empWhere.push(`u.id::text = ANY($${empParams.length}::text[])`);
  }
  if (department) {
    empParams.push(department);
    empWhere.push(`lower(coalesce(u.department,'')) = lower($${empParams.length})`);
  }
  if (roleFilter) {
    empParams.push(roleFilter);
    empWhere.push(`lower(coalesce(u.role,'')) = lower($${empParams.length})`);
  }
  const { rows: empRows } = await pool.query(
    `select u.id::text as id, coalesce(u.full_name, u.name) as name, u.role, u.department
       from drm.users u
      where ${empWhere.join(" and ")}
      order by coalesce(u.full_name, u.name) asc, u.id asc`,
    empParams,
  );

  const total = empRows.length;
  if (total === 0) return empty;
  const allIds = empRows.map((r: any) => String(r.id));

  // 2) Assigned target + labels per employee over the full scope (canonical formula).
  const targetParams: any[] = [allIds, fromDate, toDate];
  let targetTypeClause = "";
  if (targetType) {
    targetParams.push(targetType);
    targetTypeClause = ` and lower(coalesce(category,'')) = lower($${targetParams.length})`;
  }
  const assignedByUid = new Map<string, { assigned: number; names: string[]; cats: string[] }>();
  const { rows: tRows } = await pool.query(
    `select user_id::text as uid,
            coalesce(sum(coalesce(nullif(total,0), nullif(price,0), 0)),0)::float as assigned,
            array_remove(array_agg(distinct nullif(btrim(target_name), '')), null) as names,
            array_remove(array_agg(distinct nullif(btrim(category), '')), null) as cats
       from drm.target_system_user_targets
      where user_id::text = ANY($1::text[])
        and coalesce(start_date, '-infinity'::timestamp) <= $3
        and coalesce(end_date, 'infinity'::timestamp) >= $2${targetTypeClause}
      group by user_id::text`,
    targetParams,
  );
  for (const r of tRows) {
    assignedByUid.set(String(r.uid), {
      assigned: Number(r.assigned ?? 0),
      names: ((r.names ?? []) as string[]) || [],
      cats: ((r.cats ?? []) as string[]) || [],
    });
  }

  // 3) Approved GM amount per employee over the full scope (canonical predicate).
  const approvedClause = await gmApprovedClause();
  const gmByUid = new Map<string, number>();
  const { rows: gRows } = await pool.query(
    `select uid, coalesce(sum(coalesce(amount_usd,0)),0)::float as amt
       from (
         select case when sales_person_id::text = ANY($1::text[])
                       then sales_person_id::text
                     else created_by::text end as uid,
                amount_usd
           from drm.gm_entries
          where coalesce(is_deleted,false) = false
            and ${approvedClause}
            and created_at between $2 and $3
            and (sales_person_id::text = ANY($1::text[]) or created_by::text = ANY($1::text[]))
       ) t
      where uid = ANY($1::text[])
      group by uid`,
    [allIds, fromDate, toDate],
  );
  for (const r of gRows) gmByUid.set(String(r.uid), Number(r.amt ?? 0));

  // 4) Paginate employees, then fetch activity-style counts for the page only.
  const safePage = Math.min(page, Math.max(1, Math.ceil(total / limit)));
  const offset = (safePage - 1) * limit;
  const pageEmp = empRows.slice(offset, offset + limit);
  const pageIds = pageEmp.map((r: any) => String(r.id));

  const activitiesByUid = new Map<string, { activities: number; meetings: number }>();
  const callsByUid = new Map<string, number>();
  const followUpsByUid = new Map<string, number>();
  if (pageIds.length > 0) {
    const [actRes, callRes, fuRes] = await Promise.all([
      pool.query(
        `select created_by::text as uid, count(*)::int as c,
                count(*) filter (where type ilike '%meet%')::int as meetings
           from drm.activities
          where coalesce(is_deleted,false) = false
            and created_by::text = ANY($1::text[])
            and activity_date between $2 and $3
          group by created_by::text`,
        [pageIds, fromDate, toDate],
      ),
      pool.query(
        `select user_id::text as uid, count(*)::int as c
           from drm.call_sessions
          where user_id::text = ANY($1::text[])
            and started_at between $2 and $3
          group by user_id::text`,
        [pageIds, fromDate, toDate],
      ),
      pool.query(
        `select assigned_to::text as uid, count(*)::int as c
           from drm.follow_ups
          where coalesce(is_deleted,false) = false
            and assigned_to::text = ANY($1::text[])
            and coalesce(date_time, due_at, created_at) between $2 and $3
          group by assigned_to::text`,
        [pageIds, fromDate, toDate],
      ),
    ]);
    for (const r of actRes.rows)
      activitiesByUid.set(String(r.uid), { activities: Number(r.c ?? 0), meetings: Number(r.meetings ?? 0) });
    for (const r of callRes.rows) callsByUid.set(String(r.uid), Number(r.c ?? 0));
    for (const r of fuRes.rows) followUpsByUid.set(String(r.uid), Number(r.c ?? 0));
  }

  // 5) Build page rows.
  const rows: DayTargetRow[] = pageEmp.map((e: any) => {
    const uid = String(e.id);
    const t = assignedByUid.get(uid);
    const hasTarget = !!t && t.assigned > 0;
    const assignedTarget = hasTarget ? round2(t!.assigned) : null;
    const achieved = round2(gmByUid.get(uid) ?? 0);
    const pending = assignedTarget != null ? Math.max(0, round2(assignedTarget - achieved)) : null;
    const achievementPercent =
      assignedTarget != null && assignedTarget > 0 ? round2((achieved / assignedTarget) * 100) : null;
    const act = activitiesByUid.get(uid) ?? { activities: 0, meetings: 0 };
    return {
      employeeId: uid,
      employeeName: e.name ?? null,
      role: e.role ?? null,
      department: e.department ?? null,
      date: dateLabel,
      targetName: t && t.names.length ? t.names.join(", ") : null,
      targetType: t && t.cats.length ? t.cats.join(", ") : null,
      assignedTarget,
      achieved,
      pending,
      achievementPercent,
      activities: act.activities,
      calls: callsByUid.get(uid) ?? 0,
      followUps: followUpsByUid.get(uid) ?? 0,
      meetings: act.meetings,
      gmAmount: achieved,
      remarks: hasTarget ? null : "No assigned target in range",
    };
  });

  // 6) Summary + missingData over the FULL in-scope set (not just the current
  // page) so totals and the "no assigned target" count never disagree with each
  // other and never understate when results span multiple pages.
  const nameByUid = new Map<string, string | null>();
  for (const e of empRows) nameByUid.set(String(e.id), (e as any).name ?? null);
  const missingData: DayTargetMissing[] = [];
  let totalAssigned = 0;
  let totalAchieved = 0;
  let totalPending = 0;
  const pcts: number[] = [];
  for (const uid of allIds) {
    const a = assignedByUid.get(uid)?.assigned ?? 0;
    const ach = gmByUid.get(uid) ?? 0;
    totalAssigned += a;
    totalAchieved += ach;
    if (a > 0) {
      totalPending += Math.max(0, a - ach);
      pcts.push((ach / a) * 100);
    } else {
      missingData.push({ employeeId: uid, employeeName: nameByUid.get(uid) ?? null, reason: "no_assigned_target" });
    }
  }
  const summary: DayTargetSummary = {
    totalAssigned: round2(totalAssigned),
    totalAchieved: round2(totalAchieved),
    totalPending: round2(totalPending),
    averageAchievementPercent: pcts.length ? round2(pcts.reduce((s, v) => s + v, 0) / pcts.length) : null,
    employeeCount: total,
  };

  return {
    filters,
    rows,
    summary,
    pagination: { page: safePage, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    missingData,
  };
}

export function buildDayTargetCsv(report: DayTargetReport): string {
  const lines: string[] = [];
  const q = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  lines.push("Report,Daily Target Report");
  lines.push(`Start Date,${report.filters.startDate}`);
  lines.push(`End Date,${report.filters.endDate}`);
  lines.push("");
  lines.push("Metric,Value");
  lines.push(`Total Assigned,${report.summary.totalAssigned}`);
  lines.push(`Total Achieved,${report.summary.totalAchieved}`);
  lines.push(`Total Pending,${report.summary.totalPending}`);
  lines.push(
    `Average Achievement %,${
      report.summary.averageAchievementPercent == null ? "N/A" : report.summary.averageAchievementPercent
    }`,
  );
  lines.push(`Employee Count,${report.summary.employeeCount}`);
  lines.push("");
  lines.push(
    "Employee,Role,Department,Date,Target Name,Target Type,Assigned,Achieved,Pending,Achievement %,Activities,Calls,Follow-ups,Meetings,GM Amount,Remarks",
  );
  for (const r of report.rows) {
    lines.push(
      [
        q(r.employeeName),
        q(r.role),
        q(r.department),
        q(r.date),
        q(r.targetName),
        q(r.targetType),
        r.assignedTarget ?? "",
        r.achieved,
        r.pending ?? "",
        r.achievementPercent ?? "",
        r.activities,
        r.calls,
        r.followUps,
        r.meetings,
        r.gmAmount,
        q(r.remarks),
      ].join(","),
    );
  }
  return lines.join("\n");
}
