import { db, pool } from "../db";
import { projectFinancials, projects, customers, productPostingInvoices, InsertProjectFinancial, ProjectFinancial } from "@shared/schema";
import { eq, desc, ilike, and, or, sql, gte, lte } from "drizzle-orm";
import { quotedUuidList } from "../utils/sql-safety";

let projectFinancialsSchemaEnsured = false;

async function ensureProjectFinancialsSchema() {
  if (projectFinancialsSchemaEnsured) return;
  projectFinancialsSchemaEnsured = true;

  const alterSql = `
    alter table project_financials
      add column if not exists total_amount numeric(12,2) not null default 0,
      add column if not exists paid_amount numeric(12,2) not null default 0,
      add column if not exists currency text not null default 'USD',
      add column if not exists last_payment_at timestamptz,
      add column if not exists created_at timestamptz default now(),
      add column if not exists updated_at timestamptz default now();

    update project_financials
      set total_amount = coalesce(total_amount, 0),
          paid_amount = coalesce(paid_amount, 0),
          currency = coalesce(currency, 'USD'),
          created_at = coalesce(created_at, now()),
          updated_at = coalesce(updated_at, now());
  `;

  try {
    await pool.query(alterSql);
  } catch (err) {
    console.error("Failed to ensure project_financials schema (continuing):", err);
  }
}

