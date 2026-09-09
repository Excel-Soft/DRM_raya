import { db } from "../db";
import { projectPayments, users, InsertProjectPayment, ProjectPayment } from "@shared/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";

export const projectPaymentsRepository = {
  async findById(id: string): Promise<ProjectPayment | undefined> {
    const result = await db.select().from(projectPayments).where(eq(projectPayments.id, id)).limit(1);
    return result[0];
  },

  async findByProjectId(projectId: string): Promise<Array<ProjectPayment & { paidBy: { id: string; name: string | null } | null }>> {
    const result = await db
      .select({
        id: projectPayments.id,
        projectId: projectPayments.projectId,
        amount: projectPayments.amount,
        paymentMethod: projectPayments.paymentMethod,
        reference: projectPayments.reference,
        notes: projectPayments.notes,
        paidByUserId: projectPayments.paidByUserId,
        paidAt: projectPayments.paidAt,
        createdAt: projectPayments.createdAt,
        paidBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(projectPayments)
      .leftJoin(users, eq(projectPayments.paidByUserId, users.id))
      .where(eq(projectPayments.projectId, projectId))
      .orderBy(desc(projectPayments.paidAt));

    return result;
  },

  async findAll(filters?: {
    projectId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<ProjectPayment[]> {
    const conditions = [];

    if (filters?.projectId) {
      conditions.push(eq(projectPayments.projectId, filters.projectId));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(projectPayments.paidAt, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(projectPayments.paidAt, filters.dateTo));
    }

    const query = db.select().from(projectPayments).orderBy(desc(projectPayments.paidAt));

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  },

  async create(data: InsertProjectPayment): Promise<ProjectPayment> {
    const result = await db.insert(projectPayments).values(data).returning();
    return result[0];
  },

  async getTotalByProject(projectId: string): Promise<number> {
    const payments = await db
      .select({ amount: projectPayments.amount })
      .from(projectPayments)
      .where(eq(projectPayments.projectId, projectId));

    return payments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
  },
};
