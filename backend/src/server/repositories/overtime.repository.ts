import { pool } from "../db";
import type { InsertOvertimeRecord, OvertimeRecord } from "@shared/schema";

const OVERTIME_SELECT = `
  o.id,
  o.user_id as "userId",
  o.task_title as "taskTitle",
  o.time_spent as "timeSpent",
  o.task_details as "taskDetails",
  o.date,
  o.status,
  o.reviewed_by_user_id as "reviewedByUserId",
  o.reviewed_at as "reviewedAt",
  o.rejection_reason as "rejectionReason",
  o.created_at as "createdAt",
  o.updated_at as "updatedAt",
  u.full_name as "userName",
  rv.full_name as "reviewerName"
`;

const OVERTIME_FROM = `
  from drm.overtime_records o
  left join drm.users u on u.id = o.user_id
  left join drm.users rv on rv.id = o.reviewed_by_user_id
`;

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
      `select ${OVERTIME_SELECT}
         ${OVERTIME_FROM}
        where o.user_id = $1
        order by o.created_at desc, o.id desc`,
      [userId],
    );
    return res.rows as OvertimeRecordWithUser[];
  }

  async findAll(): Promise<OvertimeRecordWithUser[]> {
    const res = await pool.query(
      `select ${OVERTIME_SELECT}
         ${OVERTIME_FROM}
        order by o.created_at desc, o.id desc`,
    );
    return res.rows as OvertimeRecordWithUser[];
  }

  async findByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<OvertimeRecordWithUser[]> {
    const res = await pool.query(
      `select ${OVERTIME_SELECT}
         ${OVERTIME_FROM}
        where o.user_id = $1
          and o.date >= $2
          and o.date <= $3
        order by o.created_at desc, o.id desc`,
      [userId, startDate, endDate],
    );
    return res.rows as OvertimeRecordWithUser[];
  }

  async findById(id: string): Promise<OvertimeRecordWithUser | null> {
    const res = await pool.query(
      `select ${OVERTIME_SELECT}
         ${OVERTIME_FROM}
        where o.id = $1
        limit 1`,
      [id],
    );
    return (res.rows[0] as OvertimeRecordWithUser) || null;
  }

  async create(data: InsertOvertimeRecord): Promise<OvertimeRecordWithUser> {
    const res = await pool.query(
      `insert into drm.overtime_records (
          user_id, task_title, time_spent, task_details, date, status, created_at, updated_at
       )
       values ($1, $2, $3, $4, coalesce($5, now()), 'Pending', now(), now())
       returning id`,
      [
        data.userId,
        data.taskTitle,
        data.timeSpent,
        data.taskDetails,
        data.date ?? new Date(),
      ],
    );
    const created = await this.findById(res.rows[0].id);
    if (!created) {
      throw new Error("Failed to load created overtime record");
    }
    return created;
  }

  async cancel(id: string, userId: string): Promise<OvertimeRecordWithUser | null> {
    const existing = await this.findById(id);
    if (!existing || existing.userId !== userId || existing.status !== "Pending") {
      return null;
    }

    await pool.query(`delete from drm.overtime_records where id = $1`, [id]);
    return existing;
  }

  async approve(id: string, reviewerUserId: string): Promise<OvertimeRecordWithUser | null> {
    const existing = await this.findById(id);
    if (!existing || existing.status !== "Pending") {
      return null;
    }

    await pool.query(
      `update drm.overtime_records
          set status = 'Approved',
              reviewed_by_user_id = $2,
              reviewed_at = now(),
              updated_at = now()
        where id = $1`,
      [id, reviewerUserId],
    );

    return this.findById(id);
  }

  async reject(id: string, reviewerUserId: string, reason?: string): Promise<OvertimeRecordWithUser | null> {
    const existing = await this.findById(id);
    if (!existing || existing.status !== "Pending") {
      return null;
    }

    await pool.query(
      `update drm.overtime_records
          set status = 'Rejected',
              reviewed_by_user_id = $2,
              rejection_reason = $3,
              reviewed_at = now(),
              updated_at = now()
        where id = $1`,
      [id, reviewerUserId, reason ?? null],
    );

    return this.findById(id);
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
          stats.totalMinutesApproved += Number(record.timeSpent ?? 0);
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
      `select coalesce(sum(time_spent), 0)::int as mins
         from drm.overtime_records
        where user_id = $1
          and status = 'Approved'
          and date >= $2
          and date <= $3`,
      [userId, startDate, endDate],
    );
    return Number(res.rows[0]?.mins ?? 0);
  }
}

export const overtimeRepository = new OvertimeRepository();
