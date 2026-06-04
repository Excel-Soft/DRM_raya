import { pool } from "../db";
import {
  gradeSqlPredicate,
  isServiceGradeKey,
  normalizeServiceGrade,
  SERVICE_GRADE_KEYS,
  type ServiceGradeKey,
} from "../utils/service-grade";

export interface ServiceListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  executive?: string; // assigned_to user id
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  userIds?: string[] | null; // role scoping; null = no restriction (managers)
}

function paging(opts: ServiceListOptions) {
  const page = Math.max(1, Number(opts.page) || 1);
  const pageSize = Math.max(1, Math.min(200, Number(opts.pageSize) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export class ServiceReportsRepository {
  /**
   * Ensure additive columns used by the complaint lifecycle exist. Safe &
   * idempotent (the imported app's drizzle schema does not declare these yet,
   * so we add them via IF NOT EXISTS rather than a migration).
   */
  async ensureComplaintColumns() {
    try {
      await pool.query(`
        ALTER TABLE drm.service_complaints ADD COLUMN IF NOT EXISTS due_date timestamptz;
        ALTER TABLE drm.service_complaints ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
        ALTER TABLE drm.service_complaints ADD COLUMN IF NOT EXISTS closed_at timestamptz;
        ALTER TABLE drm.service_complaints ADD COLUMN IF NOT EXISTS reopened_at timestamptz;
      `);
    } catch (err) {
      console.error("Failed ensuring service_complaints lifecycle columns:", err);
    }
  }

  // ---- Grade customers ------------------------------------------------------
  async listCustomersByGrade(grade: ServiceGradeKey, opts: ServiceListOptions) {
    if (!isServiceGradeKey(grade)) {
      return { data: [], total: 0, page: 1, pageSize: 0 };
    }
    const { page, pageSize, offset } = paging(opts);
    const where: string[] = ["1=1"];
    const params: any[] = [];
    let p = 1;

    const pred = gradeSqlPredicate(grade, "c.grade", p);
    where.push(pred.sql);
    params.push(...pred.params);
    p = pred.nextParam;

    if (opts.search) {
      where.push(`(c.company_name ILIKE $${p} OR c.person_name ILIKE $${p} OR c.account_name ILIKE $${p} OR c.drm_id ILIKE $${p})`);
      params.push(`%${opts.search}%`);
      p++;
    }
    if (opts.executive) {
      where.push(`sc.assigned_to = $${p++}`);
      params.push(opts.executive);
    }
    if (opts.status) {
      where.push(`sc.status = $${p++}`);
      params.push(opts.status);
    }
    if (opts.dateFrom) {
      where.push(`sc.created_at >= $${p++}`);
      params.push(opts.dateFrom);
    }
    if (opts.dateTo) {
      where.push(`sc.created_at <= $${p++}`);
      params.push(opts.dateTo);
    }
    if (opts.userIds && opts.userIds.length > 0) {
      where.push(`sc.assigned_to = ANY($${p++})`);
      params.push(opts.userIds);
    }

    const whereSql = where.join(" AND ");
    const base = `
      FROM drm.service_customers sc
      JOIN drm.customers c ON c.id = sc.customer_id
      LEFT JOIN drm.users u ON u.id = sc.assigned_to
      LEFT JOIN drm.services s ON s.id = sc.package_id
      WHERE ${whereSql}
    `;
    const dataQuery = `
      SELECT
        sc.id AS "id",
        sc.customer_id AS "customerId",
        c.company_name AS "companyName",
        c.person_name AS "personName",
        c.account_name AS "accountName",
        c.grade AS "grade",
        c.phone AS "phone",
        c.email AS "email",
        c.website AS "website",
        c.source AS "source",
        c.service_types AS "serviceTypes",
        u.name AS "executiveName",
        sc.assigned_to AS "executiveId",
        sc.status AS "status",
        s.name AS "packageName",
        sc.service_start_date AS "serviceStartDate",
        sc.expiry_date AS "expiryDate",
        sc.created_at AS "createdAt"
      ${base}
      ORDER BY sc.created_at DESC
      LIMIT $${p++} OFFSET $${p++}
    `;
    params.push(pageSize, offset);
    const countQuery = `SELECT COUNT(*)::int AS total ${base}`;
    const [rows, count] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);
    return { data: rows.rows, total: count.rows[0]?.total || 0, page, pageSize };
  }

  // ---- Monthly follow-ups ---------------------------------------------------
  async monthlyFollowups(opts: ServiceListOptions) {
    const { page, pageSize, offset } = paging(opts);
    const where: string[] = ["1=1"];
    const params: any[] = [];
    let p = 1;

    // default window = current month by next_followup_date, overridable
    if (opts.dateFrom) {
      where.push(`f.next_followup_date >= $${p++}`);
      params.push(opts.dateFrom);
    } else {
      where.push(`f.next_followup_date >= date_trunc('month', now())`);
    }
    if (opts.dateTo) {
      where.push(`f.next_followup_date <= $${p++}`);
      params.push(opts.dateTo);
    } else {
      where.push(`f.next_followup_date < (date_trunc('month', now()) + interval '1 month')`);
    }
    if (opts.status) {
      where.push(`f.status = $${p++}`);
      params.push(opts.status);
    }
    if (opts.executive) {
      where.push(`f.assigned_to = $${p++}`);
      params.push(opts.executive);
    }
    if (opts.search) {
      where.push(`(c.company_name ILIKE $${p} OR c.person_name ILIKE $${p})`);
      params.push(`%${opts.search}%`);
      p++;
    }
    if (opts.userIds && opts.userIds.length > 0) {
      where.push(`f.assigned_to = ANY($${p++})`);
      params.push(opts.userIds);
    }
    const whereSql = where.join(" AND ");
    const base = `
      FROM drm.service_followups f
      LEFT JOIN drm.customers c ON c.id = f.customer_id
      LEFT JOIN drm.users u ON u.id = f.assigned_to
      WHERE ${whereSql}
    `;
    const dataQuery = `
      SELECT
        f.id AS "id",
        f.service_customer_id AS "serviceCustomerId",
        f.customer_id AS "customerId",
        c.company_name AS "companyName",
        c.person_name AS "personName",
        c.grade AS "grade",
        f.method AS "method",
        f.purpose AS "purpose",
        f.note AS "note",
        f.status AS "status",
        f.next_followup_date AS "nextFollowupDate",
        f.completed_at AS "lastFollowupAt",
        u.name AS "executiveName",
        (f.status = 'pending' AND f.next_followup_date < now()) AS "overdue",
        f.created_at AS "createdAt"
      ${base}
      ORDER BY f.next_followup_date ASC NULLS LAST
      LIMIT $${p++} OFFSET $${p++}
    `;
    params.push(pageSize, offset);
    const countQuery = `SELECT COUNT(*)::int AS total ${base}`;
    const [rows, count] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);
    return { data: rows.rows, total: count.rows[0]?.total || 0, page, pageSize };
  }

  // ---- Not-followed customers ----------------------------------------------
  async notFollowed(opts: ServiceListOptions) {
    const { page, pageSize, offset } = paging(opts);
    const where: string[] = ["1=1"];
    const params: any[] = [];
    let p = 1;

    // No completed follow-up in the last 30 days (or never followed)
    where.push(`NOT EXISTS (
      SELECT 1 FROM drm.service_followups f
      WHERE f.service_customer_id = sc.id
        AND f.status = 'completed'
        AND f.completed_at > now() - interval '30 days'
    )`);

    if (opts.executive) {
      where.push(`sc.assigned_to = $${p++}`);
      params.push(opts.executive);
    }
    if (opts.search) {
      where.push(`(c.company_name ILIKE $${p} OR c.person_name ILIKE $${p})`);
      params.push(`%${opts.search}%`);
      p++;
    }
    if (opts.userIds && opts.userIds.length > 0) {
      where.push(`sc.assigned_to = ANY($${p++})`);
      params.push(opts.userIds);
    }
    const whereSql = where.join(" AND ");
    const base = `
      FROM drm.service_customers sc
      JOIN drm.customers c ON c.id = sc.customer_id
      LEFT JOIN drm.users u ON u.id = sc.assigned_to
      WHERE ${whereSql}
    `;
    const dataQuery = `
      SELECT
        sc.id AS "id",
        sc.customer_id AS "customerId",
        c.company_name AS "companyName",
        c.person_name AS "personName",
        c.account_name AS "accountName",
        c.company_type AS "type",
        c.website AS "website",
        c.service_types AS "serviceTypes",
        c.grade AS "grade",
        c.source AS "source",
        u.name AS "executiveName",
        c.last_followup_date AS "lastFollowupAt",
        sc.created_at AS "createdAt"
      ${base}
      ORDER BY c.last_followup_date ASC NULLS FIRST
      LIMIT $${p++} OFFSET $${p++}
    `;
    params.push(pageSize, offset);
    const countQuery = `SELECT COUNT(*)::int AS total ${base}`;
    const [rows, count] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);
    return { data: rows.rows, total: count.rows[0]?.total || 0, page, pageSize };
  }

  // ---- Dropouts -------------------------------------------------------------
  async dropouts(opts: ServiceListOptions & { weeklyOnly?: boolean }) {
    const { page, pageSize, offset } = paging(opts);
    const where: string[] = ["1=1"];
    const params: any[] = [];
    let p = 1;

    if (opts.weeklyOnly) {
      where.push(`d.created_at >= now() - interval '7 days'`);
    }
    if (opts.status) {
      where.push(`d.status = $${p++}`);
      params.push(opts.status);
    }
    if (opts.search) {
      where.push(`(c.company_name ILIKE $${p} OR c.person_name ILIKE $${p})`);
      params.push(`%${opts.search}%`);
      p++;
    }
    if (opts.dateFrom) {
      where.push(`d.created_at >= $${p++}`);
      params.push(opts.dateFrom);
    }
    if (opts.dateTo) {
      where.push(`d.created_at <= $${p++}`);
      params.push(opts.dateTo);
    }
    if (opts.userIds && opts.userIds.length > 0) {
      where.push(`sc.assigned_to = ANY($${p++})`);
      params.push(opts.userIds);
    }
    const whereSql = where.join(" AND ");
    const base = `
      FROM drm.service_dropouts d
      LEFT JOIN drm.service_customers sc ON sc.id = d.service_customer_id
      LEFT JOIN drm.customers c ON c.id = COALESCE(d.customer_id, sc.customer_id)
      WHERE ${whereSql}
    `;
    const dataQuery = `
      SELECT
        d.id AS "id",
        d.service_customer_id AS "serviceCustomerId",
        c.company_name AS "companyName",
        c.person_name AS "personName",
        c.grade AS "grade",
        c.service_types AS "serviceTypes",
        d.reason AS "reason",
        d.status AS "status",
        d.recovery_note AS "recoveryNote",
        d.recovered_at AS "recoveredAt",
        d.created_at AS "createdAt"
      ${base}
      ORDER BY d.created_at DESC
      LIMIT $${p++} OFFSET $${p++}
    `;
    params.push(pageSize, offset);
    const countQuery = `SELECT COUNT(*)::int AS total ${base}`;
    const [rows, count] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);
    return { data: rows.rows, total: count.rows[0]?.total || 0, page, pageSize };
  }

  // ---- Due VAS payments -----------------------------------------------------
  // Derived report: there is no dedicated VAS payment ledger. Amounts come from
  // the latest service_renewal for the service customer (may be null). Due date
  // is the service customer's expiry date.
  async dueVasPayments(opts: ServiceListOptions) {
    const { page, pageSize, offset } = paging(opts);
    const where: string[] = ["sc.expiry_date IS NOT NULL"];
    const params: any[] = [];
    let p = 1;

    if (opts.dateFrom) {
      where.push(`sc.expiry_date >= $${p++}`);
      params.push(opts.dateFrom);
    }
    if (opts.dateTo) {
      where.push(`sc.expiry_date <= $${p++}`);
      params.push(opts.dateTo);
    }
    if (opts.executive) {
      where.push(`sc.assigned_to = $${p++}`);
      params.push(opts.executive);
    }
    if (opts.search) {
      where.push(`c.company_name ILIKE $${p++}`);
      params.push(`%${opts.search}%`);
    }
    if (opts.userIds && opts.userIds.length > 0) {
      where.push(`sc.assigned_to = ANY($${p++})`);
      params.push(opts.userIds);
    }
    const whereSql = where.join(" AND ");
    const base = `
      FROM drm.service_customers sc
      JOIN drm.customers c ON c.id = sc.customer_id
      LEFT JOIN drm.users u ON u.id = sc.assigned_to
      LEFT JOIN drm.services s ON s.id = sc.package_id
      LEFT JOIN LATERAL (
        SELECT amount FROM drm.service_renewals r
        WHERE r.service_customer_id = sc.id
        ORDER BY r.created_at DESC LIMIT 1
      ) r ON true
      WHERE ${whereSql}
    `;
    const dataQuery = `
      SELECT
        sc.id AS "id",
        sc.customer_id AS "customerId",
        c.company_name AS "companyName",
        u.name AS "executiveName",
        s.name AS "packageName",
        r.amount AS "total",
        sc.expiry_date AS "dueDate",
        CASE
          WHEN sc.expiry_date < now() THEN 'overdue'
          WHEN sc.expiry_date < now() + interval '30 days' THEN 'due_soon'
          ELSE 'upcoming'
        END AS "paymentStatus",
        CASE
          WHEN sc.expiry_date >= now() THEN 'not_due'
          WHEN sc.expiry_date >= now() - interval '30 days' THEN '0-30'
          WHEN sc.expiry_date >= now() - interval '60 days' THEN '31-60'
          WHEN sc.expiry_date >= now() - interval '90 days' THEN '61-90'
          ELSE '90+'
        END AS "agingBucket"
      ${base}
      ORDER BY sc.expiry_date ASC
      LIMIT $${p++} OFFSET $${p++}
    `;
    params.push(pageSize, offset);
    const countQuery = `SELECT COUNT(*)::int AS total ${base}`;
    const [rows, count] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);
    return { data: rows.rows, total: count.rows[0]?.total || 0, page, pageSize };
  }

  // ---- Complaints (joined list) --------------------------------------------
  async listComplaints(opts: ServiceListOptions & { priority?: string }) {
    const { page, pageSize, offset } = paging(opts);
    const where: string[] = ["1=1"];
    const params: any[] = [];
    let p = 1;

    if (opts.status) {
      where.push(`cp.status = $${p++}`);
      params.push(opts.status);
    }
    if (opts.priority) {
      where.push(`cp.priority = $${p++}`);
      params.push(opts.priority);
    }
    if (opts.executive) {
      where.push(`cp.assigned_to = $${p++}`);
      params.push(opts.executive);
    }
    if (opts.search) {
      where.push(`(c.company_name ILIKE $${p} OR cp.title ILIKE $${p} OR c.person_name ILIKE $${p})`);
      params.push(`%${opts.search}%`);
      p++;
    }
    if (opts.dateFrom) {
      where.push(`cp.created_at >= $${p++}`);
      params.push(opts.dateFrom);
    }
    if (opts.dateTo) {
      where.push(`cp.created_at <= $${p++}`);
      params.push(opts.dateTo);
    }
    if (opts.userIds && opts.userIds.length > 0) {
      where.push(`(cp.assigned_to = ANY($${p}) OR cp.created_by = ANY($${p}))`);
      params.push(opts.userIds);
      p++;
    }
    const whereSql = where.join(" AND ");
    const base = `
      FROM drm.service_complaints cp
      LEFT JOIN drm.customers c ON c.id = COALESCE(cp.customer_id, cp.company_id)
      LEFT JOIN drm.users u ON u.id = cp.assigned_to
      WHERE ${whereSql}
    `;
    const dataQuery = `
      SELECT
        cp.id AS "id",
        cp.service_customer_id AS "serviceCustomerId",
        cp.customer_id AS "customerId",
        c.company_name AS "companyName",
        c.person_name AS "personName",
        cp.title AS "title",
        cp.description AS "description",
        cp.priority AS "priority",
        cp.status AS "status",
        cp.assigned_to AS "assignedTo",
        u.name AS "assignedToName",
        cp.remarks AS "remarks",
        cp.due_date AS "dueDate",
        cp.assigned_at AS "assignedAt",
        cp.resolved_at AS "resolvedAt",
        cp.closed_at AS "closedAt",
        cp.created_at AS "createdAt"
      ${base}
      ORDER BY cp.created_at DESC
      LIMIT $${p++} OFFSET $${p++}
    `;
    params.push(pageSize, offset);
    const countQuery = `SELECT COUNT(*)::int AS total ${base}`;
    const [rows, count] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);
    return { data: rows.rows, total: count.rows[0]?.total || 0, page, pageSize };
  }

  // ---- Dashboard counts -----------------------------------------------------
  async dashboardCounts(userIds?: string[] | null) {
    const scopeSql = userIds && userIds.length > 0 ? `WHERE sc.assigned_to = ANY($1)` : "";
    const scopeParams = userIds && userIds.length > 0 ? [userIds] : [];

    const gradeQuery = `
      SELECT c.grade AS grade
      FROM drm.service_customers sc
      JOIN drm.customers c ON c.id = sc.customer_id
      ${scopeSql}
    `;
    const gradeRes = await pool.query(gradeQuery, scopeParams);
    const gradeCounts: Record<ServiceGradeKey | "other", number> = {
      A: 0, B_PLUS: 0, B: 0, B_MINUS: 0, other: 0,
    };
    for (const row of gradeRes.rows) {
      const key = normalizeServiceGrade(row.grade);
      if (key) gradeCounts[key]++; else gradeCounts.other++;
    }

    const complaintScope = userIds && userIds.length > 0 ? `WHERE (assigned_to = ANY($1) OR created_by = ANY($1))` : "";
    const complaintRes = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM drm.service_complaints ${complaintScope} GROUP BY status`,
      scopeParams,
    );
    const complaintCounts: Record<string, number> = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const row of complaintRes.rows) complaintCounts[row.status] = Number(row.n);

    const dueFollowupsRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM drm.service_followups f
       WHERE f.status = 'pending' AND f.next_followup_date <= now()
       ${userIds && userIds.length > 0 ? "AND f.assigned_to = ANY($1)" : ""}`,
      scopeParams,
    );
    const dropoutsRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM drm.service_dropouts d
       LEFT JOIN drm.service_customers sc ON sc.id = d.service_customer_id
       WHERE d.status = 'pending_recovery'
       ${userIds && userIds.length > 0 ? "AND sc.assigned_to = ANY($1)" : ""}`,
      scopeParams,
    );
    const duePaymentsRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM drm.service_customers sc
       WHERE sc.expiry_date IS NOT NULL AND sc.expiry_date < now() + interval '30 days'
       ${scopeSql}`,
      scopeParams,
    );

    return {
      grades: gradeCounts,
      complaints: complaintCounts,
      dueFollowups: dueFollowupsRes.rows[0]?.n || 0,
      dropouts: dropoutsRes.rows[0]?.n || 0,
      duePayments: duePaymentsRes.rows[0]?.n || 0,
      gradeKeys: SERVICE_GRADE_KEYS,
    };
  }
}

export const serviceReportsRepository = new ServiceReportsRepository();
