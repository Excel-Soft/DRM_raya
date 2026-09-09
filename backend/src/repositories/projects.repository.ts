import { db, pool } from "../db";
import { projects, tasks, users, customers, productPostingInvoices, type Project, type InsertProject } from "@models/schema";
import { eq, and, sql, desc, or, inArray, gte, lte } from "drizzle-orm";
import { quotedUuidList } from "../utils/sql-safety";

let projectsSchemaEnsured = false;

async function ensureProjectsSchema() {
  if (projectsSchemaEnsured) return;
  projectsSchemaEnsured = true;

  const alterSql = `
    alter table projects
      add column if not exists owner_user_id uuid,
      add column if not exists created_by uuid,
      add column if not exists workspace text,
      add column if not exists department_type text,
      add column if not exists status text default 'Active',
      add column if not exists start_date timestamptz,
      add column if not exists end_date timestamptz,
      add column if not exists notes text,
      add column if not exists created_at timestamptz default now(),
      add column if not exists updated_at timestamptz default now();

    alter table projects alter column created_by drop not null;

    update projects
      set owner_user_id = coalesce(owner_user_id, (select id from users limit 1)),
          created_by = coalesce(created_by, owner_user_id),
          status = coalesce(status, 'Active'),
          created_at = coalesce(created_at, now()),
          updated_at = coalesce(updated_at, now());
  `;

  // One-time backfill of the structured routing department for existing rows.
  // Resolution order mirrors resolveWorkflowRouting: a software_workflows row is
  // a structural SOFTWARE signal; otherwise DND vs PRODUCT_POSTING is split by
  // the same free-text hints (this is the *only* sanctioned place to guess from
  // names — once stored, routing reads the column instead of re-guessing).
  const backfillSql = `
    update drm.projects p set department_type = 'SOFTWARE'
      where p.department_type is null
        and exists (select 1 from drm.software_workflows sw where sw.project_id = p.id);

    update drm.projects p set department_type = 'DND'
      where p.department_type is null
        and (
          lower(coalesce(p.name, '')) ~ '(minisite|mini site|listing|alibaba)'
          or exists (
            select 1 from drm.product_posting_invoices i
            where i.id = p.invoice_id
              and lower(coalesce(i.project_name, '')) ~ '(minisite|mini site|listing|alibaba)'
          )
        );

    update drm.projects p set department_type = 'PRODUCT_POSTING'
      where p.department_type is null
        and (
          exists (select 1 from drm.product_posting_workflows pw where pw.project_id = p.id)
          or p.invoice_id is not null
        );
  `;

  try {
    await pool.query(alterSql);
  } catch (err) {
    console.error("Failed to ensure projects schema (continuing):", err);
  }

  try {
    await pool.query(backfillSql);
  } catch (err) {
    console.error("Failed to backfill project department_type (continuing):", err);
  }
}

export class ProjectsRepository {
  async create(data: any): Promise<Project> {
    await ensureProjectsSchema();
    const insertData = { ...data };
    if (insertData.startDate instanceof Date) insertData.startDate = insertData.startDate.toISOString().split('T')[0];
    if (insertData.endDate instanceof Date) insertData.endDate = insertData.endDate.toISOString().split('T')[0];

    const [project] = await db.insert(projects).values(insertData).returning();

    try {
      await pool.query(
        "update projects set created_by = coalesce(created_by, owner_user_id) where id = $1",
        [project.id],
      );
    } catch (err) {
      console.error("Failed to backfill created_by for project", err);
    }

    return project;
  }

