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
 * Metrics are computed honestly from the real, filtered row set:
 *   - totalTasks         = COUNT of BV report records (not a sum of a column)
 *   - valueOfServiceSold = SUM of value_sold (alias: valueSold)
 *   - successRate        = approvedCount / count * 100, or null when no rows
 *   - followUpsCompleted = null  (no auditable aggregate source)
 *   - missedLeads        = null  (no auditable aggregate source)
 * Any metric that cannot be derived is returned as `null`, named in
 * `missingMetrics`, and explained in `missingMetricReasons` — never fabricated
 * as 0 or 100. Per-report self-reported follow-up/missed-lead values remain
 * visible per row (details/rows), they are simply not rolled into a headline.
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
    // totalTasks carries the report COUNT (name kept for shared ReportData/CSV compat).
    totalTasks: number;
    valueOfServiceSold: number;
    valueSold: number;
    successRate: number | null;
    followUpsCompleted: number | null;
    missedLeads: number | null;
  };
  missingMetrics: string[];
  missingMetricReasons: Record<string, string>;
  reportCount: number;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  chartData: { date: string; value: number; count: number }[];
  /** Paginated slice of `details` (equal to `details` when no limit is given). */
  rows: BvReportRow[];
  /** Full filtered set — metrics are always computed over this, never the slice. */
  details: BvReportRow[];
}

export interface BvReportFilters {
  status?: string;
  company?: string;
  branch?: string;
  page?: number;
  limit?: number;
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
  filters: BvReportFilters = {},
): Promise<BvReportResult> {
  const params: any[] = [fromDate, toDate];
  const clauses: string[] = [`r.report_date >= $1`, `r.report_date <= $2`];

  if (filterUserIds) {
    params.push(filterUserIds);
    const i = params.length;
    clauses.push(`(r.user_id = ANY($${i}::uuid[]) or r.assigned_to = ANY($${i}::uuid[]))`);
  }
  if (filters.status) {
    params.push(filters.status);
    clauses.push(`r.status = $${params.length}`);
  }
  if (filters.company) {
    params.push(`%${filters.company}%`);
    clauses.push(`coalesce(r.company_name, c.company_name) ilike $${params.length}`);
  }
  if (filters.branch) {
    params.push(filters.branch);
    clauses.push(`au.branch = $${params.length}`);
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
     where ${clauses.join(" and ")}
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

  // ---- Metrics over the FULL filtered set (never the paginated slice) ----
  const reportCount = details.length;
  // Spec: totalTasks is the COUNT of BV report records in scope.
  const totalTasks = reportCount;
  const valueOfServiceSold = details.reduce((s, r) => s + r.valueSold, 0);

  const missingMetrics: string[] = [];
  const missingMetricReasons: Record<string, string> = {};

  // Spec: successRate = approved / total * 100, or null when there are no rows.
  let successRate: number | null = null;
  if (reportCount > 0) {
    const approvedCount = details.filter((r) => r.status === "Approved").length;
    successRate = Math.round((approvedCount / reportCount) * 100 * 100) / 100;
  } else {
    missingMetrics.push("successRate");
    missingMetricReasons.successRate = "No BV reports in the selected window/scope.";
  }

  // followUpsCompleted / missedLeads have no auditable aggregate source — the
  // only values are per-report self-reported numbers (shown per row). Surface
  // them as null + reason rather than summing self-reported data into a headline.
  const followUpsCompleted: number | null = null;
  const missedLeads: number | null = null;
  missingMetrics.push("followUpsCompleted", "missedLeads");
  missingMetricReasons.followUpsCompleted =
    "No auditable aggregate source; per-report self-reported values are listed per row.";
  missingMetricReasons.missedLeads =
    "No auditable aggregate source; per-report self-reported values are listed per row.";

  // ---- Pagination: `rows` is the slice; `details` stays the full set ----
  const hasPaging = filters.limit != null;
  const limit = hasPaging ? (filters.limit as number) : reportCount;
  const totalPages = limit > 0 ? Math.max(1, Math.ceil(reportCount / limit)) : 1;
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const pageRows = hasPaging
    ? details.slice((page - 1) * limit, (page - 1) * limit + limit)
    : details;
  const pagination = { page, limit, total: reportCount, totalPages };

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
      valueSold: valueOfServiceSold,
      successRate,
      followUpsCompleted,
      missedLeads,
    },
    missingMetrics,
    missingMetricReasons,
    reportCount,
    pagination,
    chartData,
    rows: pageRows,
    details,
  };
}
