import { pool } from "../../db";

/**
 * Real implementation of legacy's "Day Activities" report
 * (daytargetreport.php + func.php's user_id_day_reports handler). Replaces a
 * stub that resolved `undefined` and crashed every request with a 500.
 *
 * Legacy summarized a pre-aggregated daily counter table (webxl_day_book:
 * one row per user/method/day, incremented each time a follow-up was
 * logged) grouped by contact method. The modern equivalent is the real,
 * already-live follow_ups + followup_subservice_details tables (the same
 * ones backing the Follow Up Report built earlier) — COUNT(*) grouped by
 * method over the raw event log produces the same "total follow-ups per
 * method" result legacy's SUM(followup) did.
 *
 * Legacy's own user_id='0' ("All") selection would have queried
 * `user_id = '0'`, matching nothing — an evident bug, not reproduced here.
 * "All" (no specific user, no team) aggregates across everyone instead.
 */

export interface DayTargetQuery {
  fromDate: Date;
  toDate: Date;
  startDateStr: string;
  endDateStr: string;
  userId: string | null;
  ourTeam: boolean;
  filterUserIds: string[] | null;
}

export interface DayTargetMethodRow {
  method: string;
  total: number;
}

export interface DayTargetUserTable {
  userId: string | null;
  userName: string;
  rows: DayTargetMethodRow[];
}

export interface DayTargetReport {
  filters: { startDate: string; endDate: string; userId: string | null; ourTeam: boolean };
  tables: DayTargetUserTable[];
}

async function methodCountsFor(userIds: string[] | null, fromDate: Date, toDate: Date): Promise<DayTargetMethodRow[]> {
  const conditions = ["coalesce(f.is_deleted, false) = false", "f.created_at >= $1", "f.created_at <= $2"];
  const params: any[] = [fromDate, toDate];
  if (userIds) {
    conditions.push(`f.assigned_to = ANY($3::uuid[])`);
    params.push(userIds);
  }
  const result = await pool.query<{ method: string | null; total: string }>(
    `SELECT COALESCE(d.method, f.method) AS method, count(*)::int AS total
       FROM drm.follow_ups f
       LEFT JOIN drm.followup_subservice_details d ON d.followup_id = f.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY COALESCE(d.method, f.method)
      ORDER BY total DESC`,
    params,
  );
  return result.rows
    .filter((r) => r.method)
    .map((r) => ({ method: r.method as string, total: Number(r.total) }));
}

export async function getDayTargetReport(query: DayTargetQuery): Promise<DayTargetReport> {
  const { fromDate, toDate, startDateStr, endDateStr, userId, ourTeam, filterUserIds } = query;
  const filters = { startDate: startDateStr, endDate: endDateStr, userId, ourTeam };

  // Unrestricted scope (global admin/hr with no specific user chosen) —
  // aggregate across everyone into a single "All" table.
  if (filterUserIds === null) {
    const rows = await methodCountsFor(null, fromDate, toDate);
    return { filters, tables: [{ userId: null, userName: "All", rows }] };
  }

  if (filterUserIds.length === 0) {
    return { filters, tables: [] };
  }

  // A single resolved user (specific selection, or a non-team default-to-self).
  if (filterUserIds.length === 1) {
    const id = filterUserIds[0];
    const nameRes = await pool.query<{ full_name: string | null }>(
      `SELECT full_name FROM drm.users WHERE id = $1`,
      [id],
    );
    const rows = await methodCountsFor([id], fromDate, toDate);
    return { filters, tables: [{ userId: id, userName: nameRes.rows[0]?.full_name ?? "Unknown", rows }] };
  }

  // "Our Team" resolved to multiple people — legacy shows one table per
  // team member, even when a member has zero activity in range.
  const usersRes = await pool.query<{ id: string; full_name: string | null }>(
    `SELECT id, full_name FROM drm.users WHERE id = ANY($1::uuid[]) ORDER BY full_name`,
    [filterUserIds],
  );
  const tables: DayTargetUserTable[] = [];
  for (const u of usersRes.rows) {
    const rows = await methodCountsFor([u.id], fromDate, toDate);
    tables.push({ userId: u.id, userName: u.full_name ?? "Unknown", rows });
  }
  return { filters, tables };
}

export function buildDayTargetCsv(report: DayTargetReport): string {
  const lines = [`From,${report.filters.startDate}`, `To,${report.filters.endDate}`, ""];
  for (const table of report.tables) {
    lines.push(`Name,${table.userName}`);
    lines.push("Method,Total Follow-up");
    for (const row of table.rows) {
      lines.push(`${row.method},${row.total}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