  async findById(id: string): Promise<Project | undefined> {
    await ensureProjectsSchema();
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async findByOwner(userId?: string | string[], statusFilter?: string, fromDate?: Date, toDate?: Date): Promise<Project[]> {
    await ensureProjectsSchema();
    const conditions = [];
    if (userId) {
        if (Array.isArray(userId)) {
            if (userId.length > 0) {
                conditions.push(inArray(projects.ownerUserId, userId));
            } else {
                conditions.push(sql`1=0`);
            }
        } else {
            conditions.push(eq(projects.ownerUserId, userId));
        }
    }

    if (statusFilter) {
      conditions.push(eq(projects.status, statusFilter as any));
    }
    if (fromDate) {
      conditions.push(gte(projects.createdAt, fromDate));
    }
    if (toDate) {
      conditions.push(lte(projects.createdAt, toDate));
    }

    return db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        ownerUserId: projects.ownerUserId,
        invoiceId: projects.invoiceId,
        customerId: projects.customerId,
        workSpace: projects.workSpace,
        departmentType: projects.departmentType,
        startDate: projects.startDate,
        endDate: projects.endDate,
        notes: projects.notes,
        isDeleted: projects.isDeleted,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        gmId: projects.gmId,
        serviceType: projects.serviceType,
        invoiceType: projects.invoiceType,
        projectType: projects.projectType,
        companyName: sql<string>`COALESCE(${customers.companyName}, ${productPostingInvoices.companyName})`
      })
      .from(projects)
      .leftJoin(customers, eq(projects.customerId, customers.id))
      .leftJoin(productPostingInvoices, eq(projects.invoiceId, productPostingInvoices.id))
      .where(conditions.length > 0 ? and(...conditions)! : undefined);
  }

  async findAll(status?: string): Promise<Project[]> {
    await ensureProjectsSchema();
    if (status) {
      return db.select().from(projects).where(eq(projects.status, status as any));
    }
    return db.select().from(projects);
  }

  async update(id: string, data: any): Promise<Project | undefined> {
    await ensureProjectsSchema();
    const updateData = { ...data };
    if (updateData.startDate instanceof Date) updateData.startDate = updateData.startDate.toISOString().split('T')[0];
    if (updateData.endDate instanceof Date) updateData.endDate = updateData.endDate.toISOString().split('T')[0];

    const [updated] = await db
      .update(projects)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await ensureProjectsSchema();
    const result = await db.delete(projects).where(eq(projects.id, id));
    return result.rowCount! > 0;
  }

  async findAllWithStats(userId?: string | string[], fromDate?: Date, toDate?: Date): Promise<ProjectWithStats[]> {
    await ensureProjectsSchema();
    const conditions = [];
    if (userId) {
      if (Array.isArray(userId)) {
          if (userId.length > 0) {
              const idsSql = sql.raw(quotedUuidList(userId));
              conditions.push(
                or(
                  inArray(projects.ownerUserId, userId),
                  sql`EXISTS (SELECT 1 FROM tasks WHERE tasks.project_id = projects.id AND (tasks.owner_user_id = ANY(ARRAY[${idsSql}]::uuid[]) OR tasks.assigned_to_user_id = ANY(ARRAY[${idsSql}]::uuid[])))`
                )
              );
          } else {
              conditions.push(sql`1=0`);
          }
      } else {
          conditions.push(
            or(
              eq(projects.ownerUserId, userId),
              sql`EXISTS (SELECT 1 FROM tasks WHERE tasks.project_id = projects.id AND (tasks.owner_user_id = ${userId} OR tasks.assigned_to_user_id = ${userId}))`
            )
          );
      }
    }

    const projectResults = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        ownerUserId: projects.ownerUserId,
        invoiceId: projects.invoiceId,
        customerId: projects.customerId,
        workSpace: projects.workSpace,
        departmentType: projects.departmentType,
        startDate: projects.startDate,
        endDate: projects.endDate,
        notes: projects.notes,
        isDeleted: projects.isDeleted,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        gmId: projects.gmId,
        serviceType: projects.serviceType,
        invoiceType: projects.invoiceType,
        projectType: projects.projectType,
        companyName: sql<string>`COALESCE(${customers.companyName}, ${productPostingInvoices.companyName})`
      })
      .from(projects)
      .leftJoin(customers, eq(projects.customerId, customers.id))
      .leftJoin(productPostingInvoices, eq(projects.invoiceId, productPostingInvoices.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(projects.updatedAt));

    const projectsWithStats: ProjectWithStats[] = [];

    for (const project of projectResults) {
      const [taskStats] = await db.select({
        total: sql<number>`count(*)::int`,
        toDo: sql<number>`count(*) filter (where ${tasks.status} = 'ToDo')::int`,
        inProgress: sql<number>`count(*) filter (where ${tasks.status} = 'InProgress')::int`,
        blocked: sql<number>`count(*) filter (where ${tasks.status} = 'Blocked')::int`,
        completed: sql<number>`count(*) filter (where ${tasks.status} = 'Completed')::int`,
      })
        .from(tasks)
        .where(eq(tasks.projectId, project.id));

      const [owner] = await db.select().from(users).where(eq(users.id, project.ownerUserId));

      projectsWithStats.push({
        ...project,
        ownerName: owner?.name || "Unknown",
        taskStats: {
          total: taskStats?.total || 0,
          toDo: taskStats?.toDo || 0,
          inProgress: taskStats?.inProgress || 0,
          blocked: taskStats?.blocked || 0,
          completed: taskStats?.completed || 0,
        }
      });
    }

    return projectsWithStats;
  }

  async getOverallStats(userId?: string | string[], fromDate?: Date, toDate?: Date): Promise<{
    total: number;
    active: number;
    completed: number;
    onHold: number;
  }> {
    const conditions = [];
    if (userId) {
      if (Array.isArray(userId)) {
          if (userId.length > 0) {
              const userIdsSql = sql.raw(quotedUuidList(userId));
              conditions.push(
                or(
                  inArray(projects.ownerUserId, userId),
                  sql`EXISTS (SELECT 1 FROM tasks WHERE tasks.project_id = projects.id AND (tasks.owner_user_id IN (${userIdsSql}) OR tasks.assigned_to_user_id IN (${userIdsSql})))`
                )
              );
          } else {
              conditions.push(sql`1=0`);
          }
      } else {
          conditions.push(
            or(
              eq(projects.ownerUserId, userId),
              sql`EXISTS (SELECT 1 FROM tasks WHERE tasks.project_id = projects.id AND (tasks.owner_user_id = ${userId} OR tasks.assigned_to_user_id = ${userId}))`
            )
          );
      }
    }
    
    if (fromDate) {
      conditions.push(gte(projects.createdAt, fromDate));
    }
    if (toDate) {
      conditions.push(lte(projects.createdAt, toDate));
    }

    const [stats] = await db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${projects.status} = 'Active')::int`,
      completed: sql<number>`count(*) filter (where ${projects.status} = 'Completed')::int`,
      onHold: sql<number>`count(*) filter (where ${projects.status} = 'OnHold')::int`,
    })
      .from(projects)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      total: stats?.total || 0,
      active: stats?.active || 0,
      completed: stats?.completed || 0,
      onHold: stats?.onHold || 0,
    };
  }
  async findDelayed(): Promise<ProjectWithStats[]> {
    await ensureProjectsSchema();

    // Find active projects where end_date is in the past
    // We also want to include owner details
    const delayedProjects = await db.select().from(projects)
      .where(and(
        eq(projects.status, 'Active'),
        sql`${projects.endDate} < NOW()`
      ))
      .orderBy(desc(projects.endDate));

    const projectsWithStats: ProjectWithStats[] = [];

    for (const project of delayedProjects) {
      // Calculate "Days Delayed" is done on frontend or we can add it here.
      // For now, let's just return the project structure consistent with other methods

      const [owner] = await db.select().from(users).where(eq(users.id, project.ownerUserId));

      // We might not need full task stats for this view, but to keep the type consistent:
      projectsWithStats.push({
        ...project,
        ownerName: owner?.name || "Unknown",
        taskStats: {
          total: 0,
          toDo: 0,
          inProgress: 0,
          blocked: 0,
          completed: 0
        }
      });
    }

    return projectsWithStats;
  }

  async findPendingInvoices(): Promise<any[]> {
    const query = sql`
      SELECT 
        i.*, 
        i.project_name as "projectName", 
        i.company_name as "companyName",
        i.sales_exec_id as "salesExecId", 
        i.updated_at as "updatedAt", 
        u.username as "salesExecName"
      FROM drm.product_posting_invoices i
      LEFT JOIN drm.users u ON i.sales_exec_id = u.id
      WHERE i.status = 'APPROVED'
      AND NOT EXISTS (
        SELECT 1 FROM drm.projects p WHERE p.invoice_id = i.id
      )
      ORDER BY i.created_at DESC
    `;
    const result = await db.execute(query);
    return result.rows;
  }
  async getDetailedDelayedProjects(): Promise<any[]> {
    await ensureProjectsSchema();
    const query = sql`
      WITH project_base AS (
        SELECT 
          p.id,
          p.name as "project",
          p.created_at as "createDate",
          p.end_date as "deadline",
          p.status,
          COALESCE(c.company_name, i.company_name) as "company",
          u.name as "person",
          u.department as "dep",
          p.owner_user_id
        FROM drm.projects p
        LEFT JOIN drm.customers c ON p.customer_id = c.id
        LEFT JOIN drm.product_posting_invoices i ON p.invoice_id = i.id
        LEFT JOIN drm.users u ON p.owner_user_id = u.id
        WHERE LOWER(p.status) = 'active' AND p.end_date < NOW()
      ),
      approvals AS (
        SELECT 
          project_id,
          MAX(CASE WHEN stage = 'HOD' AND status = 'Approved' THEN 1 ELSE 0 END) as hod_approved,
          MAX(CASE WHEN stage = 'DEP' AND status = 'Approved' THEN 1 ELSE 0 END) as dep_approved
        FROM drm.project_approvals
        GROUP BY project_id
      ),
      task_counts AS (
        SELECT 
          project_id,
          COUNT(*) as total_tasks,
          COUNT(*) FILTER (WHERE status = 'ToDo') as todo_tasks,
          COUNT(*) FILTER (WHERE status = 'READY_FOR_QA') as qa_pending_tasks,
          COUNT(*) FILTER (WHERE status = 'InProgress') as in_progress_tasks
        FROM drm.tasks
        GROUP BY project_id
      )
      SELECT 
        pb.*,
        CASE WHEN a.hod_approved = 1 THEN '0' ELSE '1' END as "hod",
        '0' as "vasDocs", -- Mocking for now as logic is unclear
        CASE WHEN a.dep_approved = 1 THEN '0' ELSE '1' END as "depApp",
        '0' as "depNotAssign", -- Mocking
        CAST(COALESCE(tc.todo_tasks, 0) AS TEXT) as "taskNotStart",
        '0' as "depNotEnd", -- Mocking
        CAST(COALESCE(tc.qa_pending_tasks, 0) AS TEXT) as "qaDepP",
        '0' as "vfyDepP", -- Mocking
        CASE 
          WHEN pb.deadline IS NULL THEN 'N/A'
          WHEN pb.deadline < NOW() THEN '1'
          ELSE '0'
        END as "projectDeadLine",
        COALESCE(EXTRACT(DAY FROM (NOW() - pb.deadline)), 0)::text as "days"
      FROM project_base pb
      LEFT JOIN approvals a ON pb.id::text = a.project_id::text
      LEFT JOIN task_counts tc ON pb.id::text = tc.project_id::text
      ORDER BY pb.deadline ASC
    `;
    const result = await db.execute(query);
    return result.rows;
  }

  async getDetailedUpcomingProjects(): Promise<any[]> {
    await ensureProjectsSchema();
    const query = sql`
      WITH project_base AS (
        SELECT 
          p.id,
          p.name as "project",
          p.created_at as "createDate",
          p.end_date as "deadline",
          p.status,
          COALESCE(c.company_name, i.company_name) as "company",
          u.name as "person",
          u.department as "dep",
          p.owner_user_id
        FROM drm.projects p
        LEFT JOIN drm.customers c ON p.customer_id = c.id
        LEFT JOIN drm.product_posting_invoices i ON p.invoice_id = i.id
        LEFT JOIN drm.users u ON p.owner_user_id = u.id
        WHERE p.end_date >= NOW() AND p.end_date <= NOW() + INTERVAL '7 days'
      ),
      task_counts AS (
        SELECT 
          project_id,
          COUNT(*) as total_tasks,
          COUNT(*) FILTER (WHERE status = 'ToDo') as todo_tasks,
          COUNT(*) FILTER (WHERE status = 'READY_FOR_QA') as qa_pending_tasks,
          COUNT(*) FILTER (WHERE status = 'InProgress') as in_progress_tasks
        FROM drm.tasks
        GROUP BY project_id
      )
      SELECT 
        pb.*,
        '0' as "hod",
        '0' as "vasDocs",
        '0' as "depApp",
        '0' as "depNotAssign",
        CAST(COALESCE(tc.todo_tasks, 0) AS TEXT) as "taskNotStart",
        '0' as "depNotEnd",
        CAST(COALESCE(tc.qa_pending_tasks, 0) AS TEXT) as "qaDepP",
        '0' as "vfyDepP",
        '0' as "projectDeadLine",
        COALESCE(EXTRACT(DAY FROM (pb.deadline - NOW())), 0)::text as "days"
      FROM project_base pb
      LEFT JOIN task_counts tc ON pb.id::text = tc.project_id::text
      ORDER BY pb.deadline ASC
    `;
    const result = await db.execute(query);
    return result.rows;
  }
}

export type ProjectWithStats = Project & {
  ownerName: string;
  companyName?: string;
  taskStats: {
    total: number;
    toDo: number;
    inProgress: number;
    blocked: number;
    completed: number;
  };
};

export const projectsRepository = new ProjectsRepository();
