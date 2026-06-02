import { db } from "../db";
import { policies, type Policy, type InsertPolicy } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export class PoliciesRepository {
  async create(data: InsertPolicy): Promise<Policy> {
    const [policy] = await db.insert(policies).values(data).returning();
    return policy;
  }

  async findById(id: string): Promise<Policy | undefined> {
    const [policy] = await db.select().from(policies).where(eq(policies.id, id));
    return policy;
  }

  async findByKey(key: string): Promise<Policy | undefined> {
    const [policy] = await db.select().from(policies).where(eq(policies.key, key));
    return policy;
  }

  async findAll(): Promise<Policy[]> {
    return await db.select().from(policies).orderBy(desc(policies.createdAt));
  }

  async update(id: string, data: Partial<InsertPolicy>): Promise<Policy | undefined> {
    const [updated] = await db
      .update(policies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(policies.id, id))
      .returning();
    return updated;
  }

  async upsertByKey(key: string, data: InsertPolicy): Promise<Policy> {
    const existing = await this.findByKey(key);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return await this.create(data);
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(policies).where(eq(policies.id, id));
    return result.rowCount! > 0;
  }
}

export const policiesRepository = new PoliciesRepository();
