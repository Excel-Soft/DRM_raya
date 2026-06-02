import { db, pool } from "../db";
import { customers, users, Customer } from "@shared/schema";
import { eq, desc, and, gte, lte, sql, ilike, or, isNull } from "drizzle-orm";

export type PoolType = "Private" | "Service" | "GMBV" | "Public";

export interface PoolCustomer extends Customer {
  ownerName?: string | null;
  lastFollowUp?: Date | null;
}

export const poolsRepository = {
  async findByPoolType(
    poolType: PoolType,
    filters: {
      userId?: string;
      grade?: string;
      serviceType?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PoolCustomer[]> {
    const clauses: string[] = ["coalesce(is_deleted,false)=false"];
    const params: any[] = [];
    let i = 1;

    if (poolType === "Private") {
      // Include both Private and GMBV customers owned or created by the user
      if (filters.userId) {
        clauses.push(`(pool_type = 'Private' OR pool_type = 'GMBV') AND (owner_user_id = $${i} OR created_by = $${i})`);
        params.push(filters.userId);
        i++;
      } else {
        clauses.push("pool_type = 'Private'");
      }
    } else if (poolType === "Service") {
      clauses.push("pool_type = 'Service'");
    } else if (poolType === "GMBV") {
      clauses.push("pool_type = 'GMBV'");
    } else if (poolType === "Public") {
      clauses.push("pool_type = 'Public'");
    }

    if (filters.grade) {
      clauses.push(`grade = $${i++}`);
      params.push(filters.grade);
    }
    if (filters.search) {
      clauses.push(`company_name ILIKE $${i++}`);
      params.push(`%${filters.search}%`);
    }

    const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const sqlText = `
      select c.id, c.company_name, c.region, c.grade, c.status, c.source, c.pool_type, c.owner_user_id, c.expires_at, c.created_at
      from drm.customers c
      ${poolType === "Public" ? `
        left join lateral (
          select fu.created_at as last_followup_at
          from follow_ups fu
          where fu.customer_id = c.id
            and fu.is_deleted = false
          order by fu.created_at desc
          limit 1
        ) latest_fu on true
      ` : ""}
      ${whereSql}
      ${poolType === "Public" ? "and (latest_fu.last_followup_at is null or latest_fu.last_followup_at < now() - interval '3 months')" : ""}
      order by c.created_at desc
      limit ${limit} offset ${offset}
    `;

    const res = await pool.query(sqlText, params);
    return res.rows.map((row: any) => ({
      id: row.id,
      companyName: row.company_name,
      region: row.region,
      grade: row.grade,
      status: row.status,
      source: row.source,
      poolType: row.pool_type,
      ownerUserId: row.owner_user_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    })) as any;
  },

  async getPoolStats(userId: string): Promise<{
    private: number;
    service: number;
    gmbv: number;
    public: number;
    expiringSoon: number;
  }> {
    try {
      const { rows } = await pool.query(
        `select
           count(*) filter (where (pool_type = 'Private' OR pool_type = 'GMBV') and (owner_user_id = $1 OR created_by = $1))::int as private,
           count(*) filter (where pool_type = 'Service')::int as service,
           count(*) filter (where pool_type = 'GMBV')::int as gmbv,
           count(*) filter (where pool_type = 'Public')::int as public,
           count(*) filter (where (owner_user_id = $1 OR created_by = $1) and expires_at between now() and now() + interval '7 day')::int as expiring_soon
         from drm.customers
         where coalesce(is_deleted,false)=false`,
        [userId],
      );
      return {
        private: rows[0]?.private ?? 0,
        service: rows[0]?.service ?? 0,
        gmbv: rows[0]?.gmbv ?? 0,
        public: rows[0]?.public ?? 0,
        expiringSoon: rows[0]?.expiring_soon ?? 0,
      };
    } catch (err) {
      console.error("getPoolStats fallback error", err);
      return { private: 0, service: 0, gmbv: 0, public: 0, expiringSoon: 0 };
    }
  },

  async reassign(customerId: string, newOwnerUserId: string): Promise<Customer | null> {
    const [result] = await db.update(customers)
      .set({
        ownerUserId: newOwnerUserId,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId))
      .returning();
    return result || null;
  },

  async moveToPool(customerId: string, poolType: PoolType): Promise<Customer | null> {
    const updateData: any = {
      poolType,
      updatedAt: new Date(),
    };

    if (poolType === "Public") {
      updateData.ownerUserId = null;
    }

    const [result] = await db.update(customers)
      .set(updateData)
      .where(eq(customers.id, customerId))
      .returning();
    return result || null;
  },

  async claimFromPool(customerId: string, userId: string): Promise<Customer | null> {
    const [result] = await db.update(customers)
      .set({
        ownerUserId: userId,
        poolType: "Private",
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId))
      .returning();
    return result || null;
  },

  async getExpiringLeads(userId: string, daysAhead: number = 7): Promise<Customer[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const res = await pool.query(
      `select id, company_name, region, grade, status, source, pool_type, owner_user_id, expires_at, created_at
         from drm.customers
        where owner_user_id = $1
          and expires_at is not null
          and expires_at <= $2
          and expires_at >= $3
          and coalesce(is_deleted,false)=false
        order by expires_at asc
        limit 50`,
      [userId, futureDate, new Date()],
    );
    return res.rows as any;
  },

  async getReassignablePublicLeads(): Promise<Customer[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return db.select().from(customers)
      .where(and(
        eq(customers.poolType, "Public"),
        isNull(customers.ownerUserId)
      ))
      .orderBy(desc(customers.createdAt))
      .limit(50);
  },
};
