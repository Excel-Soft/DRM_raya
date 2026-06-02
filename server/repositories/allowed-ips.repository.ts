import { db } from "../db";
import { allowedIps, users, type AllowedIp, type InsertAllowedIp } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export type AllowedIpWithCreator = AllowedIp & {
  createdBy?: typeof users.$inferSelect;
};

export class AllowedIpsRepository {
  async create(data: InsertAllowedIp): Promise<AllowedIp> {
    const [allowedIp] = await db.insert(allowedIps).values(data as any).returning();
    return allowedIp;
  }

  async findById(id: string): Promise<AllowedIp | undefined> {
    const [result] = await db
      .select()
      .from(allowedIps)
      .where(eq(allowedIps.id, id));

    return result;
  }

  async findByIp(ip_cidr: string): Promise<AllowedIp | undefined> {
    const [allowedIp] = await db.select().from(allowedIps).where(eq(allowedIps.ip_cidr, ip_cidr));
    return allowedIp;
  }

  async findAll(): Promise<AllowedIp[]> {
    return await db
      .select()
      .from(allowedIps)
      .orderBy(desc(allowedIps.createdAt));
  }

  async update(id: string, data: Partial<InsertAllowedIp>): Promise<AllowedIp | undefined> {
    const [updated] = await db
      .update(allowedIps)
      .set(data)
      .where(eq(allowedIps.id, id))
      .returning();
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(allowedIps).where(eq(allowedIps.id, id));
    return result.rowCount! > 0;
  }
  async isIpAllowed(ip: string): Promise<boolean> {
    const allowedIp = await this.findByIp(ip);
    return !!allowedIp;
  }
}

export const allowedIpsRepository = new AllowedIpsRepository();
