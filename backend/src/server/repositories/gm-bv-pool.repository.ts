import { pool } from "../db";
import { ensureBvReportsSchema } from "./bv-reports.repository";
import { generateUniqueDrmId } from "../utils/drm-id-utils";
import { isManagerialRole } from "../utils/role-utils";
import { getDepartmentFilterUserIds } from "../dashboard-routes";
import { generateDefaultInvoicesForGm } from "../services/gm-invoice-generation.service";
import { GM_INVOICE_GENERATION_TIMING } from "../../shared/gm-sales-constants";
import crypto from "crypto";

type ListParams = {
  userId: string;
  roleId?: string;
  search?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
};

type SummaryParams = {
  userId: string;
  roleId?: string;
  period?: string;
};

const DEFAULT_PAGE_SIZE = 10;

const isManagerRole = (roleId?: string) => isManagerialRole(roleId);

// A manager role previously got `1=1` here — fully unscoped, seeing every
// department's GM/BV entries instead of just their own team's (the same gap
// found and fixed across sales-routes.ts's lead-pool functions). Returns
// null only for true global roles (admin/super_admin/hod/...); a real
// department manager gets back their own team's user ids (self + reports).
const resolveScopeUserIds = async (userId: string, roleId?: string): Promise<string[] | null> => {
  if (!isManagerRole(roleId)) return [userId];
  return getDepartmentFilterUserIds({ user: { userId, roleId, activeRoleId: roleId } });
};

const buildScope = async (userId: string, roleId?: string) => {
  const allowed = await resolveScopeUserIds(userId, roleId);
  if (allowed === null) {
    return { clause: "1=1", params: [] as any[] };
  }
  const params: any[] = [allowed];
  const clause = `(br.assigned_to = ANY($${params.length}::uuid[])
    or br.user_id = ANY($${params.length}::uuid[])
    or exists (
      select 1 from drm.customers c
      where c.id = br.customer_id
        and (c.owner_user_id = ANY($${params.length}::uuid[]) or c.pool_type = 'Public')
    ))`;
  return { clause, params };
};

const mapRow = (row: any) => ({
  id: row.id,
  customerId: row.customer_id,
  companyName: row.company_name ?? row.bv_company_name ?? row.title ?? "BV Entry",
  drmId: row.drm_id ?? null,
  accountName: row.account_name ?? null,
  contactNo: row.phone ?? null,
  email: row.email ?? null,
  ntn: row.ntn ?? null,
  cnic: row.cnic ?? null,
  status: row.status ?? null,
  reportDate: row.report_date ?? null,
  assignedTo: row.assigned_to ?? null,
  assignedToName: row.assigned_to_name ?? null,
  salesPersonName: row.sales_person_name ?? null,
  createdAt: row.created_at ?? null,
  approvalStatus: row.approval_status ?? null,
  hodStatus: row.hod_status ?? null,
  gmBvId: row.gm_bv_id ?? row.id,
});

const periodToRange = (period?: string) => {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  switch ((period || "TD").toUpperCase()) {
    case "TD":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "WC":
      start.setDate(now.getDate() - 6);
      break;
    case "MC":
    case "MONTH":
      start.setMonth(now.getMonth() - 1);
      break;
    case "YEAR":
      start.setFullYear(now.getFullYear() - 1);
      break;
    default:
      start.setHours(0, 0, 0, 0);
  }
  return { from: start, to: end };
};

async function markCustomerGmbv(customerId?: string | null) {
  if (!customerId) return;
  try {
    await pool.query(
      `update drm.customers 
          set pool_type = 'GMBV', updated_at = now() 
        where id = $1 and coalesce(pool_type,'') <> 'GMBV'`,
      [customerId],
    );
  } catch (err) {
    console.warn("Failed to mark customer as GMBV", err);
  }
}

