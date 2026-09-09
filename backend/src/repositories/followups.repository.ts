import { db, pool } from "../db";
import { followUps, customers, type FollowUp, type InsertFollowUp } from "@models/schema";

export type FollowUpWithCustomer = FollowUp & {
  customer: typeof customers.$inferSelect;
};

let ensured = false;
export async function ensureFollowUpsSchema() {
  if (ensured) return;
  const ddl = `
    alter table follow_ups
      add column if not exists method text,
      add column if not exists created_by uuid,
      add column if not exists reservation_type text,
      add column if not exists talk_time_seconds int not null default 0,
      add column if not exists manager_comment text,
      add column if not exists sm_comment text,
      alter column status set default 'Open',
      alter column created_at set default now(),
      alter column updated_at set default now();
    create index if not exists idx_follow_ups_customer on follow_ups(customer_id);
  `;
  try {
    await pool.query(ddl);
  } catch (err) {
    console.error("Failed ensuring follow_ups schema (continuing):", err);
  } finally {
    ensured = true;
  }
}

export class FollowUpsRepository {
  async findByUserId(
    userId: string,
    filters?: {
      status?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ): Promise<FollowUpWithCustomer[]> {
    await ensureFollowUpsSchema();
    const where: string[] = ["coalesce(f.is_deleted,false)=false"];
    const params: any[] = [];
    let i = 1;
    if (userId) {
      where.push(`f.assigned_to = $${i++}`);
      params.push(userId);
    }
    if (filters?.status) {
      where.push(`f.status = $${i++}`);
      params.push(filters.status);
    }
    if (filters?.dateFrom) {
      where.push(`f.due_at >= $${i++}`);
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      where.push(`f.due_at <= $${i++}`);
      params.push(filters.dateTo);
    }
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";
    const sqlText = `
      select f.*, c.company_name, c.grade
      from follow_ups f
      left join drm.customers c on c.id = f.customer_id
      ${whereSql}
      order by f.created_at desc
    `;
    const res = await pool.query(sqlText, params);
    return res.rows.map((row: any) => ({
      id: row.id,
      customerId: row.customer_id,
      assignedTo: row.assigned_to ?? null,
      createdBy: row.created_by ?? row.assigned_to ?? null,
      dueAt: row.due_at,
      status: row.status ?? "Open",
      notes: row.notes,
      method: row.method,
      reservationType: row.reservation_type ?? null,
      talkTimeSeconds: Number(row.talk_time_seconds ?? 0),
      dateTime: row.date_time ?? row.due_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isDeleted: row.is_deleted ?? false,
      managerComment: row.manager_comment ?? null,
      smComment: row.sm_comment ?? null,
      customer: {
        id: row.customer_id,
        companyName: row.company_name,
        grade: row.grade,
      } as any,
    }));
  }

  async countByStatus(userId: string): Promise<Record<string, number>> {
    await ensureFollowUpsSchema();
    const res = await pool.query<{ status: string; count: number }>(
      `select status, count(*)::int as count
         from follow_ups
         where assigned_to = $1
           and coalesce(is_deleted,false) = false
         group by status`,
      [userId],
    );
    return res.rows.reduce((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {} as Record<string, number>);
  }

  async create(data: InsertFollowUp): Promise<FollowUp> {
    await ensureFollowUpsSchema();
    const payload: InsertFollowUp = {
      ...data,
      status: (data as any).status ?? "Open",
      dateTime: data.dateTime ?? data.dueAt ?? new Date(),
      createdBy: (data as any).createdBy ?? (data as any).assignedTo ?? null,
      reservationType: (data as any).reservationType ?? (data as any).reservation_type ?? null,
    };
    const [followUp] = await db.insert(followUps).values(payload).returning();
    return followUp;
  }

  async findByCustomerId(customerId: string): Promise<FollowUp[]> {
    await ensureFollowUpsSchema();
    const res = await pool.query(
      `select * from follow_ups where customer_id = $1 and coalesce(is_deleted,false)=false order by created_at desc`,
      [customerId],
    );
    return res.rows.map((row: any) => ({
      id: row.id,
      customerId: row.customer_id,
      assignedTo: row.assigned_to ?? null,
      createdBy: row.created_by ?? row.assigned_to ?? null,
      dueAt: row.due_at,
      status: row.status ?? "Open",
      notes: row.notes,
      method: row.method,
      reservationType: row.reservation_type ?? null,
      talkTimeSeconds: Number(row.talk_time_seconds ?? 0),
      dateTime: row.date_time ?? row.due_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isDeleted: row.is_deleted ?? false,
    })) as any;
  }
}

export const followUpsRepository = new FollowUpsRepository();
