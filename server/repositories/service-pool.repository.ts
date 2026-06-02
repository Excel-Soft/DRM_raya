import { pool } from "../db";

export class ServicePoolRepository {
  async ensureTable() {
    const enumDdl = `
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t 
          JOIN pg_namespace n ON t.typnamespace = n.oid 
          WHERE t.typname = 'service_pool_status' AND n.nspname = 'drm'
        ) THEN
          CREATE TYPE drm.service_pool_status AS ENUM ('active', 'dropout', 'completed', 'refund', 'temp', 'pending');
        END IF;
      END $$;
    `;

    const tableDdl = `
      CREATE TABLE IF NOT EXISTS drm.service_pool_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id uuid NOT NULL REFERENCES drm.customers(id) ON DELETE CASCADE,
        service_code text,
        subservice_code text,
        service_person_id uuid REFERENCES drm.users(id) ON DELETE SET NULL,
        sales_person_id uuid REFERENCES drm.users(id) ON DELETE SET NULL,
        ta_person_id uuid REFERENCES drm.users(id) ON DELETE SET NULL,
        status drm.service_pool_status NOT NULL DEFAULT 'active',
        dropout_category text,
        metadata jsonb,
        started_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_spe_customer ON drm.service_pool_entries(customer_id);
      CREATE INDEX IF NOT EXISTS idx_spe_status ON drm.service_pool_entries(status);
      CREATE INDEX IF NOT EXISTS idx_spe_service_person ON drm.service_pool_entries(service_person_id);
      CREATE INDEX IF NOT EXISTS idx_spe_sales_person ON drm.service_pool_entries(sales_person_id);
      
      -- Unique index to prevent duplicate active services for same customer
      CREATE UNIQUE INDEX IF NOT EXISTS uq_active_service_customer 
      ON drm.service_pool_entries(customer_id, COALESCE(service_code, ''), COALESCE(subservice_code, '')) 
      WHERE status = 'active';
    `;
    try {
      await pool.query(enumDdl);
      await pool.query(tableDdl);
    } catch (err) {
      console.error("Failed ensuring service_pool_entries table:", err);
    }
  }

  async list(filters: {
    search?: string;
    status?: string;
    dropoutCategory?: string;
    page: number;
    pageSize: number;
    showDuplicates?: boolean;
    currentQ?: boolean;
    userIds?: string[] | null;
  }) {
    const { search, status, dropoutCategory, page, pageSize, showDuplicates, currentQ, userIds } = filters;
    const offset = (page - 1) * pageSize;
    const params: any[] = [];
    let p = 1;

    const whereParts: string[] = ["1=1"];

    if (showDuplicates) {
      whereParts.push(`spe.customer_id in (
        select customer_id from service_pool_entries
        group by customer_id
        having count(*) > 1
      )`);
    } else {
      if (status) {
        whereParts.push(`spe.status = $${p++}`);
        params.push(status);
      }

      if (dropoutCategory) {
        whereParts.push(`spe.dropout_category = $${p++}`);
        params.push(dropoutCategory);
      }

      if (currentQ) {
        whereParts.push(`spe.started_at >= date_trunc('quarter', now())`);
      }
    }

    if (search) {
      whereParts.push(`(c.company_name ilike $${p} or c.account_name ilike $${p} or c.drm_id ilike $${p})`);
      params.push(`%${search}%`);
      p++;
    }

    const whereSql = whereParts.join(" and ");

    if (userIds && userIds.length > 0) {
      whereParts.push(`spe.sales_person_id = ANY($${p++})`);
      params.push(userIds);
    }

    const finalWhereSql = whereParts.join(" and ");

    const query = `
      SELECT 
        spe.id,
        c.drm_id AS "drmId",
        c.company_name AS "companyName",
        u_sales.name AS "salesPersonName",
        u_service.name AS "servicePersonName",
        u_ta.name AS "taPersonName",
        c.account_name AS "accountHolder",
        c.phone AS "contactNo",
        spe.status,
        spe.dropout_category AS "dropoutCategory",
        spe.started_at AS "startedAt",
        spe.updated_at AS "updatedAt"
      FROM drm.service_pool_entries spe
      JOIN drm.customers c ON c.id = spe.customer_id
      LEFT JOIN drm.users u_sales ON u_sales.id = spe.sales_person_id
      LEFT JOIN drm.users u_service ON u_service.id = spe.service_person_id
      LEFT JOIN drm.users u_ta ON u_ta.id = spe.ta_person_id
      WHERE ${finalWhereSql}
      ORDER BY spe.updated_at DESC
      LIMIT $${p++} OFFSET $${p++}
    `;

    params.push(pageSize, offset);

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM drm.service_pool_entries spe
      JOIN drm.customers c ON c.id = spe.customer_id
      WHERE ${finalWhereSql}
    `;

    const [rowsRes, countRes] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2))
    ]);

    return {
      items: rowsRes.rows,
      total: countRes.rows[0]?.total || 0
    };
  }

  async getSummary(userIds?: string[] | null) {
    let whereClause = "";
    const params: any[] = [];
    if (userIds && userIds.length > 0) {
      whereClause = "WHERE sales_person_id = ANY($1)";
      params.push(userIds);
    }
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') AS "allInService",
        COUNT(*) FILTER (WHERE dropout_category = 'dropout_in_1_year') AS "dropoutIn1Year",
        COUNT(*) FILTER (WHERE dropout_category = 'dropout_more_than_1_year') AS "dropoutMoreThan1Year",
        COUNT(*) FILTER (WHERE started_at >= date_trunc('quarter', now())) AS "currentQ",
        (
          SELECT COUNT(*) FROM (
            SELECT customer_id FROM drm.service_pool_entries
            GROUP BY customer_id
            HAVING COUNT(*) > 1
          ) sub
        ) AS "duplicateData"
      FROM drm.service_pool_entries
      ${whereClause}
    `;
    const res = await pool.query(query, params);
    const row = res.rows[0] || {};
    return {
      allInService: Number(row.allInService || 0),
      dropoutIn1Year: Number(row.dropoutIn1Year || 0),
      dropoutMoreThan1Year: Number(row.dropoutMoreThan1Year || 0),
      currentQ: Number(row.currentQ || 0),
      duplicateData: Number(row.duplicateData || 0)
    };
  }

  async upsertFromFollowup(data: {
    customerId: string;
    salesPersonId: string;
    serviceCode?: string;
    subserviceCode?: string;
  }) {
    const { customerId, salesPersonId, serviceCode, subserviceCode } = data;
    // We only automatically add to service pool if it's an 'active' service being logged
    const query = `
      INSERT INTO drm.service_pool_entries (customer_id, sales_person_id, service_code, subservice_code, status, started_at, updated_at)
      VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
      ON CONFLICT (customer_id, COALESCE(service_code, ''), COALESCE(subservice_code, '')) 
      WHERE status = 'active'
      DO UPDATE SET updated_at = NOW()
    `;
    await pool.query(query, [customerId, salesPersonId, serviceCode, subserviceCode]);
  }
}

export const servicePoolRepository = new ServicePoolRepository();
