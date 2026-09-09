import { db } from "../db";
import { roles, type Role, type InsertRole } from "@models/schema";
import { eq, desc } from "drizzle-orm";

export class RolesRepository {
  async create(data: InsertRole): Promise<Role> {
    const [role] = await db.insert(roles).values(data).returning();
    return role;
  }

  async findById(id: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role;
  }

  async findByName(name: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.name, name));
    return role;
  }

  async findAll(): Promise<Role[]> {
    return await db.select().from(roles).orderBy(roles.name);
  }

  async update(id: string, data: Partial<InsertRole>): Promise<Role | undefined> {
    const [updated] = await db
      .update(roles)
      .set(data)
      .where(eq(roles.id, id))
      .returning();
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(roles).where(eq(roles.id, id));
    return result.rowCount! > 0;
  }
}

export const rolesRepository = new RolesRepository();
