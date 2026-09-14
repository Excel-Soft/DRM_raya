import { db } from "../../db";
import { bvReports, users } from "@shared/schema";
import { and, gte, lte, inArray, or, eq, ilike, desc } from "drizzle-orm";

export interface BvReportFilters {
  status?: string;
  company?: string;
  branch?: string;
  page?: number;
  limit?: number;
}

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const clampPercentage = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

function buildChartData(
  rows: { reportDate: Date | string; valueSold: string | number | null }[],
  fromDate: Date,
  toDate: Date,
) {
  const chartMap = new Map<string, { value: number; count: number }>();
  const current = new Date(fromDate);
  while (current <= toDate) {
    chartMap.set(current.toISOString().split("T")[0], { value: 0, count: 0 });
    current.setDate(current.getDate() + 1);
  }
  rows.forEach((row) => {
    const dateKey = new Date(row.reportDate).toISOString().split("T")[0];
    const bucket = chartMap.get(dateKey);
    if (bucket) {
      bucket.count += 1;
      bucket.value += Number(row.valueSold || 0);
    }
  });
  return Array.from(chartMap.entries()).map(([date, data]) => ({ date, ...data }));
}

/**
 * Real implementation for the BV report (bv_reports canonical source). Row-scope
 * (`userIds`) is resolved by the caller (resolveBvScope) — a sales_manager's
 * scope is always their own userId only; this function never widens it.
 */
export async function getBvReportData(
  userIds: string[] | null,
  fromDate: Date,
  toDate: Date,
  filters: BvReportFilters = {},
) {
  const conditions = [gte(bvReports.reportDate, fromDate), lte(bvReports.reportDate, toDate)];
  if (userIds && userIds.length > 0) {
    conditions.push(or(inArray(bvReports.userId, userIds), inArray(bvReports.assignedTo, userIds))!);
  }
  if (filters.status) {
    conditions.push(eq(bvReports.status, filters.status));
  }
  if (filters.company) {
    conditions.push(ilike(bvReports.companyName, `%${filters.company}%`));
  }

  const rows = await db
    .select()
    .from(bvReports)
    .where(and(...conditions))
    .orderBy(desc(bvReports.reportDate));

  const authorIds = Array.from(new Set(rows.map((r) => r.userId)));
  const authorNames: Record<string, string> = {};
  if (authorIds.length > 0) {
    const authorRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, authorIds));
    authorRows.forEach((u) => {
      authorNames[u.id] = u.name ?? "";
    });
  }

  const totalValue = rows.reduce((sum, r) => sum + Number(r.valueSold || 0), 0);
  const totalTasks = rows.reduce((sum, r) => sum + Number(r.totalTasks || 0), 0);
  const followUpsCompleted = rows.reduce((sum, r) => sum + Number(r.followUpsDone || 0), 0);
  const missedLeads = rows.reduce((sum, r) => sum + Number(r.missedLeads || 0), 0);
  const successRate =
    rows.length > 0
      ? clampPercentage(rows.reduce((sum, r) => sum + Number(r.successRate || 0), 0) / rows.length)
      : null;

  const chartData = buildChartData(rows, fromDate, toDate);

  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pagedRows = filters.limit
    ? rows.slice((page - 1) * filters.limit, (page - 1) * filters.limit + filters.limit)
    : rows;

  const details = pagedRows.map((r) => ({
    id: r.id,
    date: r.reportDate,
    title: r.title,
    companyName: r.companyName,
    authorName: authorNames[r.userId] || "N/A",
    status: r.status,
    totalTasks: r.totalTasks,
    valueSold: r.valueSold,
    successRate: r.successRate,
    followUpsDone: r.followUpsDone,
    missedLeads: r.missedLeads,
  }));

  return {
    type: "bv" as const,
    dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
    meta: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      timezone: tz,
    },
    metrics: {
      totalTasks,
      valueOfServiceSold: totalValue,
      successRate,
      followUpsCompleted,
      missedLeads,
    },
    chartData,
    details,
    totals: {
      totalAdvance: totalValue,
      totalRemaining: 0,
    },
    reportCount: rows.length,
  };
}
