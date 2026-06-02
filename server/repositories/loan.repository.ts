import { db, pool } from "../db";
import { loanRequests, users, type LoanRequest, type InsertLoanRequest } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export type LoanRequestWithUser = LoanRequest & {
  userName?: string | null;
  managerApproverName?: string | null;
  hodApproverName?: string | null;
};

export type LoanStats = {
  totalRequests: number;
  pending: number;
  managerApproved: number;
  hodApproved: number;
  rejected: number;
  completed: number;
  totalAmountApproved: number;
  totalRemainingAmount: number;
};

export class LoanRepository {
  async findByUserId(userId: string): Promise<LoanRequestWithUser[]> {
    const res = await pool.query(
      `select lr.*, u.full_name
         from drm.loan_requests lr
         left join drm.users u on u.id::text = lr.user_id::text
        where lr.user_id = $1
        order by lr.created_at desc`,
      [userId],
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      amount: r.amount,
      installmentAmount: r.installment_amount,
      remainingAmount: r.remaining_amount,
      detail: r.detail ?? r.reason ?? null,
      status: r.status,
      managerApprovedByUserId: r.manager_approved_by_user_id,
      managerApprovedAt: r.manager_approved_at,
      hodApprovedByUserId: r.hod_approved_by_user_id,
      hodApprovedAt: r.hod_approved_at,
      rejectionReason: r.rejection_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      userName: r.full_name,
    }));
  }

  async findAll(): Promise<LoanRequestWithUser[]> {
    const res = await pool.query(
      `select lr.*, u.full_name
         from drm.loan_requests lr
         left join drm.users u on u.id::text = lr.user_id::text
        order by lr.created_at desc`
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      amount: r.amount,
      installmentAmount: r.installment_amount,
      remainingAmount: r.remaining_amount,
      detail: r.detail ?? r.reason ?? null,
      status: r.status,
      managerApprovedByUserId: r.manager_approved_by_user_id,
      managerApprovedAt: r.manager_approved_at,
      hodApprovedByUserId: r.hod_approved_by_user_id,
      hodApprovedAt: r.hod_approved_at,
      rejectionReason: r.rejection_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      userName: r.full_name,
    }));
  }

  async findById(id: string): Promise<LoanRequestWithUser | null> {
    const res = await pool.query(
      `select lr.*, u.full_name
         from drm.loan_requests lr
         left join drm.users u on u.id::text = lr.user_id::text
        where lr.id = $1
        limit 1`,
      [id],
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      userId: r.user_id,
      amount: r.amount,
      installmentAmount: r.installment_amount,
      remainingAmount: r.remaining_amount,
      detail: r.detail ?? r.reason ?? null,
      status: r.status,
      managerApprovedByUserId: r.manager_approved_by_user_id,
      managerApprovedAt: r.manager_approved_at,
      hodApprovedByUserId: r.hod_approved_by_user_id,
      hodApprovedAt: r.hod_approved_at,
      rejectionReason: r.rejection_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      userName: r.full_name,
    };
  }

  async create(data: InsertLoanRequest): Promise<LoanRequest> {
    const amount = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount;
    const installmentAmount = typeof data.installmentAmount === 'string' ? parseFloat(data.installmentAmount) : data.installmentAmount;

    // Validate amounts
    if (amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }
    if (installmentAmount <= 0) {
      throw new Error("Installment amount must be greater than zero");
    }
    if (installmentAmount > amount) {
      throw new Error("Installment amount cannot exceed total amount");
    }

    console.log(`[LOAN_REPO] Creating loan: userId=${data.userId}, amount=${amount}, installment=${installmentAmount}`);

    const result = await db
      .insert(loanRequests)
      .values({
        userId: data.userId,
        amount: String(amount),
        installmentAmount: String(installmentAmount),
        remainingAmount: String(amount),
        detail: data.detail,
        status: "Pending",
      })
      .returning();

    console.log(`[LOAN_REPO] Created loan: id=${result[0].id}`);
    return result[0];
  }

  async cancel(id: string, userId: string): Promise<LoanRequest | null> {
    const existing = await db
      .select()
      .from(loanRequests)
      .where(
        and(
          eq(loanRequests.id, id),
          eq(loanRequests.userId, userId)
        )!
      )
      .limit(1);

    if (!existing[0] || existing[0].status !== "Pending") {
      return null;
    }

    const result = await db
      .delete(loanRequests)
      .where(eq(loanRequests.id, id))
      .returning();

    return result[0];
  }

  async managerApprove(id: string, approverUserId: string): Promise<LoanRequest | null> {
    const existing = await db
      .select()
      .from(loanRequests)
      .where(eq(loanRequests.id, id))
      .limit(1);

    if (!existing[0] || existing[0].status !== "Pending") {
      return null;
    }

    const result = await db
      .update(loanRequests)
      .set({
        status: "ManagerApproved",
        managerApprovedByUserId: approverUserId,
        managerApprovedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loanRequests.id, id))
      .returning();

    return result[0];
  }

  async hodApprove(id: string, approverUserId: string): Promise<LoanRequest | null> {
    const existing = await db
      .select()
      .from(loanRequests)
      .where(eq(loanRequests.id, id))
      .limit(1);

    if (!existing[0] || existing[0].status !== "ManagerApproved") {
      return null;
    }

    const result = await db
      .update(loanRequests)
      .set({
        status: "HODApproved",
        hodApprovedByUserId: approverUserId,
        hodApprovedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loanRequests.id, id))
      .returning();

    return result[0];
  }

  async reject(id: string, approverUserId: string, reason?: string): Promise<LoanRequest | null> {
    const existing = await db
      .select()
      .from(loanRequests)
      .where(eq(loanRequests.id, id))
      .limit(1);

    if (!existing[0] || (existing[0].status !== "Pending" && existing[0].status !== "ManagerApproved")) {
      return null;
    }

    const result = await db
      .update(loanRequests)
      .set({
        status: "Rejected",
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(loanRequests.id, id))
      .returning();

    return result[0];
  }

  async markAsCompleted(id: string): Promise<LoanRequest | null> {
    const existing = await db
      .select()
      .from(loanRequests)
      .where(eq(loanRequests.id, id))
      .limit(1);

    if (!existing[0] || existing[0].status !== "HODApproved") {
      return null;
    }

    const result = await db
      .update(loanRequests)
      .set({
        status: "Completed",
        remainingAmount: "0",
        updatedAt: new Date(),
      })
      .where(eq(loanRequests.id, id))
      .returning();

    return result[0];
  }

  async updateRemainingAmount(id: string, newRemaining: number): Promise<LoanRequest | null> {
    const existing = await db
      .select()
      .from(loanRequests)
      .where(eq(loanRequests.id, id))
      .limit(1);

    if (!existing[0] || existing[0].status !== "HODApproved") {
      return null;
    }

    const newStatus = newRemaining <= 0 ? "Completed" : "HODApproved";
    const result = await db
      .update(loanRequests)
      .set({
        remainingAmount: String(Math.max(0, newRemaining)),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(loanRequests.id, id))
      .returning();

    return result[0];
  }

  async getStats(userId: string): Promise<LoanStats> {
    const { rows } = await pool.query(
      `select status,
              count(*)::int as count,
              coalesce(sum(amount),0)::numeric as total_amount,
              coalesce(sum(remaining_amount),0)::numeric as total_remaining
         from drm.loan_requests
        where user_id = $1
        group by status`,
      [userId],
    );

    const stats: LoanStats = {
      totalRequests: 0,
      pending: 0,
      managerApproved: 0,
      hodApproved: 0,
      rejected: 0,
      completed: 0,
      totalAmountApproved: 0,
      totalRemainingAmount: 0,
    };

    for (const r of rows) {
      const amount = parseFloat(r.total_amount ?? 0);
      const remaining = parseFloat(r.total_remaining ?? 0);
      stats.totalRequests += Number(r.count ?? 0);
      switch (r.status) {
        case "Pending":
          stats.pending += Number(r.count);
          break;
        case "ManagerApproved":
          stats.managerApproved += Number(r.count);
          stats.totalAmountApproved += amount;
          stats.totalRemainingAmount += remaining;
          break;
        case "HODApproved":
          stats.hodApproved += Number(r.count);
          stats.totalAmountApproved += amount;
          stats.totalRemainingAmount += remaining;
          break;
        case "Rejected":
          stats.rejected += Number(r.count);
          break;
        case "Completed":
          stats.completed += Number(r.count);
          stats.totalAmountApproved += amount;
          break;
      }
    }

    return stats;
  }

  async getActiveLoan(userId: string): Promise<LoanRequestWithUser | null> {
    const results = await db
      .select({
        id: loanRequests.id,
        userId: loanRequests.userId,
        amount: loanRequests.amount,
        installmentAmount: loanRequests.installmentAmount,
        remainingAmount: loanRequests.remainingAmount,
        detail: loanRequests.detail,
        status: loanRequests.status,
        managerApprovedByUserId: loanRequests.managerApprovedByUserId,
        managerApprovedAt: loanRequests.managerApprovedAt,
        hodApprovedByUserId: loanRequests.hodApprovedByUserId,
        hodApprovedAt: loanRequests.hodApprovedAt,
        rejectionReason: loanRequests.rejectionReason,
        createdAt: loanRequests.createdAt,
        updatedAt: loanRequests.updatedAt,
        userName: users.name,
      })
      .from(loanRequests)
      .leftJoin(users, eq(loanRequests.userId, users.id))
      .where(
        and(
          eq(loanRequests.userId, userId),
          eq(loanRequests.status, "HODApproved")
        )!
      )
      .orderBy(desc(loanRequests.createdAt))
      .limit(1);

    return results[0] || null;
  }
}

export const loanRepository = new LoanRepository();

