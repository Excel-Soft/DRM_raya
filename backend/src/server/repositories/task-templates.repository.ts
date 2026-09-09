import { db, pool } from "../db";
import { taskTemplates, InsertTaskTemplate, TaskTemplate } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

let taskTemplatesSchemaEnsured = false;

async function ensureTaskTemplatesSchema() {
  if (taskTemplatesSchemaEnsured) return;
  taskTemplatesSchemaEnsured = true;

  // Add missing columns if the DB still has the older shape (name + template_json only).
  const alterSql = `
    alter table task_templates
      add column if not exists time integer not null default 0,
      add column if not exists detail text,
      add column if not exists repeat_daily integer not null default 0,
      add column if not exists department text,
      add column if not exists created_by_user_id uuid,
      add column if not exists is_active integer not null default 1,
      add column if not exists updated_at timestamptz default now();

    alter table task_templates
      alter column template_json drop not null,
      alter column template_json set default '{}'::jsonb;

    update task_templates set updated_at = coalesce(updated_at, now());
  `;

  try {
    await pool.query(alterSql);
  } catch (err) {
    console.error("Failed to ensure task_templates schema (continuing):", err);
    // Keep going so API doesn't crash even if alter fails (e.g., insufficient perms).
  }
}

export const taskTemplatesRepository = {
  async findAll(department?: string): Promise<TaskTemplate[]> {
    await ensureTaskTemplatesSchema();

    if (department) {
      return db
        .select()
        .from(taskTemplates)
        .where(and(
          eq(taskTemplates.isActive, 1),
          eq(taskTemplates.department, department)
        ))
        .orderBy(desc(taskTemplates.createdAt));
    }
    return db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.isActive, 1))
      .orderBy(desc(taskTemplates.createdAt));
  },

  async findById(id: string): Promise<TaskTemplate | undefined> {
    await ensureTaskTemplatesSchema();

    const [template] = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, id))
      .limit(1);
    return template;
  },

  async create(data: InsertTaskTemplate): Promise<TaskTemplate> {
    await ensureTaskTemplatesSchema();

    const [template] = await db.insert(taskTemplates).values(data).returning();
    return template;
  },

  async update(id: string, data: Partial<InsertTaskTemplate>): Promise<TaskTemplate | undefined> {
    await ensureTaskTemplatesSchema();

    const [template] = await db
      .update(taskTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(taskTemplates.id, id))
      .returning();
    return template;
  },

  async delete(id: string): Promise<boolean> {
    await ensureTaskTemplatesSchema();

    const [template] = await db
      .update(taskTemplates)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(eq(taskTemplates.id, id))
      .returning();
    return !!template;
  },

  async hardDelete(id: string): Promise<boolean> {
    const result = await db
      .delete(taskTemplates)
      .where(eq(taskTemplates.id, id))
      .returning();
    return result.length > 0;
  },
};
