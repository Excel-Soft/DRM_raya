import { db } from "../db";
import { urlPermissions, type UrlPermission, type InsertUrlPermission } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export class UrlPermissionsRepository {
  async create(data: InsertUrlPermission): Promise<UrlPermission> {
    const [permission] = await db.insert(urlPermissions).values(data).returning();
    return permission;
  }

  async findById(id: string): Promise<UrlPermission | undefined> {
    const [permission] = await db.select().from(urlPermissions).where(eq(urlPermissions.id, id));
    return permission;
  }

  async findByPath(path: string): Promise<UrlPermission | undefined> {
    const [permission] = await db.select().from(urlPermissions).where(eq(urlPermissions.path, path));
    return permission;
  }

  async findAll(): Promise<UrlPermission[]> {
    return await db.select().from(urlPermissions).orderBy(urlPermissions.path);
  }

  async update(id: string, data: Partial<InsertUrlPermission>): Promise<UrlPermission | undefined> {
    const [updated] = await db
      .update(urlPermissions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(urlPermissions.id, id))
      .returning();
    return updated;
  }

  async upsertByPath(path: string, data: InsertUrlPermission): Promise<UrlPermission> {
    const existing = await this.findByPath(path);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return await this.create(data);
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(urlPermissions).where(eq(urlPermissions.id, id));
    return result.rowCount! > 0;
  }
}

export const urlPermissionsRepository = new UrlPermissionsRepository();
