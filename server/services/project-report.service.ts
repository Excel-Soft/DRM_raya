/**
 * D&D Manager → Project Report service.
 *
 * Real, DB-backed. One row per project, enriched from related tables. Tables that
 * have a direct foreign key to a project (project_details, project_documents,
 * project_payments, project_financials, product_posting_workflows,
 * software_workflows, tasks) are joined on project_id. Tables that have no FK to
 * a project (product_posting_invoices, gm_entries, bv_entries, invoices) are
 * matched by company name (case-insensitive, latest record wins).
 *
 * Honest missing-data behavior: text/date fields fall back to NULL (rendered as
 * "-" by the frontend); count-style fields fall back to 0.
 */
import { pool } from "../db";

export interface ProjectReportFilters {
  companyName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  search: string;
  page: number;
  limit: number;
}

export interface ProjectReportRow {
  rowNumber: number;
  id: string;
  displayId: string | null;
  name: string | null;
  package: string | null;
  status: string | null;
  person: string | null;
  customerCreateDate: string | null;
  gmPayDate: string | null;
  gmDoc: number;
  bvDate: string | null;
  invoiceDate: string | null;
  receiptDate: string | null;
  method: string | null;
  project: string | null;
  projectCreateDate: string | null;
  dataDate: string | null;
  hodDate: string | null;
  depDate: string | null;
  p15: number;
  assignDate: string | null;
  finish: string | null;
  remaining: number;
}

export interface ProjectReportResult {
  rows: ProjectReportRow[];
  total: number;
}

/**
 * Builds the per-project enriched rows. Filtering, search, ordering and
 * pagination are applied on top of the enriched set.
 */
