import { db, pool } from "../db";
import { projectApprovals, projects, users, customers, productPostingInvoices, InsertProjectApproval, ProjectApproval } from "@models/schema";
import { eq, desc, and, or, inArray, sql } from "drizzle-orm";
import { isManagerialRole } from "../utils/role-utils";

let approvalsSchemaEnsured = false;

async function ensureApprovalsSchema() {
  if (approvalsSchemaEnsured) return;

  const addColumnsSql = `
    alter table project_approvals
      add column if not exists requested_by_user_id uuid,
      add column if not exists entity_type text,
      add column if not exists entity_id text,
      add column if not exists title text,
      add column if not exists description text,
      add column if not exists current_stage text,
      add column if not exists stage text,
      add column if not exists manager_user_id uuid,
      add column if not exists hod_user_id uuid,
      add column if not exists department_id text,
      add column if not exists approver_user_id uuid,
      add column if not exists approved_at timestamptz,
      add column if not exists rejection_reason text,
      add column if not exists created_at timestamptz default now(),
      add column if not exists updated_at timestamptz default now();
  `;

  try {
    await pool.query(addColumnsSql);
    await pool.query(`
      update project_approvals
        set created_at = coalesce(created_at, now()),
            updated_at = coalesce(updated_at, now()),
            stage = coalesce(stage, 'Manager'),
            current_stage = coalesce(current_stage, stage)
    `);
    approvalsSchemaEnsured = true;
  } catch (err) {
    console.error("Failed to ensure project_approvals schema (continuing):", err);
    approvalsSchemaEnsured = false;
  }
}

export interface ProjectWithCustomerInfo {
  id: string;
  name: string;
  description: string | null;
  ownerUserId: string;
  invoiceId: string | null;
  workSpace: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  companyName: string;
}

export interface PendingApproval {
  id: string;
  projectId: string;
  stage: string;
  status: string;
  approverUserId: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  project: ProjectWithCustomerInfo;
  approver: { id: string; name: string } | null;
}

