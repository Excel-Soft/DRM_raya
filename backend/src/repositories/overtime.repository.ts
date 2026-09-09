import { db, pool } from "../db";
import { overtimeRecords, users, type OvertimeRecord, type InsertOvertimeRecord } from "@models/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

export type OvertimeRecordWithUser = OvertimeRecord & {
  userName?: string | null;
  reviewerName?: string | null;
};

export type OvertimeStats = {
  totalRecords: number;
  pending: number;
  approved: number;
  rejected: number;
  totalMinutesApproved: number;
};

export class OvertimeRepository {
  async findByUserId(userId: string): Promise<OvertimeRecordWithUser[]> {
    const res = await pool.query(
      `select o.id, o.user_id, o.date, o.hours, o.status, o.reason, o.approved_by,
              o.created_at, o.updated_at, u.full_name
         from drm.overtime_records o
         left join users u on u.id = o.user_id
        where o.user_id = $1
        order by o.created_at desc`,
      [userId],
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      taskTitle: r.reason ?? "Overtime",
      timeSpent: Number(r.hours ?? 0),
      taskDetails: r.reason ?? null,
      date: r.date,
      status: r.status,
      reviewedByUserId: r.approved_by,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      userName: r.full_name,
    })) as any;
  }

  async findAll(): Promise<OvertimeRecordWithUser[]> {
    const res = await pool.query(
      `select o.id, o.user_id, o.date, o.hours, o.status, o.reason, o.approved_by,
              o.created_at, o.updated_at, u.full_name
         from drm.overtime_records o
         left join users u on u.id = o.user_id
        order by o.created_at desc`
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      taskTitle: r.reason ?? "Overtime",
      timeSpent: Number(r.hours ?? 0),
      taskDetails: r.reason ?? null,
      date: r.date,
      status: r.status,
      reviewedByUserId: r.approved_by,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      userName: r.full_name,
    })) as any;
  }

  async findByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<OvertimeRecordWithUser[]> {
    const res = await pool.query(
      `select o.id, o.user_id, o.date, o.hours, o.status, o.reason, o.approved_by,
              o.created_at, o.updated_at, u.full_name
         from drm.overtime_records o
         left join users u on u.id = o.user_id
        where o.user_id = $1
          and o.date >= $2 and o.date <= $3
        order by o.created_at desc`,
      [userId, startDate, endDate],
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      taskTitle: r.reason ?? "Overtime",
      timeSpent: Number(r.hours ?? 0),
      taskDetails: r.reason ?? null,
      date: r.date,
      status: r.status,
      reviewedByUserId: r.approved_by,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      userName: r.full_name,
    })) as any;
  }

  async findById(id: string): Promise<OvertimeRecordWithUser | null> {
    const res = await pool.query(
      `select o.id, o.user_id, o.date, o.hours, o.status, o.reason, o.approved_by,
              o.created_at, o.updated_at, u.full_name
         from drm.overtime_records o
         left join users u on u.id = o.user_id
        where o.id = $1
        limit 1`,
      [id],
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      userId: r.user_id,
      taskTitle: r.reason ?? "Overtime",
      timeSpent: Number(r.hours ?? 0),
      taskDetails: r.reason ?? null,
      date: r.date,
      status: r.status,
      reviewedByUserId: r.approved_by,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      userName: r.full_name,
    } as any;
  }

  async create(data: InsertOvertimeRecord): Promise<OvertimeRecord> {
    const res = await pool.query(
      `insert into drm.overtime_records (user_id, date, hours, status, reason, approved_by, created_at, updated_at)
       values ($1, $2, $3, 'Pending', $4, null, now(), now())
       returning id, user_id, date, hours, status, reason, approved_by, created_at, updated_at`,
      [data.userId, data.date || new Date(), data.timeSpent ?? 0, data.taskTitle ?? data.taskDetails ?? "Overtime"],
    );
    const r = res.rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      date: r.date,
      timeSpent: Number(r.hours ?? 0),
      taskTitle: r.reason ?? "Overtime",
      taskDetails: r.reason ?? null,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    } as any;
  }

  async cancel(id: string, userId: string): Promise<OvertimeRecord | null> {
    const existing = await this.findById(id);
    if (!existing || existing.userId !== userId || existing.status !== "Pending") {
      return null;
    }

    const res = await pool.query(
      `delete from drm.overtime_records where id = $1 returning id, user_id, date, hours, status, reason, approved_by, created_at, updated_at`,
      [id],
    );
    return res.rows[0] as any;
  }

  async approve(id: string, reviewerUserId: string): Promise<OvertimeRecord | null> {
    const existing = await this.findById(id);
    if (!existing || existing.status !== "Pending") {
      return null;
    }

    const res = await pool.query(
      `update drm.overtime_records
          set status='Approved',
              approved_by = $2,
              updated_at = now()
        where id = $1
        returning id, user_id, date, hours, status, reason, approved_by, created_at, updated_at`,
      [id, reviewerUserId],
    );
    return res.rows[0] as any;
  }

  async reject(id: string, reviewerUserId: string, reason?: string): Promise<OvertimeRecord | null> {
    const existing = await this.findById(id);
    if (!existing || existing.status !== "Pending") {
      return null;
    }

    const res = await pool.query(
      `update drm.overtime_records
          set status='Rejected',
              approved_by = $2,
              reason = $3,
              updated_at = now()
        where id = $1
        returning id, user_id, date, hours, status, reason, approved_by, created_at, updated_at`,
      [id, reviewerUserId, reason ?? null],
    );
    return res.rows[0] as any;
  }

  async getStats(userId: string): Promise<OvertimeStats> {
    const records = await this.findByUserId(userId);

    const stats: OvertimeStats = {
      totalRecords: records.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      totalMinutesApproved: 0,
    };

    for (const record of records) {
      switch (record.status) {
        case "Pending":
          stats.pending++;
          break;
        case "Approved":
          stats.approved++;
          stats.totalMinutesApproved += record.timeSpent;
          break;
        case "Rejected":
          stats.rejected++;
          break;
      }
    }

    return stats;
  }

  async getMonthlyOvertimeMinutes(userId: string, year: number, month: number): Promise<number> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const res = await pool.query(
      `select coalesce(sum(hours),0)::int as mins
         from drm.overtime_records
        where user_id = $1
          and status = 'Approved'
          and date >= $2 and date <= $3`,
      [userId, startDate, endDate],
    );
    return Number(res.rows[0]?.mins ?? 0);
  }
}

export const overtimeRepository = new OvertimeRepository();