export async function listProjectReport(
  filters: ProjectReportFilters,
): Promise<ProjectReportResult> {
  const { companyName, startDate, endDate, search, page, limit } = filters;
  const offset = (page - 1) * limit;

  const cteParams: any[] = [startDate, endDate, companyName, search];
  const dataParams: any[] = [...cteParams, limit, offset];

  const cte = `
    WITH base AS (
      SELECT
        p.id AS id,
        COALESCE(c.drm_id, gm.drm_id, left(p.id::text, 8)) AS "displayId",
        COALESCE(c.company_name, ppi.company_name, p.name) AS name,
        COALESCE(pd.package_name, gm.package_type) AS package,
        COALESCE(c.status::text, p.status, ppi.status) AS status,
        COALESCE(execu.name, owner.name, c.person_name, bv.person_name, gm.sales_person_name) AS person,
        COALESCE(c.created_at, p.created_at) AS "customerCreateDate",
        COALESCE(gm.approved_at, pf.last_payment_at) AS "gmPayDate",
        COALESCE(doc.cnt, 0) AS "gmDoc",
        COALESCE(bv.received_at, bv.created_at) AS "bvDate",
        COALESCE(inv.issue_date, ppi.created_at) AS "invoiceDate",
        COALESCE(pay.paid_at, inv.paid_at) AS "receiptDate",
        COALESCE(ppi.payment_method, inv.payment_method, bv.method, gm.payment_status) AS method,
        COALESCE(p.name, ppi.company_name, pd.package_name) AS project,
        COALESCE(p.created_at, ppw.created_at, sw.created_at) AS "projectCreateDate",
        COALESCE(ppw.data_verified_at, sw.data_verified_at, pd.created_at) AS "dataDate",
        COALESCE(gm.approved_at, ppi.updated_at) AS "hodDate",
        COALESCE(ppw.assigned_at, sw.assigned_at) AS "depDate",
        COALESCE(tcnt.cnt, 0) AS p15,
        COALESCE(ppw.assigned_at, sw.assigned_at, tstart.start_date) AS "assignDate",
        CASE
          WHEN ppw.current_phase = 'VERIFICATION_COMPLETE' THEN ppw.verification_reviewed_at
          WHEN sw.current_phase = 'VERIFICATION_COMPLETE' THEN sw.verification_reviewed_at
          WHEN p.status = 'Completed' THEN p.end_date
          ELSE NULL
        END AS finish,
        COALESCE(rem.cnt, 0) AS remaining,
        COALESCE(c.created_at, p.created_at) AS _sortdate
      FROM drm.projects p
      LEFT JOIN drm.customers c ON c.id = p.customer_id
      LEFT JOIN drm.users owner ON owner.id = p.owner_user_id
      LEFT JOIN drm.project_financials pf ON pf.project_id::text = p.id::text
      LEFT JOIN drm.product_posting_workflows ppw ON ppw.project_id = p.id
      LEFT JOIN drm.software_workflows sw ON sw.project_id = p.id
      LEFT JOIN LATERAL (
        SELECT d.package_name, d.created_at
        FROM drm.project_details d
        WHERE d.project_id = p.id
        ORDER BY d.created_at DESC NULLS LAST
        LIMIT 1
      ) pd ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS cnt FROM drm.project_documents d WHERE d.project_id = p.id
      ) doc ON true
      LEFT JOIN LATERAL (
        SELECT pp.paid_at
        FROM drm.project_payments pp
        WHERE pp.project_id::text = p.id::text
        ORDER BY pp.paid_at DESC NULLS LAST
        LIMIT 1
      ) pay ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS cnt FROM drm.tasks t WHERE t.project_id = p.id
      ) tcnt ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS cnt
        FROM drm.tasks t
        WHERE t.project_id = p.id AND t.status::text NOT IN ('Done', 'Completed')
      ) rem ON true
      LEFT JOIN LATERAL (
        SELECT min(t.start_date) AS start_date FROM drm.tasks t WHERE t.project_id = p.id
      ) tstart ON true
      LEFT JOIN LATERAL (
        SELECT x.company_name, x.status, x.payment_method, x.created_at, x.updated_at, x.sales_exec_id
        FROM drm.product_posting_invoices x
        WHERE x.company_name IS NOT NULL
          AND lower(x.company_name) = lower(COALESCE(c.company_name, p.name))
        ORDER BY x.created_at DESC NULLS LAST
        LIMIT 1
      ) ppi ON true
      LEFT JOIN drm.users execu ON execu.id = ppi.sales_exec_id
      LEFT JOIN LATERAL (
        SELECT x.drm_id, x.package_type, x.approved_at, x.payment_status, x.sales_person_name
        FROM drm.gm_entries x
        WHERE lower(x.company_name) = lower(COALESCE(c.company_name, p.name))
        ORDER BY x.created_at DESC NULLS LAST
        LIMIT 1
      ) gm ON true
      LEFT JOIN LATERAL (
        SELECT x.received_at, x.created_at, x.method, x.person_name
        FROM drm.bv_entries x
        WHERE lower(x.company_name) = lower(COALESCE(c.company_name, p.name))
        ORDER BY x.created_at DESC NULLS LAST
        LIMIT 1
      ) bv ON true
      LEFT JOIN LATERAL (
        SELECT x.issue_date, x.paid_at, x.payment_method
        FROM drm.invoices x
        WHERE lower(x.customer_name) = lower(COALESCE(c.company_name, p.name))
        ORDER BY x.issue_date DESC NULLS LAST
        LIMIT 1
      ) inv ON true
    ),
    filtered AS (
      SELECT *
      FROM base
      WHERE _sortdate >= $1::date
        AND _sortdate < ($2::date + interval '1 day')
        AND ($3 = '' OR lower(COALESCE(name, '')) LIKE '%' || lower($3) || '%')
        AND (
          $4 = '' OR
          lower(COALESCE("displayId", '')) LIKE '%' || lower($4) || '%' OR
          lower(COALESCE(name, '')) LIKE '%' || lower($4) || '%' OR
          lower(COALESCE(package, '')) LIKE '%' || lower($4) || '%' OR
          lower(COALESCE(status, '')) LIKE '%' || lower($4) || '%' OR
          lower(COALESCE(person, '')) LIKE '%' || lower($4) || '%' OR
          lower(COALESCE(method, '')) LIKE '%' || lower($4) || '%' OR
          lower(COALESCE(project, '')) LIKE '%' || lower($4) || '%'
        )
    )
  `;

  // The paginated page and the total count are run as two queries against the
  // same CTE so the filter/search logic stays in one place. A single windowed
  // count(*) OVER() would read 0 whenever OFFSET skips past every matching row
  // (e.g. an out-of-range page), so the total is queried independently.
  const dataSql = `${cte}
    SELECT *
    FROM filtered
    ORDER BY _sortdate DESC NULLS LAST
    LIMIT $5 OFFSET $6
  `;
  const countSql = `${cte}
    SELECT count(*)::int AS total
    FROM filtered
  `;

  const [dataRes, countRes] = await Promise.all([
    pool.query(dataSql, dataParams),
    pool.query(countSql, cteParams),
  ]);
  const rows = dataRes.rows;
  const total = countRes.rows[0] ? Number(countRes.rows[0].total) : 0;

  const mapped: ProjectReportRow[] = rows.map((r, i) => ({
    rowNumber: offset + i + 1,
    id: String(r.id),
    displayId: r.displayId ?? null,
    name: r.name ?? null,
    package: r.package ?? null,
    status: r.status ?? null,
    person: r.person ?? null,
    customerCreateDate: r.customerCreateDate ?? null,
    gmPayDate: r.gmPayDate ?? null,
    gmDoc: Number(r.gmDoc ?? 0),
    bvDate: r.bvDate ?? null,
    invoiceDate: r.invoiceDate ?? null,
    receiptDate: r.receiptDate ?? null,
    method: r.method ?? null,
    project: r.project ?? null,
    projectCreateDate: r.projectCreateDate ?? null,
    dataDate: r.dataDate ?? null,
    hodDate: r.hodDate ?? null,
    depDate: r.depDate ?? null,
    p15: Number(r.p15 ?? 0),
    assignDate: r.assignDate ?? null,
    finish: r.finish ?? null,
    remaining: Number(r.remaining ?? 0),
  }));

  return { rows: mapped, total };
}
