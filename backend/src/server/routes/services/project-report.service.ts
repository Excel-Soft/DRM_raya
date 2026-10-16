import { pool } from "../../db";

/**
 * Real implementation of the legacy "Check Project Reports" page
 * (projectreport.php + func.php). Replaces a stub that resolved `undefined`
 * and crashed every request with a 500.
 *
 * Legacy joined a dozen helper-function lookups (payMent2, verifyGm, comData,
 * gmCom, gmDoc, invoice, invoiceItem, payMent, comProStatus, hodStatus,
 * webxl_task_links, taskAssign, qutationService) across tables that mostly
 * don't exist in the modern schema. Mapping confirmed against the live DB
 * (not guessed) before writing this:
 *
 *   - projects.gmId is empty on every live row, so a project's GM entry is
 *     resolved via its invoice's gm_id (product_posting_invoices.gm_id),
 *     falling back to the most recent gm_entries row for the same customer.
 *   - projects.invoiceId is effectively polymorphic: some rows resolve
 *     against product_posting_invoices, others against invoices — both are
 *     LEFT JOINed and coalesced.
 *   - Several legacy columns (company-keyed "GM Pay"/"Receipt" dates, a
 *     task-links table, a company-keyed HOD-status table, invoice line-item
 *     unit price, a "Dep" date) have no real modern equivalent at all, or
 *     the real column exists but is empty on every live row. Those render
 *     "-" honestly rather than being invented.
 */

export interface ProjectReportFilters {
  companyName: string;
  startDate: string;
  endDate: string;
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
  p15Penalty: boolean;
  assignDate: string | null;
  finish: string | null;
  remaining: number;
}

let serviceMinDaysCache: Map<string, number> | null = null;
let serviceMinDaysCacheAt = 0;
const SERVICE_CACHE_TTL_MS = 5 * 60 * 1000;

/** name (lowercased) -> min_day, for the "days left" deadline calc. Small,
 * rarely-changing table — cached briefly rather than queried per row. */