let ensuredGmColumns = false;
async function ensureGmEntriesColumns() {
  if (ensuredGmColumns) return;
  try {
    await pool.query(
      `alter table drm.gm_entries add column if not exists is_deleted boolean default false;
       alter table drm.gm_entries add column if not exists drm_id text;`
    );
  } catch (err) {
    console.error("Failed ensuring gm_entries columns (continuing):", err);
  } finally {
    ensuredGmColumns = true;
  }
}

export const gmBvPoolRepository = {
  async list(params: ListParams) {
    await ensureBvReportsSchema();
    await ensureGmEntriesColumns();
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE));
    const allowedUserIds = await resolveScopeUserIds(params.userId, params.roleId);
    const offset = (page - 1) * pageSize;

    // ── 1. Query bv_reports ──────────────────────────────────────────────
    const bvParams: any[] = [];
    const bvWhere: string[] = [];
    if (allowedUserIds !== null) {
      bvParams.push(allowedUserIds);
      bvWhere.push(`(br.assigned_to = ANY($${bvParams.length}::uuid[]) or br.user_id = ANY($${bvParams.length}::uuid[]) or exists (
        select 1 from drm.customers c2 where c2.id = br.customer_id and (c2.owner_user_id = ANY($${bvParams.length}::uuid[]) or c2.pool_type = 'Public')
      ))`);
    }
    if (params.status) { bvParams.push(params.status); bvWhere.push(`br.status = $${bvParams.length}`); }
    if (params.search?.trim()) {
      bvParams.push(`%${params.search.trim()}%`);
      bvWhere.push(`(br.title ilike $${bvParams.length} or coalesce(br.company_name,'') ilike $${bvParams.length} or coalesce(c.company_name,'') ilike $${bvParams.length})`);
    }
    if (params.dateFrom) { bvParams.push(params.dateFrom); bvWhere.push(`br.report_date >= $${bvParams.length}`); }
    if (params.dateTo) { bvParams.push(params.dateTo); bvWhere.push(`br.report_date <= $${bvParams.length}`); }

    const bvWhereSql = bvWhere.length ? `where ${bvWhere.join(' and ')}` : '';
    const bvSql = `
      select
        br.id, br.customer_id,
        coalesce(br.company_name, c.company_name) as company_name,
        c.drm_id,
        c.account_name, c.phone, c.email, c.ntn, c.cnic,
        br.assigned_to, u.name as assigned_to_name,
        coalesce(spu.full_name, spu.name, spu.username) as sales_person_name,
        br.status, br.title,
        br.report_date, br.created_at
      from drm.bv_reports br
      left join drm.customers c on c.id = br.customer_id
      left join drm.users u on u.id = br.assigned_to
      left join drm.users spu on spu.id = coalesce(c.owner_user_id, c.created_by)
      ${bvWhereSql}
      order by br.report_date desc, br.created_at desc
    `;

    // ── 2. Query gm_entries ──────────────────────────────────────────────
    const gmParams: any[] = [];
    const gmWhere: string[] = [`coalesce(g.is_deleted,false)=false`];
    if (allowedUserIds !== null) {
      gmParams.push(allowedUserIds);
      gmWhere.push(`(g.created_by::text = ANY($${gmParams.length}::text[]) or exists (
        select 1 from drm.customers c3 where c3.id = g.customer_id and (c3.owner_user_id::text = ANY($${gmParams.length}::text[]) or c3.created_by::text = ANY($${gmParams.length}::text[]))
      ))`);
    }
    if (params.status) { gmParams.push(params.status); gmWhere.push(`g.status = $${gmParams.length}`); }
    if (params.search?.trim()) {
      gmParams.push(`%${params.search.trim()}%`);
      gmWhere.push(`coalesce(g.company_name,'') ilike $${gmParams.length}`);
    }
    if (params.dateFrom) { gmParams.push(params.dateFrom); gmWhere.push(`g.created_at >= $${gmParams.length}`); }
    if (params.dateTo) { gmParams.push(params.dateTo); gmWhere.push(`g.created_at <= $${gmParams.length}`); }

    const gmWhereSql = `where ${gmWhere.join(' and ')}`;
    const gmSql = `
      select
        g.id, g.customer_id,
        coalesce(g.company_name, cg.company_name) as company_name,
        cg.drm_id,
        cg.account_name, cg.phone, cg.email, cg.ntn, cg.cnic,
        g.created_by as assigned_to, ug.name as assigned_to_name,
        g.sales_person_name as sales_person_name,
        g.status, g.package_type as title,
        g.created_at as report_date, g.created_at,
        g.approval_status, g.hod_status,
        g.id as gm_bv_id
      from drm.gm_entries g
      left join drm.customers cg on cg.id = g.customer_id
      left join drm.users ug on ug.id = g.created_by
      ${gmWhereSql}
      order by g.created_at desc
    `;

    // ── 3. Run both queries, merge, paginate ─────────────────────────────
    const [bvRes, gmResult] = await Promise.all([
      pool.query(bvSql, bvParams),
      pool.query(gmSql, gmParams).catch(err => {
        console.error('[gm-bv-pool] drm.gm_entries query failed:', err.message);
        return { rows: [] as any[] };
      }),
    ]);

    console.log(`[gm-bv-pool] bv_reports rows: ${bvRes.rows.length}, gm_entries rows: ${gmResult.rows.length}`);

    // Merge & deduplicate by prefixed id to avoid collisions across tables
    const seenIds = new Set<string>();
    const allRows: any[] = [];
    
    // Add BV reports
    for (const row of bvRes.rows) {
      const prefixedId = `bv_${row.id}`;
      if (!seenIds.has(prefixedId)) {
        seenIds.add(prefixedId);
        allRows.push({ ...row, id: prefixedId, originalId: row.id, tableType: "bv" });
      }
    }
    
    // Add GM entries
    for (const row of gmResult.rows) {
      const prefixedId = `gm_${row.id}`;
      if (!seenIds.has(prefixedId)) {
        seenIds.add(prefixedId);
        allRows.push({ ...row, id: prefixedId, originalId: row.id, tableType: "gm" });
      }
    }

    // Sort by report_date desc, created_at desc
    allRows.sort((a, b) => {
      const da = new Date(a.report_date || a.created_at).getTime();
      const db2 = new Date(b.report_date || b.created_at).getTime();
      return db2 - da;
    });

    const total = allRows.length;
    const items = allRows.slice(offset, offset + pageSize).map(mapRow);

    return { items, total, page, pageSize };
  },


  async summary(params: SummaryParams) {
    await ensureBvReportsSchema();
    const { clause, params: scopeParams } = await buildScope(params.userId, params.roleId);
    const range = periodToRange(params.period);
    const queryParams: any[] = [...scopeParams, range.from, range.to];
    const whereSql = `where ${clause} and br.report_date between $${queryParams.length - 1} and $${queryParams.length}`;
    const sqlText = `
      select status, count(*)::int as count
        from drm.bv_reports br
        ${whereSql}
        group by status
    `;
    const expiringSql = `
      select count(*)::int as expiring
        from drm.bv_reports br
        ${whereSql}
          and br.report_date between now() and now() + interval '7 day'
    `;
    const [countsRes, expiringRes, totalRes] = await Promise.all([
      pool.query(sqlText, queryParams),
      pool.query(expiringSql, queryParams),
      pool.query(`select count(*)::int as total from drm.bv_reports br where ${clause}`, scopeParams),
    ]);

    const countsByStatus: Record<string, number> = {};
    countsRes.rows.forEach((row: any) => {
      countsByStatus[row.status ?? "unknown"] = Number(row.count ?? 0);
    });

    return {
      countsByStatus,
      total: totalRes.rows[0]?.total ?? 0,
      expiringSoon: expiringRes.rows[0]?.expiring ?? 0,
    };
  },

  async create(userId: string, roleId: string | undefined, payload: any) {
    await ensureBvReportsSchema();
    const insertSql = `
      insert into drm.bv_reports (
        id, user_id, assigned_to, customer_id, company_name, report_date, status, title, summary, notes, total_tasks, value_sold, success_rate, follow_ups_done, missed_leads, meta, created_at, updated_at
      )
      values (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now(), now()
      )
      returning id
    `;
    const values = [
      userId,
      payload.assignedTo ?? userId,
      payload.customerId ?? null,
      payload.companyName ?? null,
      payload.reportDate ?? new Date(),
      payload.status ?? "Draft",
      payload.title ?? null,
      payload.summary ?? null,
      payload.notes ?? null,
      payload.totalTasks ?? 0,
      payload.valueSold ?? 0,
      payload.successRate ?? 0,
      payload.followUpsDone ?? 0,
      payload.missedLeads ?? 0,
      payload.meta ?? payload.metrics ?? null,
    ];
    const res = await pool.query(insertSql, values);
    await markCustomerGmbv(payload.customerId);
    
    // Automatically create the default product-posting invoices (Patch 5 Stage 4
    // / P6). BV reports are not GM records, so no idempotency key — matches prior
    // behavior. Gated by configured timing (default ON_GM_CREATION). Best-effort.
    await generateDefaultInvoicesForGm({
      gmId: null,
      customerId: payload.customerId ?? null,
      companyName: payload.companyName ?? null,
      ownerUserId: userId,
      event: GM_INVOICE_GENERATION_TIMING.ON_GM_CREATION,
      actorUserId: userId,
    });
    
    return res.rows[0];
  },

  async update(userId: string, id: string, updates: any) {
    await ensureBvReportsSchema();
    const fields: string[] = [];
    const values: any[] = [];
    const add = (field: string, value: any) => {
      fields.push(`${field} = $${fields.length + 2}`);
      values.push(value);
    };
    if (updates.status !== undefined) add("status", updates.status);
    if (updates.reportDate !== undefined) add("report_date", updates.reportDate);
    if (updates.title !== undefined) add("title", updates.title);
    if (updates.summary !== undefined) add("summary", updates.summary);
    if (updates.notes !== undefined) add("notes", updates.notes);
    if (updates.totalTasks !== undefined) add("total_tasks", updates.totalTasks);
    if (updates.valueSold !== undefined) add("value_sold", updates.valueSold);
    if (updates.successRate !== undefined) add("success_rate", updates.successRate);
    if (updates.followUpsDone !== undefined) add("follow_ups_done", updates.followUpsDone);
    if (updates.missedLeads !== undefined) add("missed_leads", updates.missedLeads);
    if (updates.meta !== undefined || updates.metrics !== undefined) add("meta", updates.meta ?? updates.metrics);
    if (updates.companyName !== undefined) add("company_name", updates.companyName);
    if (updates.customerId !== undefined) add("customer_id", updates.customerId ?? null);
    if (fields.length === 0) return { rowCount: 0 };
    const sqlText = `
      update bv_reports
         set ${fields.join(", ")}, updated_at = now()
       where id = $1 and (user_id = $2 or assigned_to = $2)
    `;
    const res = await pool.query(sqlText, [id, userId, ...values]);
    if (updates.customerId) {
      await markCustomerGmbv(updates.customerId);
    }
    return res;
  },

  // Phase 2 (PCH-001/DS-002/SEC-DA-001/PCH-012): assign/linkCustomer previously
  // had no ownership gate at all — any authenticated caller could reassign or
  // link-customer on ANY record. Mirrors the same "manager sees/acts on all,
  // non-manager scoped to own-or-assigned" pattern already used by
  // remove()/withdraw() below, rather than inventing a new rule.
  async assign(id: string, assignedTo: string, userId: string, roleId?: string) {
    await ensureBvReportsSchema();
    const isManager = isManagerRole(roleId);
    const res = await pool.query(
      isManager
        ? `update bv_reports set assigned_to = $1, updated_at = now() where id = $2 returning id`
        : `update bv_reports set assigned_to = $1, updated_at = now() where id = $2 and (user_id = $3 or assigned_to = $3) returning id`,
      isManager ? [assignedTo, id] : [assignedTo, id, userId],
    );
    return res;
  },

  async linkCustomer(bvId: string, userId: string, roleId?: string) {
    await ensureBvReportsSchema();
    const isManager = isManagerRole(roleId);
    const bvRes = await pool.query(
      isManager
        ? `select id, customer_id, company_name from bv_reports where id = $1 limit 1`
        : `select id, customer_id, company_name from bv_reports where id = $1 and (user_id = $2 or assigned_to = $2) limit 1`,
      isManager ? [bvId] : [bvId, userId],
    );
    const bv = bvRes.rows[0];
    if (!bv) return null;
    if (bv.customer_id) return { customerId: bv.customer_id };

    const companyName = bv.company_name?.trim();
    let customerId: string | null = null;

    if (companyName) {
      const existing = await pool.query(
        `select id from drm.customers where lower(company_name) = lower($1) limit 1`,
        [companyName],
      );
      customerId = existing.rows[0]?.id ?? null;
    }

    if (!customerId) {
      const drmId = await generateUniqueDrmId(
        pool,
        companyName ?? "GM BV Entry",
        "Other",
        companyName || crypto.randomUUID()
      );
      const insertRes = await pool.query(
        `insert into drm.customers (company_name, account_name, pool_type, owner_user_id, created_by, drm_id, created_at, updated_at)
         values ($1, $1, 'GMBV', $2, $2, $3, now(), now())
         returning id`,
        [companyName ?? "GM BV Entry", userId, drmId],
      );
      customerId = insertRes.rows[0]?.id ?? null;
    }

    if (customerId) {
      await pool.query(`update bv_reports set customer_id = $1, updated_at = now() where id = $2`, [
        customerId,
        bvId,
      ]);
      await markCustomerGmbv(customerId);
    }

    return { customerId };
  },

  async remove(userId: string, id: string, roleId?: string) {
    await ensureBvReportsSchema();
    const isManager = isManagerRole(roleId);
    // Try bv_reports first
    const bvRes = await pool.query(
      isManager
        ? `DELETE FROM bv_reports WHERE id = $1`
        : `DELETE FROM bv_reports WHERE id = $1 AND (user_id = $2 OR assigned_to = $2)`,
      isManager ? [id] : [id, userId]
    );
    if ((bvRes.rowCount ?? 0) > 0) return bvRes;
    // Fallback: try gm_entries (soft-delete)
    const gmRes = await pool.query(
      isManager
        ? `UPDATE gm_entries SET is_deleted = true, updated_at = now() WHERE id = $1`
        : `UPDATE gm_entries SET is_deleted = true, updated_at = now() WHERE id = $1 AND created_by::text = $2::text`,
      isManager ? [id] : [id, userId]
    ).catch(() => ({ rowCount: 0 }));
    return gmRes;
  },

  async withdraw(userId: string, id: string, roleId?: string) {
    await ensureBvReportsSchema();
    const isManager = isManagerRole(roleId);
    // Try bv_reports first
    const bvRes = await pool.query(
      isManager
        ? `UPDATE bv_reports SET status = 'Withdrawn', updated_at = now() WHERE id = $1`
        : `UPDATE bv_reports SET status = 'Withdrawn', updated_at = now() WHERE id = $1 AND (user_id = $2 OR assigned_to = $2)`,
      isManager ? [id] : [id, userId]
    );
    if ((bvRes.rowCount ?? 0) > 0) return bvRes;
    // Fallback: try gm_entries
    const gmRes = await pool.query(
      isManager
        ? `UPDATE gm_entries SET status = 'Withdrawn', updated_at = now() WHERE id = $1`
        : `UPDATE gm_entries SET status = 'Withdrawn', updated_at = now() WHERE id = $1 AND created_by::text = $2::text`,
      isManager ? [id] : [id, userId]
    ).catch(() => ({ rowCount: 0 }));
    return gmRes;
  },
};
