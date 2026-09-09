import { pool } from "../db";

export type LeaveRequestWithUser = {
  id: string;
  userId: string;
  fromDate: Date;
  toDate: Date;
  type: string | null;
  duration: string | null;
  reason: string | null;
  status: string;
  approvedByUserId: string | null;
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

export class LeaveRequestRepository {
  private ensured = false;

  private async ensureSchema() {
    if (this.ensured) return;
    await pool.query(
      `alter table drm.leave_requests add column if not exists duration text;`,
    );
    this.ensured = true;
  }

  async findByUserId(userId: string): Promise<LeaveRequestWithUser[]> {
    await this.ensureSchema();
    const results = await pool.query(
      `select lr.id,
              lr.user_id as "userId",
              lr.from_date as "fromDate",
              lr.to_date as "toDate",
              lr.type as "type",
              lr.duration as "duration",
              lr.reason as "reason",
              lr.status as "status",
              lr.approved_by as "approvedByUserId",
              lr.created_at as "createdAt",
              lr.updated_at as "updatedAt",
              u.full_name as "userName"
         from drm.leave_requests lr
         left join drm.users u on u.id = lr.user_id
        where lr.user_id = $1
        order by lr.created_at desc`,
      [userId],
    );
    return results.rows as LeaveRequestWithUser[];
  }

  async findAll(): Promise<LeaveRequestWithUser[]> {
    const results = await pool.query(
      `select lr.id,
              lr.user_id as "userId",
              lr.from_date as "fromDate",
              lr.to_date as "toDate",
              lr.type as "type",
              lr.duration as "duration",
              lr.reason as "reason",
              lr.status as "status",
              lr.approved_by as "approvedByUserId",
              lr.created_at as "createdAt",
              lr.updated_at as "updatedAt",
              u.full_name as "userName"
         from drm.leave_requests lr
         left join drm.users u on u.id = lr.user_id
        order by lr.created_at desc`
    );
    return results.rows as LeaveRequestWithUser[];
  }

  async findByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LeaveRequestWithUser[]> {
    const results = await pool.query(
      `select lr.id,
              lr.user_id as "userId",
              lr.from_date as "fromDate",
              lr.to_date as "toDate",
              lr.type as "type",
              lr.duration as "duration",
              lr.reason as "reason",
              lr.status as "status",
              lr.approved_by as "approvedByUserId",
              lr.created_at as "createdAt",
              lr.updated_at as "updatedAt",
              u.full_name as "userName"
         from drm.leave_requests lr
         left join drm.users u on u.id = lr.user_id
        where lr.user_id = $1
          and lr.from_date >= $2
          and lr.to_date   <= $3
        order by lr.created_at desc`,
      [userId, startDate, endDate],
    );
    return results.rows as LeaveRequestWithUser[];
  }

  async findById(id: string): Promise<LeaveRequestWithUser | null> {
    const results = await pool.query(
      `select lr.id,
              lr.user_id as "userId",
              lr.from_date as "fromDate",
              lr.to_date as "toDate",
              lr.type as "type",
              lr.duration as "duration",
              lr.reason as "reason",
              lr.status as "status",
              lr.approved_by as "approvedByUserId",
              lr.created_at as "createdAt",
              lr.updated_at as "updatedAt",
              u.full_name as "userName"
         from drm.leave_requests lr
         left join drm.users u on u.id = lr.user_id
        where lr.id = $1
        limit 1`,
      [id],
    );

    return (results.rows[0] as LeaveRequestWithUser) || null;
  }

  async create(data: { userId: string; fromDate: Date; toDate: Date; type: string; duration?: string | null; reason?: string | null }): Promise<LeaveRequestWithUser> {
    await this.ensureSchema();
    const result = await pool.query(
      `insert into drm.leave_requests (user_id, from_date, to_date, type, duration, reason, status, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, 'Pending', now(), now())
       returning id, user_id as "userId", from_date as "fromDate", to_date as "toDate", type, duration, reason, status, approved_by as "approvedByUserId", created_at as "createdAt", updated_at as "updatedAt"`,
      [data.userId, data.fromDate, data.toDate, data.type, data.duration ?? "Full Day", data.reason ?? null],
    );
    return result.rows[0] as LeaveRequestWithUser;
  }

  async cancel(id: string, userId: string): Promise<LeaveRequestWithUser | null> {
    const existing = await pool.query(`select status from drm.leave_requests where id = $1 and user_id = $2 limit 1`, [
      id,
      userId,
    ]);
    if (!existing.rows[0] || existing.rows[0].status !== "Pending") {
      return null;
    }

    const result = await pool.query(
      `update drm.leave_requests set status = 'Cancelled', updated_at = now() where id = $1 returning id, user_id as "userId", from_date as "fromDate", to_date as "toDate", type, duration, reason, status, approved_by as "approvedByUserId", created_at as "createdAt", updated_at as "updatedAt"`,
      [id],
    );

    return (result.rows[0] as any) ?? null;
  }

  async approve(id: string, approverUserId: string): Promise<LeaveRequestWithUser | null> {
    const existing = await pool.query(`select status from drm.leave_requests where id = $1 limit 1`, [id]);
    if (!existing.rows[0] || existing.rows[0].status !== "Pending") {
      return null;
    }

    const result = await pool.query(
      `update drm.leave_requests
       set status = 'Approved',
           approved_by = $2,
           updated_at = now()
       where id = $1
       returning id, user_id as "userId", from_date as "fromDate", to_date as "toDate", type, duration, reason, status, approved_by as "approvedByUserId", created_at as "createdAt", updated_at as "updatedAt"`,
      [id, approverUserId],
    );

    return (result.rows[0] as any) ?? null;
  }

  async reject(id: string, approverUserId: string, reason?: string): Promise<LeaveRequestWithUser | null> {
    const existing = await pool.query(`select status from drm.leave_requests where id = $1 limit 1`, [id]);
    if (!existing.rows[0] || existing.rows[0].status !== "Pending") {
      return null;
    }

    const result = await pool.query(
      `update drm.leave_requests
       set status = 'Rejected',
           approved_by = $2,
           updated_at = now(),
           reason = coalesce($3, reason)
       where id = $1
       returning id, user_id as "userId", from_date as "fromDate", to_date as "toDate", type, duration, reason, status, approved_by as "approvedByUserId", created_at as "createdAt", updated_at as "updatedAt"`,
      [id, approverUserId, reason ?? null],
    );

    return (result.rows[0] as any) ?? null;
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

      const leaveType = req.type ?? "unknown";
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
          and to_date   <= $3`,
      [userId, startDate, endDate],
    );

    let totalDays = 0;
    for (const req of results.rows as any[]) {
      const from = new Date(req.fromDate);
      const to = new Date(req.toDate);
      const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      totalDays += days;
    }

    return totalDays;
  }
}

export const leaveRequestRepository = new LeaveRequestRepository();


