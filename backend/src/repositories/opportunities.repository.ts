import { db, pool } from "../db";
import { opportunities, customers, type Opportunity } from "@models/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";

export type OpportunityWithCustomer = Opportunity & {
  customer: typeof customers.$inferSelect;
};

export class OpportunitiesRepository {
  async findByFilters(filters: {
    userId?: string;
    allowedUserIds?: string[];
    stage?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ opportunities: OpportunityWithCustomer[], total: number }> {
    const clauses: string[] = ["coalesce(op.is_deleted,false) = false"];
    const params: any[] = [];
    let i = 1;

    if (filters.userId) {
      clauses.push(`op.owner_id = $${i++}`);
      params.push(filters.userId);
    } else if (filters.allowedUserIds && filters.allowedUserIds.length > 0) {
      clauses.push(`op.owner_id = ANY($${i++}::uuid[])`);
      params.push(filters.allowedUserIds);
    }

    if (filters.stage) {
      clauses.push(`op.stage = $${i++}`);
      params.push(filters.stage);
    }
    if (filters.dateFrom) {
      clauses.push(`op.created_at >= $${i++}`);
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      clauses.push(`op.created_at <= $${i++}`);
      params.push(filters.dateTo);
    }
    const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";

    const countSql = `select count(*)::int as total from drm.opportunities op ${whereSql}`;
    const countRes = await pool.query(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    const limit = filters.limit || 10;
    const offset = filters.offset || 0;
    const sqlText = `
      select
        op.id,
        op.customer_id,
        op.owner_id,
        op.stage,
        op.value,
        op.expected_close_date,
        op.is_deleted,
        op.created_at,
        op.updated_at,
        op.title,
        c.company_name,
        c.account_name,
        c.email,
        c.phone,
        c.country,
        c.city,
        c.address,
        c.website,
        c.region,
        c.status,
        c.source,
        c.grade,
        c.rc_link,
        c.created_by,
        c.created_at as customer_created_at,
        c.updated_at as customer_updated_at
      from drm.opportunities op
      inner join drm.customers c on c.id = op.customer_id
      ${whereSql}
      order by op.created_at desc
      limit $${i++} offset $${i++}
    `;

    const res = await pool.query(sqlText, [...params, limit, offset]);
    const items = res.rows.map((row: any) => ({
      id: row.id,
      customerId: row.customer_id,
      ownerUserId: row.owner_id,
      stage: row.stage,
      amount: row.value,
      expectedCloseDate: row.expected_close_date,
      isDeleted: row.is_deleted,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      title: row.title,
      customer: {
        id: row.customer_id,
        companyName: row.company_name,
        accountName: row.account_name,
        email: row.email,
        phone: row.phone,
        country: row.country,
        city: row.city,
        address: row.address,
        website: row.website,
        region: row.region,
        status: row.status,
        source: row.source,
        grade: row.grade,
        rcLink: row.rc_link,
        ownerUserId: row.created_by,
        createdAt: row.customer_created_at,
        updatedAt: row.customer_updated_at,
      } as any,
    }));

    return { opportunities: items, total };
  }


  async countByStage(userId?: string, dateFrom?: Date, dateTo?: Date, allowedUserIds?: string[]): Promise<Record<string, number>> {
    const clauses: string[] = ["coalesce(op.is_deleted,false) = false"];
    const params: any[] = [];
    let i = 1;
    if (userId) {
      clauses.push(`coalesce(c.owner_user_id, op.owner_id) = $${i++}`);
      params.push(userId);
    } else if (allowedUserIds && allowedUserIds.length > 0) {
      clauses.push(`coalesce(c.owner_user_id, op.owner_id) = ANY($${i++}::uuid[])`);
      params.push(allowedUserIds);
    }
    if (dateFrom) {
      clauses.push(`op.updated_at >= $${i++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      clauses.push(`op.updated_at <= $${i++}`);
      params.push(dateTo);
    }
    const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";

    const res = await pool.query<{ stage: string; count: number }>(
      `select coalesce(op.stage, 'LD') as stage, count(*)::int as count 
       from drm.opportunities op 
       left join drm.customers c on op.customer_id = c.id 
       ${whereSql} 
       group by coalesce(op.stage, 'LD')`,
      params,
    );

    return res.rows.reduce((acc, row) => {
      acc[row.stage] = Number(row.count);
      return acc;
    }, {} as Record<string, number>);
  }

  async getTotalAmount(userId: string, dateFrom?: Date, dateTo?: Date): Promise<string> {
    const clauses: string[] = [
      "created_by = $1", 
      "coalesce(is_deleted,false) = false",
      "(status = 'Approved' or approval_status = 'approved' or final_status = 'approved' or approval_status = 'approved_by_account')"
    ];
    const params: any[] = [userId];
    let i = 2;
    if (dateFrom) {
      clauses.push(`created_at >= $${i++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      clauses.push(`created_at <= $${i++}`);
      params.push(dateTo);
    }
    const whereSql = `where ${clauses.join(" and ")}`;

    const res = await pool.query<{ total: string }>(
      `select COALESCE(SUM(amount_usd), 0)::text as total from drm.gm_entries ${whereSql}`,
      params,
    );

    return res.rows[0]?.total || "0";
  }
}

export const opportunitiesRepository = new OpportunitiesRepository();