export const projectApprovalsRepository = {
  async findById(id: string): Promise<ProjectApproval | undefined> {
    await ensureApprovalsSchema();
    const result = await db.select().from(projectApprovals).where(eq(projectApprovals.id, id)).limit(1);
    return result[0];
  },

  async findByProjectId(projectId: string): Promise<ProjectApproval[]> {
    await ensureApprovalsSchema();
    return db
      .select()
      .from(projectApprovals)
      .where(eq(projectApprovals.projectId, projectId))
      .orderBy(desc(projectApprovals.createdAt));
  },

  async findPending(stage?: string, scopeUserId?: string, userRole?: string): Promise<PendingApproval[]> {
    await ensureApprovalsSchema();
    const conditions = [eq(projectApprovals.status, "Pending")];

    if (stage) {
      conditions.push(eq(projectApprovals.stage, stage));
    }

    const isAdmin = isManagerialRole(userRole);
    if (!isAdmin && scopeUserId) {
      conditions.push(or(eq(projectApprovals.approverUserId, scopeUserId), eq(projectApprovals.requestedBy, scopeUserId))!);
    }

    const result = await db
      .select({
        id: projectApprovals.id,
        projectId: projectApprovals.projectId,
        stage: projectApprovals.stage,
        status: projectApprovals.status,
        approverUserId: projectApprovals.approverUserId,
        approvedAt: projectApprovals.approvedAt,
        rejectionReason: projectApprovals.rejectionReason,
        createdAt: projectApprovals.createdAt,
        updatedAt: projectApprovals.updatedAt,
        project: {
          id: projects.id,
          name: projects.name,
          description: projects.description,
          ownerUserId: projects.ownerUserId,
          invoiceId: projects.invoiceId,
          workSpace: projects.workSpace,
          status: projects.status,
          startDate: projects.startDate,
          endDate: projects.endDate,
          notes: projects.notes,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
          companyName: sql<string>`COALESCE(${customers.companyName}, ${productPostingInvoices.companyName})`
        },
        approver: {
          id: users.id,
          name: users.name,
        },
      })
      .from(projectApprovals)
      .leftJoin(projects, eq(projectApprovals.projectId, projects.id))
      .leftJoin(customers, eq(projects.customerId, customers.id))
      .leftJoin(productPostingInvoices, eq(projects.invoiceId, productPostingInvoices.id))
      .leftJoin(users, eq(projectApprovals.approverUserId, users.id))
      .where(and(...conditions))
      .orderBy(desc(projectApprovals.createdAt));

    return result.map((r) => ({
      ...r,
      project: r.project as ProjectWithCustomerInfo,
      approver: r.approver ? {
        id: r.approver.id,
        name: r.approver.name || "Unknown",
      } : null,
    }));
  },

  async findByStages(stages: string[]): Promise<ProjectApproval[]> {
    await ensureApprovalsSchema();
    return db
      .select()
      .from(projectApprovals)
      .where(inArray(projectApprovals.stage, stages))
      .orderBy(desc(projectApprovals.createdAt));
  },

  async create(data: InsertProjectApproval): Promise<ProjectApproval> {
    await ensureApprovalsSchema();
    const result = await db.insert(projectApprovals).values(data).returning();
    return result[0];
  },

  // Phase 12 — only a still-"Pending" approval may be decided. Previously the
  // WHERE clause matched on id alone, so an already-Approved/Rejected row
  // could be silently re-decided (e.g. approved, then rejected afterward).
  // Returning null (no matching row) lets the caller distinguish "already
  // decided" from a hard failure.
  async approve(id: string, approverUserId: string): Promise<ProjectApproval | null> {
    await ensureApprovalsSchema();
    const result = await db
      .update(projectApprovals)
      .set({
        status: "Approved",
        approverUserId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(projectApprovals.id, id), eq(projectApprovals.status, "Pending")))
      .returning();
    return result[0] ?? null;
  },

  async reject(id: string, approverUserId: string, rejectionReason: string): Promise<ProjectApproval | null> {
    await ensureApprovalsSchema();
    const result = await db
      .update(projectApprovals)
      .set({
        status: "Rejected",
        approverUserId,
        rejectionReason,
        updatedAt: new Date(),
      })
      .where(and(eq(projectApprovals.id, id), eq(projectApprovals.status, "Pending")))
      .returning();
    return result[0] ?? null;
  },

  async getApprovalStats(): Promise<{ pending: number; approved: number; rejected: number; pendingInvoices: number }> {
    await ensureApprovalsSchema();
    const all = await db.select({ status: projectApprovals.status }).from(projectApprovals);
    
    // Also count pending invoices awaiting project creation
    const invoiceRes = await db.execute(sql`
      SELECT count(*)::int as count 
      FROM drm.product_posting_invoices i
      WHERE i.status = 'APPROVED'
      AND NOT EXISTS (SELECT 1 FROM drm.projects p WHERE p.invoice_id = i.id)
    `);
    const pendingInvoices = Number((invoiceRes.rows[0] as any)?.count || 0);

    return {
      pending: all.filter((a) => a.status === "Pending").length,
      approved: all.filter((a) => a.status === "Approved").length,
      rejected: all.filter((a) => a.status === "Rejected").length,
      pendingInvoices
    };
  },

  async findList(params: {
    stage: string;
    status: string;
    search: string;
    page: number;
    pageSize: number;
    userId: string;
    roleId?: string;
  }): Promise<{ items: PendingApproval[]; total: number }> {
    await ensureApprovalsSchema();
    const conditions = [];

    if (params.status && params.status !== "all") {
      conditions.push(eq(projectApprovals.status, params.status.charAt(0).toUpperCase() + params.status.slice(1) as any));
    }

    if (params.stage && params.stage !== "all") {
      conditions.push(eq(projectApprovals.stage, params.stage));
    }

    // Basic scope: if not admin, restrict to approvals assigned to the user as approver
    // Basic scope: if not admin/manager, restrict to approvals assigned to the user as approver
    // Basic scope: if not admin/manager, restrict to approvals assigned to the user as approver OR requested by them
    const isAdmin = isManagerialRole(params.roleId);
    if (!isAdmin) {
      conditions.push(or(eq(projectApprovals.approverUserId, params.userId), eq(projectApprovals.requestedBy, params.userId))!);
    }

    const offset = (params.page - 1) * params.pageSize;

    const totalRes = await db.select({ count: sql<number>`count(*)::int` })
      .from(projectApprovals)
      .where(conditions.length ? and(...conditions) : undefined);
    const total = totalRes[0]?.count || 0;

    const list = await db
      .select({
        id: projectApprovals.id,
        projectId: projectApprovals.projectId,
        stage: projectApprovals.stage,
        status: projectApprovals.status,
        approverUserId: projectApprovals.approverUserId,
        approvedAt: projectApprovals.approvedAt,
        rejectionReason: projectApprovals.rejectionReason,
        createdAt: projectApprovals.createdAt,
        updatedAt: projectApprovals.updatedAt,
        project: {
          id: projects.id,
          name: projects.name,
          status: projects.status,
          workSpace: projects.workSpace,
          companyName: sql<string>`COALESCE(${customers.companyName}, ${productPostingInvoices.companyName})`
        }
      })
      .from(projectApprovals)
      .leftJoin(projects, eq(projectApprovals.projectId, projects.id))
      .leftJoin(customers, eq(projects.customerId, customers.id))
      .leftJoin(productPostingInvoices, eq(projects.invoiceId, productPostingInvoices.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(projectApprovals.createdAt))
      .limit(params.pageSize)
      .offset(offset);

    return { items: list as any as PendingApproval[], total };
  },

  async getSummaryByStage(stage: string, userId: string, roleId?: string): Promise<{ pending: number; approved: number; rejected: number }> {
    await ensureApprovalsSchema();
    const conditions = [];
    if (stage && stage !== "all") {
      conditions.push(eq(projectApprovals.stage, stage));
    }
    const isAdmin = isManagerialRole(roleId);
    if (!isAdmin) {
      conditions.push(or(eq(projectApprovals.approverUserId, userId), eq(projectApprovals.requestedBy, userId))!);
    }

    const res = await db.select({
      pending: sql<number>`count(*) filter (where ${projectApprovals.status} = 'Pending')::int`,
      approved: sql<number>`count(*) filter (where ${projectApprovals.status} = 'Approved')::int`,
      rejected: sql<number>`count(*) filter (where ${projectApprovals.status} = 'Rejected')::int`,
    })
    .from(projectApprovals)
    .where(conditions.length ? and(...conditions) : undefined);

    const row = res[0];
    return {
      pending: row?.pending || 0,
      approved: row?.approved || 0,
      rejected: row?.rejected || 0,
    };
  },
};
