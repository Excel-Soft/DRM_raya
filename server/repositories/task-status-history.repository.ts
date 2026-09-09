import { db, pool } from "../db";
import { taskStatusHistory, tasks, users, InsertTaskStatusHistory, TaskStatusHistory } from "@shared/schema";
import { eq, desc, and, gte, lte, or } from "drizzle-orm";

let statusSchemaEnsured = false;

export const taskStatusHistoryRepository = {
  async ensureSchema() {
    if (statusSchemaEnsured) return;
    const alterSql = `
      alter table task_status_history
        add column if not exists user_id uuid,
        add column if not exists notes text;

      update task_status_history
        set user_id = coalesce(user_id, changed_by)
      where user_id is null;

      do $$
      begin
        if not exists (
          select 1 from pg_constraint where conname = 'task_status_history_user_id_users_id_fk'
        ) then
          alter table task_status_history
            add constraint task_status_history_user_id_users_id_fk
            foreign key (user_id) references users(id) on delete set null;
        end if;
      end $$;

      do $$
      begin
        if not exists (select 1 from pg_class where relname = 'task_status_history_user_id_idx') then
          create index task_status_history_user_id_idx on task_status_history (user_id);
        end if;
      end $$;
    `;
    try {
      await pool.query(alterSql);
      statusSchemaEnsured = true;
    } catch (err) {
      console.error("Failed to ensure task_status_history schema (continuing):", err);
    }
  },
  async findById(id: string): Promise<TaskStatusHistory | undefined> {
    await this.ensureSchema();
    const result = await db.select().from(taskStatusHistory).where(eq(taskStatusHistory.id, id)).limit(1);
    return result[0];
  },

  async findByTaskId(taskId: string): Promise<Array<TaskStatusHistory & { user: { id: string; name: string | null } }>> {
    await this.ensureSchema();
    const result = await db
      .select({
        id: taskStatusHistory.id,
        taskId: taskStatusHistory.taskId,
        userId: taskStatusHistory.userId,
        fromStatus: taskStatusHistory.fromStatus,
        toStatus: taskStatusHistory.toStatus,
        changedAt: taskStatusHistory.changedAt,
        notes: taskStatusHistory.notes,
        user: {
          id: users.id,
          name: users.name,
        },
      })
      .from(taskStatusHistory)
      .innerJoin(users, eq(taskStatusHistory.userId, users.id))
      .where(eq(taskStatusHistory.taskId, taskId))
      .orderBy(desc(taskStatusHistory.changedAt));

    return result;
  },

  async findRecent(filters?: {
    userId?: string;
    roleId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }): Promise<Array<TaskStatusHistory & { task: { id: string; title: string; ownerUserId: string; assignedToUserId: string | null }; user: { id: string; name: string | null } }>> {
    await this.ensureSchema();
    const conditions = [];

    if (filters?.dateFrom) {
      conditions.push(gte(taskStatusHistory.changedAt, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(taskStatusHistory.changedAt, filters.dateTo));
    }

    const isAdmin = (filters?.roleId || "").toLowerCase() === "admin";
    if (!isAdmin && filters?.userId) {
      conditions.push(
        or(
          eq(tasks.ownerUserId, filters.userId),
          eq(tasks.assignedToUserId, filters.userId)
        )
      );
    }

    const query = db
      .select({
        id: taskStatusHistory.id,
        taskId: taskStatusHistory.taskId,
        userId: taskStatusHistory.userId,
        fromStatus: taskStatusHistory.fromStatus,
        toStatus: taskStatusHistory.toStatus,
        changedAt: taskStatusHistory.changedAt,
        notes: taskStatusHistory.notes,
        task: {
          id: tasks.id,
          title: tasks.title,
          ownerUserId: tasks.ownerUserId,
          assignedToUserId: tasks.assignedToUserId,
        },
        user: {
          id: users.id,
          name: users.name,
        },
      })
      .from(taskStatusHistory)
      .innerJoin(tasks, eq(taskStatusHistory.taskId, tasks.id))
      .innerJoin(users, eq(taskStatusHistory.userId, users.id))
      .orderBy(desc(taskStatusHistory.changedAt))
      .limit(filters?.limit || 50);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  },

  async create(data: InsertTaskStatusHistory): Promise<TaskStatusHistory> {
    await this.ensureSchema();
    const result = await db.insert(taskStatusHistory).values(data).returning();
    return result[0];
  },
};
