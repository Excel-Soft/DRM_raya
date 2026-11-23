import { pool } from "../db";

/** Columns returned to the API (supports legacy rows + new inserts). */
const LEAVE_ROW_SELECT = `
  lr.id,
  lr.user_id as "userId",
  lr.from_date as "fromDate",
  lr.to_date as "toDate",
  lr.leave_type as "leaveType",
  lr.leave_type as "type",
  lr.purpose as "purpose",
  lr.description as "description",
  coalesce(lr.description, lr.purpose) as "reason",
  lr.alternative as "alternative",
  lr.time as "time",
  coalesce(nullif(trim(lr.duration), ''), 'Full Day') as "duration",
  lr.status as "status",
  lr.approved_by_user_id as "approvedByUserId",
  lr.rejection_reason as "rejectionReason",
  lr.created_at as "createdAt",
  lr.updated_at as "updatedAt",
  u.full_name as "userName"
`;

const LEAVE_ROW_FROM = `
  from drm.leave_requests lr
  left join drm.users u on u.id = lr.user_id
`;

export type LeaveRequestWithUser = {
  id: string;
  userId: string;
  fromDate: Date;
  toDate: Date;
  leaveType?: string;
  type: string | null;
  purpose?: string | null;
  description?: string | null;
  reason: string | null;
  alternative?: string | null;
  time?: string | null;
  duration: string | null;
  status: string;
  approvedByUserId: string | null;
  rejectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  userName?: string | null;
};

export type LeaveStats = {
  totalRequests: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  byType: Record<string, number>;
};

export type CreateLeaveInput = {
  userId: string;
  fromDate: Date;
  toDate: Date;
  leaveType: string;
  purpose: string;
  alternative: string;
  description?: string | null;
  time?: string | null;
  duration?: string | null;
};

export class LeaveRequestRepository {
  private ensured = false;

  private async ensureSchema() {
    if (this.ensured) return;
    await pool.query(`alter table drm.leave_requests add column if not exists duration text;`);
    this.ensured = true;
  }

  async findByUserId(userId: string): Promise<LeaveRequestWithUser[]> {
    await this.ensureSchema();
    const results = await pool.query(
      `select ${LEAVE_ROW_SELECT}
         ${LEAVE_ROW_FROM}
        where lr.user_id = $1
        order by lr.created_at desc`,
      [userId],
    );
    return results.rows as LeaveRequestWithUser[];
  }

  async findAll(): Promise<LeaveRequestWithUser[]> {
    const results = await pool.query(
      `select ${LEAVE_ROW_SELECT}
         ${LEAVE_ROW_FROM}
        order by lr.created_at desc`,
    );
    return results.rows as LeaveRequestWithUser[];
  }

  async findByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<LeaveRequestWithUser[]> {
    const results = await pool.query(
      `select ${LEAVE_ROW_SELECT}
         ${LEAVE_ROW_FROM}
        where lr.user_id = $1
          and lr.from_date >= $2
          and lr.to_date <= $3
        order by lr.created_at desc`,
      [userId, startDate, endDate],
    );
    return results.rows as LeaveRequestWithUser[];
  }

  async findById(id: string): Promise<LeaveRequestWithUser | null> {
    const results = await pool.query(
      `select ${LEAVE_ROW_SELECT}
         ${LEAVE_ROW_FROM}
        where lr.id = $1
        limit 1`,
      [id],
    );

    return (results.rows[0] as LeaveRequestWithUser) || null;
  }

  async create(data: CreateLeaveInput): Promise<LeaveRequestWithUser> {
    await this.ensureSchema();
    const result = await pool.query(
      `insert into drm.leave_requests (
          user_id, purpose, leave_type, alternative, from_date, to_date, time, description, duration, status, created_at, updated_at
       )
       values ($1, $2, $3::drm.leave_type, $4, $5, $6, $7, $8, $9, 'Pending', now(), now())
       returning id`,
      [
        data.userId,
        data.purpose,
        data.leaveType,
        data.alternative,
        data.fromDate,
        data.toDate,
        data.time ?? null,
        data.description ?? null,
        data.duration ?? "Full Day",
      ],
    );
    const created = await this.findById(result.rows[0].id);
    if (!created) {
      throw new Error("Failed to load created leave request");
    }
    return created;
  }

  async cancel(id: string, userId: string): Promise<LeaveRequestWithUser | null> {
    const existing = await pool.query(
      `select status from drm.leave_requests where id = $1 and user_id = $2 limit 1`,
      [id, userId],
    );
    if (!existing.rows[0] || existing.rows[0].status !== "Pending") {
      return null;
    }

    await pool.query(
      `update drm.leave_requests set status = 'Cancelled', updated_at = now() where id = $1`,
      [id],
    );

    return this.findById(id);
  }

  async approve(id: string, approverUserId: string): Promise<LeaveRequestWithUser | null> {
    const existing = await pool.query(`select status from drm.leave_requests where id = $1 limit 1`, [id]);
    if (!existing.rows[0] || existing.rows[0].status !== "Pending") {
      return null;
    }

    await pool.query(
      `update drm.leave_requests
       set status = 'Approved',
           approved_by_user_id = $2,
           approved_at = now(),
           updated_at = now()
       where id = $1`,
      [id, approverUserId],
    );

    return this.findById(id);
  }

  async reject(id: string, approverUserId: string, reason?: string): Promise<LeaveRequestWithUser | null> {
    const existing = await pool.query(`select status from drm.leave_requests where id = $1 limit 1`, [id]);
    if (!existing.rows[0] || existing.rows[0].status !== "Pending") {
      return null;
    }

    await pool.query(
      `update drm.leave_requests
       set status = 'Rejected',
           approved_by_user_id = $2,
           rejection_reason = coalesce($3, rejection_reason),
           updated_at = now()
       where id = $1`,
      [id, approverUserId, reason ?? null],
    );

    return this.findById(id);
  }

  async getStats(userId: string): Promise<LeaveStats> {
    const requests = await this.findByUserId(userId);

    const stats: LeaveStats = {
      totalRequests: requests.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      byType: {},
    };

    for (const req of requests) {
      switch (req.status) {
        case "Pending":
          stats.pending++;
          break;
        case "Approved":
          stats.approved++;
          break;
        case "Rejected":
          stats.rejected++;
          break;
        case "Cancelled":
          stats.cancelled++;
          break;
      }

      const leaveType = req.type ?? req.leaveType ?? "unknown";
      stats.byType[leaveType] = (stats.byType[leaveType] || 0) + 1;
    }

    return stats;
  }

  async getMonthlyLeaveCount(userId: string, year: number, month: number): Promise<number> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const results = await pool.query(
      `select from_date as "fromDate", to_date as "toDate"
         from drm.leave_requests
        where user_id = $1
          and status = 'Approved'
          and from_date >= $2
          and to_date <= $3`,
      [userId, startDate, endDate],
    );

    let totalDays = 0;
    for (const req of results.rows as { fromDate: Date; toDate: Date }[]) {
      const from = new Date(req.fromDate);
      const to = new Date(req.toDate);
      const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      totalDays += days;
    }

    return totalDays;
  }
}

export const leaveRequestRepository = new LeaveRequestRepository();
