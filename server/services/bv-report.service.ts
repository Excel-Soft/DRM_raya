import { pool } from "../db";

/**
 * Patch 2 Stage 7 — BV Report canonical data source.
 *
 * The BV Report (list + metrics + export) reads EXCLUSIVELY from `drm.bv_reports`
 * — the same table the create form (POST /api/bv-reports) writes to. The older
 * `drm.bv_entries` table is a read-only legacy sales feed (used only by
 * project-report.service.ts for financial reconciliation) and is intentionally
 * NOT read here. See BV_REPORT_DATA_SOURCE_DECISION.md.
 *
 * Metrics are computed from real stored values. When a metric cannot be derived
 * (e.g. an average over an empty row set) it is returned as `null` and named in
 * `missingMetrics` — never fabricated as 0 or 100.
 */

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface BvReportRow {
  id: string;
  reportDate: string | Date | null;
  date: string | Date | null;
  title: string | null;
  companyName: string | null;
  authorName: string | null;
  assignedToName: string | null;
  status: string;
  totalTasks: number;
  valueSold: number;
  successRate: number;
  followUpsDone: number;
  missedLeads: number;
}

export interface BvReportResult {
  type: "bv";
  dateRange: { from: string; to: string };
  meta: { from: string; to: string; timezone: string };
  metrics: {
    totalTasks: number;
    valueOfServiceSold: number;
    successRate: number | null;
    followUpsCompleted: number;
    missedLeads: number;
  };
  missingMetrics: string[];
  reportCount: number;
  chartData: { date: string; value: number; count: number }[];
  details: BvReportRow[];
}

function buildChartData(
  rows: { reportDate: string | Date | null; valueSold: number }[],
  fromDate: Date,
  toDate: Date,
) {
  const chartMap = new Map<string, { value: number; count: number }>();
  const current = new Date(fromDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);
  while (current <= end) {
    chartMap.set(current.toISOString().split("T")[0], { value: 0, count: 0 });
    current.setDate(current.getDate() + 1);
  }
  for (const row of rows) {
    if (!row.reportDate) continue;
    const key = new Date(row.reportDate).toISOString().split("T")[0];
    const bucket = chartMap.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.value += Number(row.valueSold || 0);
    }
  }
  return Array.from(chartMap.entries()).map(([date, data]) => ({
    date,
    value: data.value,
    count: data.count,
  }));
}

/**
 * Read the BV report rows + metrics for a scoped, date-filtered window.
 *
 * @param filterUserIds `null` = no row scoping (global admin); otherwise the
 *   report is limited to rows whose author OR assignee is in the list.
 */
export async function getBvReportData(
  filterUserIds: string[] | null,
  fromDate: Date,
  toDate: Date,
): Promise<BvReportResult> {
  const params: any[] = [fromDate, toDate];
  let scopeClause = "";
  if (filterUserIds) {
    params.push(filterUserIds);
    scopeClause = ` and (r.user_id = ANY($3::uuid[]) or r.assigned_to = ANY($3::uuid[]))`;
  }

  const { rows } = await pool.query(
    `select
       r.id,
       r.report_date as "reportDate",
       r.report_date as "date",
       r.title,
       coalesce(r.company_name, c.company_name) as "companyName",
       coalesce(au.full_name, au.name, au.username) as "authorName",
       coalesce(asg.full_name, asg.name, asg.username) as "assignedToName",
       r.status,
       r.total_tasks as "totalTasks",
       r.value_sold as "valueSold",
       r.success_rate as "successRate",
       r.follow_ups_done as "followUpsDone",
       r.missed_leads as "missedLeads"
     from drm.bv_reports r
     left join drm.customers c on c.id = r.customer_id
     left join drm.users au on au.id = r.user_id
     left join drm.users asg on asg.id = r.assigned_to
     where r.report_date >= $1 and r.report_date <= $2${scopeClause}
     order by r.report_date desc, r.created_at desc`,
    params,
  );

  const details: BvReportRow[] = rows.map((r: any) => ({
    id: r.id,
    reportDate: r.reportDate,
    date: r.date,
    title: r.title ?? null,
    companyName: r.companyName ?? null,
    authorName: r.authorName ?? null,
    assignedToName: r.assignedToName ?? null,
    status: r.status,
    totalTasks: Number(r.totalTasks ?? 0),
    valueSold: Number(r.valueSold ?? 0),
    successRate: Number(r.successRate ?? 0),
    followUpsDone: Number(r.followUpsDone ?? 0),
    missedLeads: Number(r.missedLeads ?? 0),
  }));

  const reportCount = details.length;
  const totalTasks = details.reduce((s, r) => s + r.totalTasks, 0);
  const valueOfServiceSold = details.reduce((s, r) => s + r.valueSold, 0);
  const followUpsCompleted = details.reduce((s, r) => s + r.followUpsDone, 0);
  const missedLeads = details.reduce((s, r) => s + r.missedLeads, 0);

  const missingMetrics: string[] = [];
  let successRate: number | null = null;
  if (reportCount > 0) {
    const sum = details.reduce((s, r) => s + r.successRate, 0);
    successRate = Math.round((sum / reportCount) * 100) / 100;
  } else {
    // Average success rate is undefined over an empty set — report it honestly.
    missingMetrics.push("successRate");
  }

  const chartData = buildChartData(
    details.map((r) => ({ reportDate: r.reportDate, valueSold: r.valueSold })),
    fromDate,
    toDate,
  );

  const meta = {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    timezone: tz,
  };

  return {
    type: "bv",
    dateRange: { from: meta.from, to: meta.to },
    meta,
    metrics: {
      totalTasks,
      valueOfServiceSold,
      successRate,
      followUpsCompleted,
      missedLeads,
    },
    missingMetrics,
    reportCount,
    chartData,
    details,
  };
}
