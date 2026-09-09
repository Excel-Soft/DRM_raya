import { db, pool } from "../db";
import { tasks, users, projects, type Task, type InsertTask } from "@shared/schema";
import { eq, and, sql, or, desc, lte, gte, isNotNull, ilike, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { quotedUuidList } from "../utils/sql-safety";

export type TaskWithOwner = Task & {
  owner: typeof users.$inferSelect;
};

export type TaskBoardItem = Task & {
  owner?: typeof users.$inferSelect | null;
  assignee?: { id: string; name: string | null } | null;
  project?: { id: string; name: string | null } | null;
};

let tasksSchemaEnsured = false;
let usersSchemaEnsuredForTasks = false;

async function ensureTasksSchema() {
  if (tasksSchemaEnsured) return;
  tasksSchemaEnsured = true;

  const alterSql = `
    alter table tasks
      add column if not exists owner_user_id uuid,
      add column if not exists assigned_to_user_id uuid,
      add column if not exists created_by uuid,
      add column if not exists participants text[] default '{}'::text[],
      add column if not exists category text default 'Work',
      add column if not exists priority text default 'Medium',
      add column if not exists status text default 'ToDo',
      add column if not exists start_date timestamptz,
      add column if not exists due_date timestamptz,
      add column if not exists notes text,
      add column if not exists timer_started_at timestamptz,
      add column if not exists created_at timestamptz default now(),
      add column if not exists updated_at timestamptz default now();

    update tasks set
      owner_user_id = coalesce(owner_user_id, created_by),
      assigned_to_user_id = coalesce(assigned_to_user_id, assigned_to),
      created_by = coalesce(created_by, owner_user_id),
      status = coalesce(status, 'ToDo'),
      priority = coalesce(priority, 'Medium'),
      category = coalesce(category, 'Work'),
      participants = coalesce(participants, '{}'::text[]),
      created_at = coalesce(created_at, now()),
      updated_at = coalesce(updated_at, now());

    alter table tasks alter column created_by drop not null;
  `;

  try {
    await pool.query(alterSql);
  } catch (err) {
    console.error("Failed to ensure tasks schema (continuing):", err);
  }
}

async function ensureUsersSchemaForTasks() {
  if (usersSchemaEnsuredForTasks) return;
  usersSchemaEnsuredForTasks = true;

  const alterSql = `
    alter table users
      add column if not exists username text,
      add column if not exists name text,
      add column if not exists password text,
      add column if not exists role_id text,
      add column if not exists branch text,
      add column if not exists country text,
      add column if not exists created_at timestamptz default now();

    update users set
      username = coalesce(username, email),
      name = coalesce(name, username, email),
      password = coalesce(password, ''),
      role_id = coalesce(role_id, 'sales_executive'),
      branch = coalesce(branch, 'HQ'),
      country = coalesce(country, 'UAE'),
      created_at = coalesce(created_at, now());
  `;

  try {
    await pool.query(alterSql);
  } catch (err) {
    console.error("Failed to ensure users schema for tasks (continuing):", err);
  }
}

export class TasksRepository {
  async create(data: InsertTask): Promise<Task> {
    await ensureTasksSchema();
    await ensureUsersSchemaForTasks();
    const [task] = await db.insert(tasks).values(data).returning();
    return task;
  }

  async findById(id: string): Promise<TaskWithOwner | undefined> {
    await ensureTasksSchema();
    await ensureUsersSchemaForTasks();
    const [result] = await db
      .select()
      .from(tasks)
      .innerJoin(users, eq(tasks.ownerUserId, users.id))
      .where(eq(tasks.id, id));

    if (!result) return undefined;

    return {
      ...result.tasks,
      owner: result.users,
    };
  }

  async findAll(filters?: {
    status?: string;
    projectId?: string;
    ownerUserId?: string;
    participantUserId?: string;
    priority?: string;
    category?: string;
  }): Promise<TaskWithOwner[]> {
    await ensureTasksSchema();
    await ensureUsersSchemaForTasks();
    const conditions: any[] = [];

    if (filters?.status) {
      conditions.push(eq(tasks.status, filters.status as any));
    }

    if (filters?.projectId) {
      conditions.push(eq(tasks.projectId, filters.projectId));
    }

    if (filters?.ownerUserId) {
      conditions.push(eq(tasks.ownerUserId, filters.ownerUserId));
    }

    if (filters?.participantUserId) {
      // Check if user ID is in participants array
      conditions.push(sql`${filters.participantUserId} = ANY(${tasks.participants})`);
    }

    if (filters?.priority) {
      conditions.push(eq(tasks.priority, filters.priority as any));
    }

    if (filters?.category) {
      conditions.push(eq(tasks.category, filters.category as any));
    }

    const results = await db
      .select()
      .from(tasks)
      .innerJoin(users, eq(tasks.ownerUserId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return results.map((row) => ({
      ...row.tasks,
      owner: row.users,
    }));
  }

  async update(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    await ensureTasksSchema();
    await ensureUsersSchemaForTasks();
    const [updated] = await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return result.rowCount! > 0;
  }

  async updateStatus(
    id: string,
    status: string,
    requestingUserId: string
  ): Promise<{ success: boolean; error?: string; task?: Task }> {
    await ensureTasksSchema();
    await ensureUsersSchemaForTasks();
    // First, get the task to verify ownership
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));

    if (!task) {
      return { success: false, error: "Task not found" };
    }

    // Allow owner or assigned user to change status
    if (task.ownerUserId !== requestingUserId && task.assignedToUserId !== requestingUserId) {
      return {
        success: false,
        error: "Only the task owner or assignee can change the status",
      };
    }

    const [updated] = await db
      .update(tasks)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();

    return { success: true, task: updated };
  }

  async getStats(userId?: string | string[], from?: Date, to?: Date): Promise<{
    total: number;
    toDo: number;
    inProgress: number;
    blocked: number;
    completed: number;
    overdue: number;
  }> {
    await ensureTasksSchema();
    await ensureUsersSchemaForTasks();
    const now = new Date();
    const conditions = [];
    if (userId) {
      if (Array.isArray(userId)) {
          if (userId.length > 0) {
              conditions.push(or(inArray(tasks.ownerUserId, userId), inArray(tasks.assignedToUserId, userId)));
          } else {
              conditions.push(sql`1=0`);
          }
      } else {
          conditions.push(or(eq(tasks.ownerUserId, userId), eq(tasks.assignedToUserId, userId)));
      }
    }

    if (from) {
      conditions.push(gte(tasks.createdAt, from));
    }
    if (to) {
      conditions.push(lte(tasks.createdAt, to));
    }

    const [stats] = await db.select({
      total: sql<number>`count(*)::int`,
      toDo: sql<number>`count(*) filter (where ${tasks.status} = 'ToDo')::int`,
      inProgress: sql<number>`count(*) filter (where ${tasks.status} = 'InProgress')::int`,
      blocked: sql<number>`count(*) filter (where ${tasks.status} = 'Blocked')::int`,
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'Completed')::int`,
      overdue: sql<number>`count(*) filter (where ${tasks.dueDate} < ${now} and ${tasks.status} != 'Completed')::int`,
    })
      .from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      total: stats?.total || 0,
      toDo: stats?.toDo || 0,
      inProgress: stats?.inProgress || 0,
      blocked: stats?.blocked || 0,
      completed: stats?.completed || 0,
      overdue: stats?.overdue || 0,
    };
  }

  async getStatsByProject(projectId: string): Promise<{
    total: number;
    toDo: number;
    inProgress: number;
    blocked: number;
    completed: number;
  }> {
    await ensureTasksSchema();
    await ensureUsersSchemaForTasks();
    const [stats] = await db.select({
      total: sql<number>`count(*)::int`,
      toDo: sql<number>`count(*) filter (where ${tasks.status} = 'ToDo')::int`,
      inProgress: sql<number>`count(*) filter (where ${tasks.status} = 'InProgress')::int`,
      blocked: sql<number>`count(*) filter (where ${tasks.status} = 'Blocked')::int`,
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'Completed')::int`,
    })
      .from(tasks)
      .where(eq(tasks.projectId, projectId));

    return {
      total: stats?.total || 0,
      toDo: stats?.toDo || 0,
      inProgress: stats?.inProgress || 0,
      blocked: stats?.blocked || 0,
      completed: stats?.completed || 0,
    };
  }

  async findByProject(projectId: string): Promise<TaskWithAssignee[]> {
    await ensureTasksSchema();
    await ensureUsersSchemaForTasks();
    const results = await db
      .select({
        task: tasks,
        owner: users,
      })
      .from(tasks)
      .innerJoin(users, eq(tasks.ownerUserId, users.id))
      .where(eq(tasks.projectId, projectId))
      .orderBy(desc(tasks.updatedAt));

    return results.map((row) => ({
      ...row.task,
      owner: row.owner,
    }));
  }

  async findOverdue(userId?: string): Promise<Task[]> {
    await ensureTasksSchema();
    await ensureUsersSchemaForTasks();
    const now = new Date();
    const conditions = [
      lte(tasks.dueDate, now),
      sql`${tasks.status} != 'Completed'`
    ];

    if (userId) {
      conditions.push(
        or(eq(tasks.ownerUserId, userId), eq(tasks.assignedToUserId, userId))!
      );
    }

    return db.select().from(tasks)
      .where(and(...conditions))
      .orderBy(tasks.dueDate);
  }

  async findByAssignee(assignedToUserId: string, status?: string): Promise<Task[]> {
    await ensureTasksSchema();
    await ensureUsersSchemaForTasks();
    const conditions = [eq(tasks.assignedToUserId, assignedToUserId)];
    if (status) {
      conditions.push(eq(tasks.status, status as any));
    }
    return db.select().from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.updatedAt));
  }

  async findBoard(filters: {
    search?: string;
    projectId?: string;
    assignedToUserId?: string;
    priority?: string;
    from?: Date;
    to?: Date;
    userId?: string;
    roleId?: string;
    filterUserIds?: string[];
  }): Promise<TaskBoardItem[]> {
    await ensureTasksSchema();
    await ensureUsersSchemaForTasks();

    const conditions: any[] = [];

    const isAdmin = (filters.roleId || "").toLowerCase() === "admin";
    if (!isAdmin) {
      if (filters.filterUserIds && filters.filterUserIds.length > 0) {
        const ids = quotedUuidList(filters.filterUserIds);
        conditions.push(sql`tasks.owner_user_id = ANY(ARRAY[${sql.raw(ids)}]::uuid[])`);
      } else if (filters.userId && filters.roleId !== "sales_manager") {
        conditions.push(or(eq(tasks.ownerUserId, filters.userId), eq(tasks.assignedToUserId, filters.userId)));
      }
    }

    if (filters.projectId) {
      conditions.push(eq(tasks.projectId, filters.projectId));
    }

    if (filters.assignedToUserId) {
      conditions.push(eq(tasks.assignedToUserId, filters.assignedToUserId));
    }

    if (filters.priority) {
      conditions.push(eq(tasks.priority, filters.priority as any));
    }

    const hasValidFrom = filters.from && !isNaN(filters.from.getTime());
    if (hasValidFrom && filters.from) {
      conditions.push(gte(tasks.createdAt, filters.from!));
    }

    const hasValidTo = filters.to && !isNaN(filters.to.getTime());
    if (hasValidTo && filters.to) {
      conditions.push(lte(tasks.createdAt, filters.to!));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(tasks.title, `%${filters.search}%`),
          ilike(tasks.description, `%${filters.search}%`)
        )
      );
    }

    const assignees = alias(users, "assignees");

    const query = db
      .select({
        task: tasks,
        owner: users,
        assignee: {
          id: assignees.id,
          name: assignees.name,
        },
        project: {
          id: projects.id,
          name: projects.name,
        },
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.ownerUserId, users.id))
      .leftJoin(assignees, eq(tasks.assignedToUserId, assignees.id))
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .orderBy(desc(tasks.updatedAt));

    const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

    return rows.map((row) => ({
      ...row.task,
      owner: row.owner,
      assignee: row.assignee?.id ? { id: row.assignee.id, name: row.assignee.name } : null,
      project: row.project?.id ? { id: row.project.id, name: row.project.name } : null,
    }));
  }
}

export type TaskWithAssignee = Task & {
  owner: typeof users.$inferSelect;
};

export const tasksRepository = new TasksRepository();
