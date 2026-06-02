import { pool } from "../db";
import type { Activity } from "@shared/schema";

export type ActivitySummary = {
  method: string;
  totalMinutes: number;
  count: number;
};

export class ActivitiesRepository {
  async findByUserId(userId: string, dateFrom?: Date, dateTo?: Date): Promise<Activity[]> {
    const userCol = "created_by";
    // Fall back to legacy "type"
    const methodExpr = "coalesce(type, 'unknown')";
    const dateCol = "activity_date";
    const durationExpr = "15"; // legacy table has no duration column

    const clauses: string[] = [`${userCol} = $1`, "coalesce(is_deleted,false)=false"];
    const params: any[] = [userId];
    let i = 2;
    if (dateFrom) {
      clauses.push(`${dateCol} >= $${i++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      clauses.push(`${dateCol} <= $${i++}`);
      params.push(dateTo);
    }
    const whereSql = `where ${clauses.join(" and ")}`;

    const sqlText = `
      select id,
             ${methodExpr} as method,
             customer_id,
             ${durationExpr}::int as duration_minutes,
             ${dateCol} as date_value,
             notes as note_value,
             created_at as created_value
      from activities
      ${whereSql}
    `;

    const res = await pool.query(sqlText, params);
    return res.rows.map((row: any) => ({
      id: row.id,
      userId,
      customerId: row.customer_id ?? null,
      method: row.method ?? "unknown",
      durationMinutes: Number(row.duration_minutes ?? 0),
      dateTime: row.date_value,
      note: row.note_value ?? null,
      createdAt: row.created_value,
    })) as any;
  }

  async getSummaryByMethod(userId: string, dateFrom?: Date, dateTo?: Date): Promise<ActivitySummary[]> {
    const userCol = "created_by";
    const methodExpr = "coalesce(type, 'unknown')";
    const dateCol = "activity_date";
    const durationExpr = "15";

    const clauses: string[] = [`${userCol} = $1`, "coalesce(is_deleted,false)=false"];
    const params: any[] = [userId];
    let i = 2;
    if (dateFrom) {
      clauses.push(`${dateCol} >= $${i++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      clauses.push(`${dateCol} <= $${i++}`);
      params.push(dateTo);
    }
    const whereSql = `where ${clauses.join(" and ")}`;

    const sqlText = `
      select ${methodExpr} as method,
             sum(${durationExpr})::int as total_minutes,
             count(*)::int as count
      from activities
      ${whereSql}
      group by ${methodExpr}
    `;

    const result = await pool.query<{ method: string; total_minutes: number; count: number }>(sqlText, params);

    return result.rows.map((row) => ({
      method: row.method,
      totalMinutes: Number(row.total_minutes),
      count: Number(row.count),
    }));
  }
}

export const activitiesRepository = new ActivitiesRepository();
