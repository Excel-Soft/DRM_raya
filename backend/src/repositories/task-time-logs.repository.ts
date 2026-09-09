import { db } from "../db";
import { taskTimeLogs, tasks, users, InsertTaskTimeLog, TaskTimeLog } from "@models/schema";
import { eq, desc, and, gte, lte, sql, or } from "drizzle-orm";
import { pool } from "../db";

let logsSchemaEnsured = false;

export const taskTimeLogsRepository = {
  async ensureSchema() {
    if (logsSchemaEnsured) return;
    const alterSql = `
      alter table task_time_logs
        add column if not exists time_spent_minutes integer,
        add column if not exists description text,
        add column if not exists log_date timestamptz default now();

      update task_time_logs
        set time_spent_minutes = coalesce(
          time_spent_minutes,
          duration_minutes,
          greatest(floor(extract(epoch from (coalesce(end_at, start_at) - start_at)) / 60)::int, 0)
        )
      where time_spent_minutes is null;

      update task_time_logs
        set description = coalesce(description, notes)
      where description is null and notes is not null;

      update task_time_logs
        set log_date = coalesce(log_date, start_at, created_at, now())
      where log_date is null;

      update task_time_logs
        set time_spent_minutes = coalesce(time_spent_minutes, 0)
      where time_spent_minutes is null;

      alter table task_time_logs
        alter column time_spent_minutes set default 0,
        alter column time_spent_minutes set not null,
        alter column log_date set default now(),
        alter column log_date set not null;

      alter table tasks
        add column if not exists owner_user_id uuid,
        add column if not exists assigned_to_user_id uuid,
        add column if not exists created_by uuid,
        add column if not exists category text,
        add column if not exists priority text,
        add column if not exists status text,
        add column if not exists start_date timestamptz,
        add column if not exists due_date timestamptz,
        add column if not exists notes text;

      update tasks set
        owner_user_id = coalesce(owner_user_id, created_by),
        assigned_to_user_id = coalesce(assigned_to_user_id, assigned_to),
        created_by = coalesce(created_by, owner_user_id),
        status = coalesce(status, 'ToDo'),
        priority = coalesce(priority, 'Medium'),
        category = coalesce(category, 'Work'),
        start_date = coalesce(start_date, created_at),
        due_date = coalesce(due_date, start_date),
        notes = coalesce(notes, '');
    `;
    try {
      await pool.query(alterSql);
      logsSchemaEnsured = true;
    } catch (err) {
      console.error("Failed to ensure task_time_logs schema (continuing):", err);
    }
  },
  async findById(id: string): Promise<TaskTimeLog | undefined> {
    await this.ensureSchema();
    const result = await db.select().from(taskTimeLogs).where(eq(taskTimeLogs.id, id)).limit(1);
    return result[0];
  },

  async findByTaskId(taskId: string): Promise<Array<TaskTimeLog & { user: { id: string; name: string | null } }>> {
    await this.ensureSchema();
    const result = await db
      .select({
        id: taskTimeLogs.id,
        taskId: taskTimeLogs.taskId,
        userId: taskTimeLogs.userId,
        timeSpentMinutes: taskTimeLogs.timeSpentMinutes,
        description: taskTimeLogs.description,
        logDate: taskTimeLogs.logDate,
        createdAt: taskTimeLogs.createdAt,
        user: {
          id: users.id,
          name: users.name,
        },
      })
      .from(taskTimeLogs)
      .innerJoin(users, eq(taskTimeLogs.userId, users.id))
      .where(eq(taskTimeLogs.taskId, taskId))
      .orderBy(desc(taskTimeLogs.logDate));

    return result;
  },

  async findByUserId(userId: string, filters?: {
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<Array<TaskTimeLog & { task: { id: string; title: string } }>> {
    await this.ensureSchema();
    const conditions = [eq(taskTimeLogs.userId, userId)];

    if (filters?.dateFrom) {
      conditions.push(gte(taskTimeLogs.logDate, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(taskTimeLogs.logDate, filters.dateTo));
    }

    const result = await db
      .select({
        id: taskTimeLogs.id,
        taskId: taskTimeLogs.taskId,
        userId: taskTimeLogs.userId,
        timeSpentMinutes: taskTimeLogs.timeSpentMinutes,
        description: taskTimeLogs.description,
        logDate: taskTimeLogs.logDate,
        createdAt: taskTimeLogs.createdAt,
        task: {
          id: tasks.id,
          title: tasks.title,
        },
      })
      .from(taskTimeLogs)
      .innerJoin(tasks, eq(taskTimeLogs.taskId, tasks.id))
      .where(and(...conditions))
      .orderBy(desc(taskTimeLogs.logDate));

    return result;
  },

  async findScoped(filters: {
    userId: string;
    roleId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }): Promise<Array<TaskTimeLog & { task: { id: string; title: string; ownerUserId: string; assignedToUserId: string | null }; user: { id: string; name: string | null } }>> {
    await this.ensureSchema();
    const conditions = [];

    if (filters.dateFrom) {
      conditions.push(gte(taskTimeLogs.logDate, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(taskTimeLogs.logDate, filters.dateTo));
    }

    const isAdmin = (filters.roleId || "").toLowerCase() === "admin";
    if (!isAdmin && filters.userId) {
      conditions.push(
        or(
          eq(taskTimeLogs.userId, filters.userId),
          eq(tasks.ownerUserId, filters.userId),
          eq(tasks.assignedToUserId, filters.userId)
        )
      );
    }

    const query = db
      .select({
        id: taskTimeLogs.id,
        taskId: taskTimeLogs.taskId,
        userId: taskTimeLogs.userId,
        timeSpentMinutes: taskTimeLogs.timeSpentMinutes,
        description: taskTimeLogs.description,
        logDate: taskTimeLogs.logDate,
        createdAt: taskTimeLogs.createdAt,
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
      .from(taskTimeLogs)
      .innerJoin(tasks, eq(taskTimeLogs.taskId, tasks.id))
      .innerJoin(users, eq(taskTimeLogs.userId, users.id))
      .orderBy(desc(taskTimeLogs.logDate))
      .limit(filters.limit || 50);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  },

  async create(data: InsertTaskTimeLog): Promise<TaskTimeLog> {
    await this.ensureSchema();
    const result = await db.insert(taskTimeLogs).values(data).returning();
    return result[0];
  },

  async update(id: string, data: Partial<InsertTaskTimeLog>): Promise<TaskTimeLog> {
    await this.ensureSchema();
    const result = await db
      .update(taskTimeLogs)
      .set(data)
      .where(eq(taskTimeLogs.id, id))
      .returning();
    return result[0];
  },

  async delete(id: string): Promise<void> {
    await this.ensureSchema();
    await db.delete(taskTimeLogs).where(eq(taskTimeLogs.id, id));
  },

  async getTotalTimeByTask(taskId: string): Promise<number> {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${taskTimeLogs.timeSpentMinutes}), 0)` })
      .from(taskTimeLogs)
      .where(eq(taskTimeLogs.taskId, taskId));
    return result[0]?.total || 0;
  },

  async getTotalTimeByUser(userId: string, dateFrom?: Date, dateTo?: Date): Promise<number> {
    const conditions = [eq(taskTimeLogs.userId, userId)];
    
    if (dateFrom) {
      conditions.push(gte(taskTimeLogs.logDate, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(taskTimeLogs.logDate, dateTo));
    }

    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${taskTimeLogs.timeSpentMinutes}), 0)` })
      .from(taskTimeLogs)
      .where(and(...conditions));
    return result[0]?.total || 0;
  },
};