export const projectFinancialsRepository = {
  async findById(id: string): Promise<ProjectFinancial | undefined> {
    await ensureProjectFinancialsSchema();
    const result = await db.select().from(projectFinancials).where(eq(projectFinancials.id, id)).limit(1);
    return result[0];
  },

  async findByProjectId(projectId: string): Promise<ProjectFinancial | undefined> {
    await ensureProjectFinancialsSchema();
    const result = await db.select().from(projectFinancials).where(eq(projectFinancials.projectId, projectId)).limit(1);
    return result[0];
  },

  async findAllWithProjects(): Promise<Array<ProjectFinancial & { project: any }>> {
    await ensureProjectFinancialsSchema();
    const result = await db
      .select({
        id: projectFinancials.id,
        projectId: projectFinancials.projectId,
        totalAmount: projectFinancials.totalAmount,
        paidAmount: projectFinancials.paidAmount,
        currency: projectFinancials.currency,
        lastPaymentAt: projectFinancials.lastPaymentAt,
        createdAt: projectFinancials.createdAt,
        updatedAt: projectFinancials.updatedAt,
        project: {
          id: projects.id,
          name: projects.name,
          status: projects.status,
          workSpace: projects.workSpace,
          startDate: projects.startDate,
          endDate: projects.endDate,
          companyName: sql<string>`COALESCE(${customers.companyName}, ${productPostingInvoices.companyName})`
        },
      })
      .from(projectFinancials)
      .leftJoin(projects, eq(projectFinancials.projectId, projects.id))
      .leftJoin(customers, eq(projects.customerId, customers.id))
      .leftJoin(productPostingInvoices, eq(projects.invoiceId, productPostingInvoices.id))
      .orderBy(desc(projectFinancials.updatedAt));

    return result.map((r) => ({
      ...r,
      project: r.project!,
    }));
  },

  async findWithFilters(params: {
    search?: string;
    userId?: string;
    roleId?: string;
    status?: string;
    from?: Date;
    to?: Date;
    filterUserIds?: string[];
  }): Promise<Array<ProjectFinancial & { project: any }>> {
    await ensureProjectFinancialsSchema();
    const conditions: any[] = [];

    if (params.search) {
      conditions.push(
        or(
          ilike(projects.name, `%${params.search}%`),
          ilike(projects.workSpace, `%${params.search}%`)
        )
      );
    }

    if (params.status) {
      conditions.push(eq(projects.status, params.status as any));
    } else {
      conditions.push(eq(projects.status, "Active" as any));
    }

    const isAdmin = (params.roleId || "").toLowerCase() === "admin";
    if (!isAdmin) {
      if (params.filterUserIds && params.filterUserIds.length > 0) {
        const ids = quotedUuidList(params.filterUserIds);
        conditions.push(sql`projects.owner_user_id = ANY(ARRAY[${sql.raw(ids)}]::uuid[])`);
      } else if (params.userId && params.roleId !== "sales_manager") {
        const createdByFallback = sql`${sql.identifier("projects")}.created_by = ${params.userId}`;
        conditions.push(
          or(
            eq(projects.ownerUserId, params.userId),
            createdByFallback
          )
        );
      }
    }

    const hasValidFrom = params.from && !isNaN(params.from.getTime());
    if (hasValidFrom) {
      conditions.push(or(
        gte(projectFinancials.updatedAt as any, params.from),
        gte(projectFinancials.lastPaymentAt as any, params.from)
      ));
    }

    const hasValidTo = params.to && !isNaN(params.to.getTime());
    if (hasValidTo) {
      conditions.push(or(
        lte(projectFinancials.updatedAt as any, params.to),
        lte(projectFinancials.lastPaymentAt as any, params.to)
      ));
    }

    const filteredConditions = conditions.filter(Boolean);
    const whereClause = filteredConditions.length > 0 ? and(...filteredConditions) : undefined;

    const baseQuery = db
      .select({
        id: projectFinancials.id,
        projectId: projectFinancials.projectId,
        totalAmount: projectFinancials.totalAmount,
        paidAmount: projectFinancials.paidAmount,
        currency: projectFinancials.currency,
        lastPaymentAt: projectFinancials.lastPaymentAt,
        createdAt: projectFinancials.createdAt,
        updatedAt: projectFinancials.updatedAt,
        project: {
          id: projects.id,
          name: projects.name,
          status: projects.status,
          workSpace: projects.workSpace,
          startDate: projects.startDate,
          endDate: projects.endDate,
          companyName: sql<string>`COALESCE(${customers.companyName}, ${productPostingInvoices.companyName})`
        },
      })
      .from(projectFinancials)
      .leftJoin(projects, eq(projectFinancials.projectId, projects.id))
      .leftJoin(customers, eq(projects.customerId, customers.id))
      .leftJoin(productPostingInvoices, eq(projects.invoiceId, productPostingInvoices.id))
      .orderBy(desc(projectFinancials.updatedAt));

    const rows = await (whereClause ? baseQuery.where(whereClause) : baseQuery);

    return rows.map((r) => ({
      ...r,
      project: r.project!,
    }));
  },

  async getSummary(params: {
    search?: string;
    userId?: string;
    roleId?: string;
    status?: string;
    filterUserIds?: string[];
  }): Promise<{
    totalProjectValue: number;
    totalPaid: number;
    totalDue: number;
    projectCount: number;
    paidPercent: number;
  }> {
    const rows = await this.findWithFilters(params);
    const totalProjectValue = rows.reduce((sum, r) => sum + parseFloat(r.totalAmount || "0"), 0);
    const totalPaid = rows.reduce((sum, r) => sum + parseFloat(r.paidAmount || "0"), 0);
    const totalDue = rows.reduce((sum, r) => sum + (parseFloat(r.totalAmount || "0") - parseFloat(r.paidAmount || "0")), 0);
    const projectCount = rows.length;
    const paidPercent = totalProjectValue > 0 ? (totalPaid / totalProjectValue) * 100 : 0;
    return { totalProjectValue, totalPaid, totalDue, projectCount, paidPercent };
  },

  async create(data: InsertProjectFinancial): Promise<ProjectFinancial> {
    await ensureProjectFinancialsSchema();
    const result = await db.insert(projectFinancials).values(data).returning();
    return result[0];
  },

  async upsert(projectId: string, data: Partial<InsertProjectFinancial>): Promise<ProjectFinancial> {
    await ensureProjectFinancialsSchema();
    const existing = await this.findByProjectId(projectId);
    
    if (existing) {
      return this.update(existing.id, data);
    }
    
    return this.create({ projectId, ...data } as InsertProjectFinancial);
  },

  async update(id: string, data: Partial<InsertProjectFinancial>): Promise<ProjectFinancial> {
    await ensureProjectFinancialsSchema();
    const result = await db
      .update(projectFinancials)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projectFinancials.id, id))
      .returning();
    return result[0];
  },

  async updatePaidAmount(projectId: string, additionalAmount: number): Promise<ProjectFinancial> {
    const existing = await this.findByProjectId(projectId);
    
    if (!existing) {
      throw new Error(`Project financials not found for project ${projectId}`);
    }

    const newPaidAmount = parseFloat(existing.paidAmount || "0") + additionalAmount;
    
    return this.update(existing.id, {
      paidAmount: newPaidAmount.toString(),
      lastPaymentAt: new Date(),
    } as any);
  },
};
