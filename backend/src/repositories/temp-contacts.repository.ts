import { db } from "../db";
import { tempContacts, customers, users, InsertTempContact, TempContact } from "@models/schema";
import { eq, desc, and, gte, sql, ilike, or, inArray } from "drizzle-orm";

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
    userIds?: string[];
    status?: string;
    grade?: string;
    search?: string;
  }): Promise<TempContact[]> {
    const conditions = [];

    if (filters.userIds) {
      conditions.push(inArray(tempContacts.userId, filters.userIds));
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

  // Marks a temp contact as converted once its own Add Customer form has
  // already created the real drm.customers record (lands in the converting
  // user's Private Pool — that creation goes through the normal
  // POST /api/sales/customers path, not this repository). Deliberately not
  // scoped to the contact's original creator: a manager who can see another
  // user's pending contact (findAllWithFilters already surfaces all of them
  // to managers) must also be able to convert it.
  async markConverted(
    id: string,
    customerId: string,
    convertedByUserId: string,
  ): Promise<TempContact | null | "already_processed"> {
    const [contact] = await db.select().from(tempContacts).where(eq(tempContacts.id, id));
    if (!contact) return null;
    if (contact.status !== "Pending") return "already_processed";

    const [updated] = await db
      .update(tempContacts)
      .set({
        status: "Promoted",
        promotedToCustomerId: customerId,
        promotedAt: new Date(),
        promotedByUserId: convertedByUserId,
        updatedAt: new Date(),
      })
      .where(eq(tempContacts.id, id))
      .returning();

    return updated;
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