async function getServiceMinDays(): Promise<Map<string, number>> {
  if (serviceMinDaysCache && Date.now() - serviceMinDaysCacheAt < SERVICE_CACHE_TTL_MS) {
    return serviceMinDaysCache;
  }
  const result = await pool.query<{ name: string; min_day: number | null }>(
    `SELECT name, min_day FROM drm.services WHERE is_active = true AND min_day IS NOT NULL`,
  );
  const map = new Map<string, number>();
  for (const row of result.rows) {
    if (row.name && row.min_day != null) map.set(row.name.trim().toLowerCase(), row.min_day);
  }
  serviceMinDaysCache = map;
  serviceMinDaysCacheAt = Date.now();
  return map;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export async function listProjectReport(filters: ProjectReportFilters): Promise<{ rows: ProjectReportRow[]; total: number }> {
  const { companyName, startDate, endDate, search, page, limit } = filters;

  const conditions: string[] = ["coalesce(p.is_deleted, false) = false"];
  const params: any[] = [];
  const add = (v: any) => {
    params.push(v);
    return `$${params.length}`;
  };

  conditions.push(`p.created_at >= ${add(startDate)}::date`);
  conditions.push(`p.created_at < (${add(endDate)}::date + interval '1 day')`);

  if (companyName) {
    conditions.push(`c.company_name ILIKE ${add(`%${companyName}%`)}`);
  }
  if (search) {
    const term = add(`%${search}%`);
    conditions.push(
      `(c.company_name ILIKE ${term} OR c.drm_id ILIKE ${term} OR p.name ILIKE ${term} OR p.project_number ILIKE ${term})`,
    );
  }

  const whereSql = `WHERE ${conditions.join(" AND ")}`;

  const countResult = await pool.query<{ count: string }>(
    `SELECT count(*) FROM drm.projects p LEFT JOIN drm.customers c ON c.id = p.customer_id ${whereSql}`,
    params,
  );
  const total = Number(countResult.rows[0]?.count ?? 0);

  const limitParam = add(limit);
  const offsetParam = add((page - 1) * limit);

  const listSql = `
    WITH gm_match AS (
      SELECT DISTINCT ON (p.id)
        p.id AS project_id,
        g.package_type,
        g.entry_type,
        g.sales_person_name,
        g.gm_bv_date,
        g.pay_date AS gm_pay_date,
        g.hod_approved_at
      FROM drm.projects p
      LEFT JOIN drm.product_posting_invoices ppi_g ON ppi_g.id = p.invoice_id
      LEFT JOIN drm.gm_entries g ON g.id::text = ppi_g.gm_id OR g.customer_id = p.customer_id
      ORDER BY p.id, (g.id::text = ppi_g.gm_id) DESC NULLS LAST, g.created_at DESC NULLS LAST
    )
    SELECT
      p.id, p.project_number, p.name AS project_name, p.service_type, p.created_at AS project_created_at,
      c.drm_id, c.company_name, c.created_at AS customer_created_at,
      ppi.created_at AS ppi_created_at, ppi.payment_method AS ppi_method,
      inv.created_at AS inv_created_at, inv.payment_method AS inv_method,
      ppw.data_verified_at, ppw.assigned_at, ppw.updated_at AS ppw_updated_at,
      gm.package_type, gm.entry_type, gm.sales_person_name, gm.gm_bv_date, gm.gm_pay_date, gm.hod_approved_at,
      (SELECT count(*)::int FROM drm.project_documents pd WHERE pd.project_id = p.id) AS doc_count,
      (SELECT count(*)::int FROM drm.tasks t
         WHERE t.project_id = p.id AND (gm.gm_bv_date IS NULL OR t.created_at >= gm.gm_bv_date)) AS task_count
    FROM drm.projects p
    LEFT JOIN drm.customers c ON c.id = p.customer_id
    LEFT JOIN drm.product_posting_invoices ppi ON ppi.id = p.invoice_id
    LEFT JOIN drm.invoices inv ON inv.id = p.invoice_id
    LEFT JOIN drm.product_posting_workflows ppw ON ppw.project_id = p.id
    LEFT JOIN gm_match gm ON gm.project_id = p.id
    ${whereSql}
    ORDER BY p.created_at DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const result = await pool.query(listSql, params);
  const minDays = await getServiceMinDays();
  const today = new Date();

  const rows: ProjectReportRow[] = result.rows.map((r: any, index: number) => {
    const projectName: string | null = r.service_type || r.project_name || null;
    const bvDate: Date | null = r.gm_bv_date ? new Date(r.gm_bv_date) : null;
    const projectCreatedAt: Date = new Date(r.project_created_at);

    // "15P" — legacy counted task-links created since the BV date, flagging
    // red ("<count>-p") when fewer than 15 exist 12+ days past that date for
    // a New (non-renewal) entry.
    const taskCount = Number(r.task_count) || 0;
    const penaltyDeadline = bvDate ? addDays(bvDate, 12) : null;
    const isNewEntry = r.entry_type === "New";
    const p15Penalty = Boolean(
      penaltyDeadline && taskCount < 15 && today >= penaltyDeadline && isNewEntry,
    );

    // "Remaining"/"Finish" — days left until projectCreatedAt + the matched
    // service's min_day. Legacy's "Alibaba Product Posting" special case
    // combined two other services' min_day with a date-math quirk that
    // produced negative/nonsensical values past day 7; this uses that
    // service's own min_day directly instead of replicating the bug.
    const minDay = projectName ? minDays.get(projectName.trim().toLowerCase()) ?? null : null;
    let remaining = 0;
    let finishDate: Date | null = null;
    if (minDay != null) {
      finishDate = addDays(projectCreatedAt, minDay);
      remaining = daysBetween(today, finishDate);
    }

    return {
      rowNumber: (page - 1) * limit + index + 1,
      id: r.id,
      displayId: r.drm_id ?? r.project_number ?? null,
      name: r.company_name ?? null,
      package: r.package_type ?? null,
      status: r.entry_type ?? null,
      person: r.sales_person_name ?? null,
      customerCreateDate: r.customer_created_at ?? null,
      gmPayDate: r.gm_pay_date ?? null,
      gmDoc: Number(r.doc_count) || 0,
      bvDate: r.gm_bv_date ?? null,
      invoiceDate: r.ppi_created_at ?? r.inv_created_at ?? null,
      receiptDate: null, // no populated modern source (see module doc comment)
      method: r.ppi_method ?? r.inv_method ?? null,
      project: projectName,
      projectCreateDate: r.project_created_at ?? null,
      dataDate: r.data_verified_at ?? null,
      hodDate: r.hod_approved_at ?? null,
      depDate: null, // no real modern equivalent (see module doc comment)
      p15: taskCount,
      p15Penalty,
      assignDate: r.assigned_at ?? null,
      finish: finishDate ? finishDate.toISOString() : null,
      remaining,
    };
  });

  return { rows, total };
}
