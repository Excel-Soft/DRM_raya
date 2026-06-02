import { db } from "../db";
import { tempContacts, customers, users, InsertTempContact, TempContact } from "@shared/schema";
import { eq, desc, and, gte, sql, ilike, or } from "drizzle-orm";

export const tempContactsRepository = {
  async create(data: InsertTempContact): Promise<TempContact> {
    const [result] = await db.insert(tempContacts).values(data).returning();
    return result;
  },

  async findById(id: string, userId?: string): Promise<TempContact | null> {
    const [result] = await db
      .select()
      .from(tempContacts)
      .where(
        userId
          ? and(eq(tempContacts.id, id), eq(tempContacts.userId, userId))
          : eq(tempContacts.id, id),
      );
    return result || null;
  },

  async findByUserId(userId: string): Promise<TempContact[]> {
    return db.select().from(tempContacts)
      .where(eq(tempContacts.userId, userId))
      .orderBy(desc(tempContacts.createdAt));
  },

  async findAllWithFilters(filters: {
    userId?: string;
    status?: string;
    grade?: string;
    search?: string;
  }): Promise<TempContact[]> {
    const conditions = [];
    
    if (filters.userId) {
      conditions.push(eq(tempContacts.userId, filters.userId));
    }
    if (filters.status) {
      conditions.push(eq(tempContacts.status, filters.status as "Pending" | "Promoted" | "Rejected"));
    }
    if (filters.grade) {
      conditions.push(eq(tempContacts.grade, filters.grade));
    }
    if (filters.search) {
      conditions.push(
        or(
          ilike(tempContacts.personName, `%${filters.search}%`),
          ilike(tempContacts.email, `%${filters.search}%`),
          ilike(tempContacts.mobile, `%${filters.search}%`)
        )
      );
    }

    return db.select().from(tempContacts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tempContacts.createdAt));
  },

  async getStats(userId: string): Promise<{
    total: number;
    pending: number;
    promoted: number;
    rejected: number;
    thisWeek: number;
  }> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [stats] = await db.select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${tempContacts.status} = 'Pending')::int`,
      promoted: sql<number>`count(*) filter (where ${tempContacts.status} = 'Promoted')::int`,
      rejected: sql<number>`count(*) filter (where ${tempContacts.status} = 'Rejected')::int`,
      thisWeek: sql<number>`count(*) filter (where ${tempContacts.createdAt} >= ${weekAgo})::int`,
    })
    .from(tempContacts)
    .where(eq(tempContacts.userId, userId));

    return {
      total: stats?.total || 0,
      pending: stats?.pending || 0,
      promoted: stats?.promoted || 0,
      rejected: stats?.rejected || 0,
      thisWeek: stats?.thisWeek || 0,
    };
  },

  async getNoGradeContacts(userId: string): Promise<TempContact[]> {
    return db.select().from(tempContacts)
      .where(and(
        eq(tempContacts.userId, userId),
        or(
          eq(tempContacts.grade, ""),
          sql`${tempContacts.grade} IS NULL`
        )
      ))
      .orderBy(desc(tempContacts.createdAt));
  },

  async promoteToCustomer(
    id: string, 
    customerId: string, 
    promotedByUserId: string,
    userId: string,
  ): Promise<TempContact | null> {
    const [result] = await db.update(tempContacts)
      .set({
        status: "Promoted",
        promotedToCustomerId: customerId,
        promotedAt: new Date(),
        promotedByUserId,
        updatedAt: new Date(),
      })
      .where(and(eq(tempContacts.id, id), eq(tempContacts.userId, userId)))
      .returning();
    return result || null;
  },

  async reject(id: string, userId: string): Promise<TempContact | null> {
    const [result] = await db.update(tempContacts)
      .set({
        status: "Rejected",
        updatedAt: new Date(),
      })
      .where(and(eq(tempContacts.id, id), eq(tempContacts.userId, userId)))
      .returning();
    return result || null;
  },

  async delete(id: string, userId: string): Promise<boolean> {
    await db
      .delete(tempContacts)
      .where(and(eq(tempContacts.id, id), eq(tempContacts.userId, userId)));
    return true;
  },
};
