import { pool } from "../../db";

/**
 * "Check Project Reports" (Reports → Projects, /api/reports/projects and
 * /api/dd-manager/project-report).
 *
 * The report is the union of two sources, paged together by project create
 * date (newest first):
 *
 *  1. LEGACY rows — a SQL port of the old PHP report (func.php,
 *     `isset($_POST['startDataProject'])`, "Gm Date waise project") over the
 *     copied MySQL tables in schema `legacy_archive` (all columns TEXT). One
 *     row per webxl_create_project whose create_data date part is BETWEEN
 *     startDate AND endDate (inclusive). Each PHP helper is reproduced as a
 *     DISTINCT ON CTE restricted to the page's companies/projects, picking the
 *     same row the helper picked:
 *       comData       webxl_company      id = com_id                 (com_id code, cname, create_date)
 *       username      webxl_user         user_id = project.user_id   (name)
 *       verifyGm      webxl_verify_gm    latest id, package NOT IN Kwa/Ai/CAT (package, renwal, create_date = GM pay)
 *       gmCom         webxl_gmaccount    first id                    (create_data = BV date)
 *       gmDoc         webxl_gm_doc       first id                    (upload)
 *       invoice       webxl_invoice      latest invoice_id           (create_date)
 *       invoiceItem   webxl_invoice_item first id of that invoice    (unit_price)
 *       payMent       webxl_payments     latest id of that invoice   (create_date = receipt, method)
 *       comProStatus  webxl_project_status first id for pro_id      (pro_update = Data)
 *       hodStatus     webxl_status_hod   first id                    (update_date = Hod)
 *       taskAssign    webxl_task_assign  first id for pro_id         (assign_date, last_update, stauts)
 *       qutationService webxl_quotation_services name (case-insens.) (min_day)
 *     "First" = lowest primary key (what MySQL returns for an un-ordered
 *     SELECT); "latest" = the helper's ORDER BY ... DESC, compared numerically.
 *     Old datetimes are Pakistan local time; only their date part is shown
 *     (as the PHP did) and returned as a zone-less "YYYY-MM-DDT00:00:00".
 *
 *  2. MODERN rows — drm.projects created in the new app (projects copied from
 *     webxl_create_project are excluded via migration_meta.migration_legacy_ids
 *     because the legacy part already covers them, with their real dates).
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
  /** Number of GM documents for the company. */
  gmDoc: number;
  /** Upload date of the company's first GM document (legacy rows; the old report showed this date). */
  gmDocDate?: string | null;
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
  /** Days left until the deadline, or (legacy, finished on/after the deadline) the finish date. */
  remaining: number | string;
}

const LEGACY_TZ = "Asia/Karachi";
const LEGACY_SOURCE = "webxl_create_project";

/** SQL: a legacy TEXT datetime/date → date (NULL for '', '0000-00-00', garbage). */
const D = (expr: string) =>
  `(CASE WHEN pg_input_is_valid(left(${expr}, 10), 'date') THEN left(${expr}, 10)::date END)`;
/** SQL: date → zone-less ISO string so the browser renders the same calendar day. */
const OUT = (expr: string) => `to_char(${expr}, 'YYYY-MM-DD"T"00:00:00')`;
/** SQL: numeric ordering key for a TEXT primary key. */
const PK = (expr: string) => `lpad(${expr}, 20, '0')`;
const TODAY_PK = `(now() AT TIME ZONE '${LEGACY_TZ}')::date`;

/**
 * Keys of every row (legacy + modern) matching the filters, plus the total.
 * $1 start, $2 end, $3 companyName pattern|null, $4 search pattern|null,
 * $5 limit, $6 offset.
 */
const PAGE_SQL = `
  WITH legacy AS (
    SELECT 'L'::text AS kind,
           cp._legacy_pk AS key,
           CASE WHEN pg_input_is_valid(cp.create_data, 'timestamp')
                THEN cp.create_data::timestamp AT TIME ZONE '${LEGACY_TZ}' END AS sort_ts
    FROM legacy_archive.webxl_create_project cp
    LEFT JOIN legacy_archive.webxl_company co
           ON co._source_table = 'webxl_company' AND co._legacy_pk = cp.com_id
    WHERE cp._source_table = '${LEGACY_SOURCE}'
      AND left(cp.create_data, 10) BETWEEN $1 AND $2
      AND ($3::text IS NULL OR co.cname ILIKE $3)
      AND ($4::text IS NULL OR co.cname ILIKE $4 OR co.com_id ILIKE $4 OR cp.project ILIKE $4)
  ),
  modern AS (
    SELECT 'M'::text AS kind, p.id::text AS key, p.created_at::timestamptz AS sort_ts
    FROM drm.projects p
    LEFT JOIN drm.customers c ON c.id = p.customer_id
    WHERE coalesce(p.is_deleted, false) = false
      AND p.created_at >= $1::date
      AND p.created_at < ($2::date + interval '1 day')
      AND NOT EXISTS (
        SELECT 1 FROM migration_meta.migration_legacy_ids m
        WHERE m.modern_table = 'projects' AND m.modern_id = p.id::text
          AND m.legacy_table = '${LEGACY_SOURCE}'
      )
      AND ($3::text IS NULL OR c.company_name ILIKE $3)
      AND ($4::text IS NULL OR c.company_name ILIKE $4 OR c.drm_id ILIKE $4
           OR p.name ILIKE $4 OR p.service_type ILIKE $4)
  ),
  combined AS (
    SELECT * FROM legacy UNION ALL SELECT * FROM modern
  )
  SELECT t.total, pg.kind, pg.key
  FROM (SELECT count(*)::int AS total FROM combined) t
  LEFT JOIN LATERAL (
    SELECT kind, key FROM combined
    ORDER BY sort_ts DESC NULLS LAST, kind, ${PK("key")} DESC
    LIMIT $5 OFFSET $6
  ) pg ON true
`;

/** Full legacy rows for the given webxl_create_project pro_ids ($1 text[]). */
const LEGACY_DETAIL_SQL = `
  WITH cp AS (
    SELECT cp._legacy_pk AS pro_key, cp.pro_id, cp.com_id, cp.user_id, cp.project,
           ${D("cp.create_data")} AS pdate
    FROM legacy_archive.webxl_create_project cp
    WHERE cp._source_table = '${LEGACY_SOURCE}' AND cp._legacy_pk = ANY($1::text[])
  ),
  vg AS (   -- verifyGm(): latest by id, excluding Kwa / Ai / CAT packages
    SELECT DISTINCT ON (v.com_id) v.com_id, v.package, v.renwal, ${D("v.create_date")} AS gm_pay
    FROM legacy_archive.webxl_verify_gm v
    WHERE v.com_id IN (SELECT com_id FROM cp)
      AND v.package IS NOT NULL AND lower(rtrim(v.package)) NOT IN ('kwa', 'ai', 'cat')
    ORDER BY v.com_id, ${PK("v.id")} DESC
  ),
  gma AS (  -- gmCom(): BV date
    SELECT DISTINCT ON (g.com_id) g.com_id, ${D("g.create_data")} AS bv
    FROM legacy_archive.webxl_gmaccount g
    WHERE g.com_id IN (SELECT com_id FROM cp)
    ORDER BY g.com_id, ${PK("g.id")}
  ),
  gdoc AS ( -- gmDoc(): first doc's upload date (+ doc count)
    SELECT DISTINCT ON (d.com_id) d.com_id, ${D("d.upload")} AS upload,
           count(*) OVER (PARTITION BY d.com_id)::int AS n
    FROM legacy_archive.webxl_gm_doc d
    WHERE d.com_id IN (SELECT com_id FROM cp)
    ORDER BY d.com_id, ${PK("d.id")}
  ),
  inv AS (  -- invoice(): latest invoice_id
    SELECT DISTINCT ON (i.com_id) i.com_id, i.invoice_id, ${D("i.create_date")} AS inv_date
    FROM legacy_archive.webxl_invoice i
    WHERE i.com_id IN (SELECT com_id FROM cp)
    ORDER BY i.com_id, ${PK("i.invoice_id")} DESC
  ),
  item AS ( -- invoiceItem(): first item of that invoice
    SELECT DISTINCT ON (it.invoice_id) it.invoice_id, it.unit_price
    FROM legacy_archive.webxl_invoice_item it
    WHERE it.invoice_id IN (SELECT invoice_id FROM inv)
    ORDER BY it.invoice_id, ${PK("it.id")}
  ),
  pay AS (  -- payMent(): latest payment of that invoice
    SELECT DISTINCT ON (p.invoice_id) p.invoice_id, ${D("p.create_date")} AS pay_date, p.method
    FROM legacy_archive.webxl_payments p
    WHERE p.invoice_id IN (SELECT invoice_id FROM inv)
    ORDER BY p.invoice_id, ${PK("p.id")} DESC
  ),
  ps AS (   -- comProStatus(): Data date
    SELECT DISTINCT ON (s.pro_id) s.pro_id, ${D("s.pro_update")} AS data_date
    FROM legacy_archive.webxl_project_status s
    WHERE s.pro_id IN (SELECT pro_id FROM cp)
    ORDER BY s.pro_id, ${PK("s.id")}
  ),
  hod AS (  -- hodStatus()
    SELECT DISTINCT ON (h.com_id) h.com_id, ${D("h.update_date")} AS hod_date
    FROM legacy_archive.webxl_status_hod h
    WHERE h.com_id IN (SELECT com_id FROM cp)
    ORDER BY h.com_id, ${PK("h.id")}
  ),
  ta AS (   -- taskAssign()
    SELECT DISTINCT ON (a.pro_id) a.pro_id, ${D("a.assign_date")} AS assign_date,
           ${D("a.last_update")} AS last_update, a.stauts
    FROM legacy_archive.webxl_task_assign a
    WHERE a.pro_id IN (SELECT pro_id FROM cp)
    ORDER BY a.pro_id, ${PK("a.id")}
  ),
  qs AS (   -- qutationService(): name LIKE (case-insensitive in MySQL)
    SELECT DISTINCT ON (lower(q.name)) lower(q.name) AS lname,
           CASE WHEN q.min_day ~ '^\\s*-?\\d+\\s*$' THEN trim(q.min_day)::int END AS min_day
    FROM legacy_archive.webxl_quotation_services q
    ORDER BY lower(q.name), ${PK("q.id")}
  ),
  links AS ( -- webxl_task_links since the BV date (all links when there is no BV date)
    SELECT c.pro_key, count(*)::int AS n
    FROM cp c
    LEFT JOIN gma ON gma.com_id = c.com_id
    JOIN legacy_archive.webxl_task_links tl ON tl.pro_id = c.pro_id
    WHERE gma.bv IS NULL OR ${D("tl.create_at")} >= gma.bv
    GROUP BY c.pro_key
  ),
  base AS (
    SELECT c.*, co.com_id AS display_id, co.cname, ${D("co.create_date")} AS cust_date,
           u.name AS person,
           vg.package, vg.renwal, vg.gm_pay,
           gma.bv, gdoc.upload AS doc_date, coalesce(gdoc.n, 0) AS doc_count,
           inv.inv_date, item.unit_price, pay.pay_date, pay.method,
           ps.data_date, hod.hod_date,
           ta.assign_date, ta.last_update, ta.stauts,
           coalesce(links.n, 0) AS link_count,
           c.pdate + q.min_day AS deadline,
           (SELECT min_day FROM qs WHERE lname = 'alibaba product posting') AS app_min_day,
           coalesce((SELECT min_day FROM qs WHERE lname = 'listing page'), 0)
             + coalesce((SELECT min_day FROM qs WHERE lname = 'alibaba minisite'), 0) AS app_window,
           ${TODAY_PK} AS today
    FROM cp c
    LEFT JOIN legacy_archive.webxl_company co
           ON co._source_table = 'webxl_company' AND co._legacy_pk = c.com_id
    LEFT JOIN legacy_archive.webxl_user u
           ON u._source_table = 'webxl_user' AND u._legacy_pk = c.user_id
    LEFT JOIN vg ON vg.com_id = c.com_id
    LEFT JOIN gma ON gma.com_id = c.com_id
    LEFT JOIN gdoc ON gdoc.com_id = c.com_id
    LEFT JOIN inv ON inv.com_id = c.com_id
    LEFT JOIN item ON item.invoice_id = inv.invoice_id
    LEFT JOIN pay ON pay.invoice_id = inv.invoice_id
    LEFT JOIN ps ON ps.pro_id = c.pro_id
    LEFT JOIN hod ON hod.com_id = c.com_id
    LEFT JOIN ta ON ta.pro_id = c.pro_id
    LEFT JOIN qs q ON q.lname = lower(c.project)
    LEFT JOIN links ON links.pro_key = c.pro_key
  )
  SELECT
    b.pro_key,
    b.display_id,
    b.cname,
    b.package,
    CASE b.renwal WHEN '1' THEN 'New' WHEN '0' THEN 'Renewal' END AS status,
    b.person,
    ${OUT("b.cust_date")} AS cust_date,
    ${OUT("b.gm_pay")} AS gm_pay,
    b.doc_count,
    ${OUT("b.doc_date")} AS doc_date,
    ${OUT("b.bv")} AS bv,
    ${OUT("b.inv_date")} AS inv_date,
    ${OUT("b.pay_date")} AS pay_date,
    b.method,
    CASE WHEN b.project = 'Alibaba Product Posting'
         THEN b.project || ' / ' || coalesce(b.unit_price, '')
         ELSE b.project END AS project,
    ${OUT("b.pdate")} AS pdate,
    ${OUT("b.data_date")} AS data_date,
    ${OUT("b.hod_date")} AS hod_date,
    ${OUT("b.assign_date")} AS assign_date,
    ${OUT("b.last_update")} AS last_update,
    b.link_count,
    (b.renwal = '1' AND b.link_count < 15
      AND (b.bv IS NULL OR b.today >= b.bv + 12)) AS p15_penalty,
    ${OUT("b.deadline")} AS deadline,
    CASE
      WHEN b.project = 'Alibaba Product Posting' AND b.pdate IS NOT NULL
           AND b.today < b.pdate + b.app_window THEN coalesce(b.app_min_day, 0)
      WHEN b.stauts = 'End' AND b.deadline IS NOT NULL AND b.last_update IS NOT NULL
           AND b.deadline <= b.last_update THEN NULL
      WHEN b.deadline IS NOT NULL THEN b.deadline - b.today
      ELSE 0
    END AS remaining_days
  FROM base b
`;

let serviceMinDaysCache: Map<string, number> | null = null;
let serviceMinDaysCacheAt = 0;
const SERVICE_CACHE_TTL_MS = 5 * 60 * 1000;

/** name (lowercased) -> min_day, for the modern "days left" deadline calc. */
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

type RowWithoutNumber = Omit<ProjectReportRow, "rowNumber">;

async function fetchLegacyRows(proKeys: string[]): Promise<Map<string, RowWithoutNumber>> {
  const out = new Map<string, RowWithoutNumber>();
  if (proKeys.length === 0) return out;
  const result = await pool.query(LEGACY_DETAIL_SQL, [proKeys]);
  for (const r of result.rows as any[]) {
    out.set(r.pro_key, {
      id: `legacy-${r.pro_key}`,
      displayId: r.display_id ?? null,
      name: r.cname ?? null,
      package: r.package ?? null,
      status: r.status ?? null,
      person: r.person ?? null,
      customerCreateDate: r.cust_date ?? null,
      gmPayDate: r.gm_pay ?? null,
      gmDoc: Number(r.doc_count) || 0,
      gmDocDate: r.doc_date ?? null,
      bvDate: r.bv ?? null,
      invoiceDate: r.inv_date ?? null,
      receiptDate: r.pay_date ?? null,
      method: r.method ?? null,
      project: r.project ?? null,
      projectCreateDate: r.pdate ?? null,
      dataDate: r.data_date ?? null,
      hodDate: r.hod_date ?? null,
      // Old screen: "Dep" = task assign date, "Assign" = task last update,
      // "Finish" = deadline (project create + service min_day).
      depDate: r.assign_date ?? null,
      p15: Number(r.link_count) || 0,
      p15Penalty: Boolean(r.p15_penalty),
      assignDate: r.last_update ?? null,
      finish: r.deadline ?? null,
      remaining: r.remaining_days == null ? (r.last_update ?? 0) : Number(r.remaining_days),
    });
  }
  return out;
}

async function fetchModernRows(ids: string[]): Promise<Map<string, RowWithoutNumber>> {
  const out = new Map<string, RowWithoutNumber>();
  if (ids.length === 0) return out;

  const listSql = `
    WITH gm_match AS (
      SELECT DISTINCT ON (p.id)
        p.id AS project_id,
        g.package_type,
        g.entry_type,
        g.sales_person_name,
        g.gm_bv_date,
        g.created_at AS gm_pay_date, -- legacy "GM Pay" = GM entry creation (verify_gm.create_date)
        g.hod_approved_at
      FROM drm.projects p
      LEFT JOIN drm.product_posting_invoices ppi_g ON ppi_g.id = p.invoice_id
      LEFT JOIN drm.gm_entries g ON g.id::text = ppi_g.gm_id OR g.customer_id = p.customer_id
      WHERE p.id = ANY($1::uuid[])
      ORDER BY p.id, (g.id::text = ppi_g.gm_id) DESC NULLS LAST, g.created_at DESC NULLS LAST
    )
    SELECT
      p.id, p.name AS project_name, p.service_type, p.created_at AS project_created_at,
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
    LEFT JOIN drm.invoices inv ON inv.id = p.invoice_id::text
    LEFT JOIN drm.product_posting_workflows ppw ON ppw.project_id = p.id
    LEFT JOIN gm_match gm ON gm.project_id = p.id
    WHERE p.id = ANY($1::uuid[])
  `;

  const result = await pool.query(listSql, [ids]);
  const minDays = await getServiceMinDays();
  const today = new Date();

  for (const r of result.rows as any[]) {
    const projectName: string | null = r.service_type || r.project_name || null;
    const bvDate: Date | null = r.gm_bv_date ? new Date(r.gm_bv_date) : null;
    const projectCreatedAt: Date = new Date(r.project_created_at);

    // "15P": tasks since the BV date; red when < 15 exist 12+ days past BV for a New entry.
    const taskCount = Number(r.task_count) || 0;
    const penaltyDeadline = bvDate ? addDays(bvDate, 12) : null;
    const p15Penalty = Boolean(
      penaltyDeadline && taskCount < 15 && today >= penaltyDeadline && r.entry_type === "New",
    );

    const minDay = projectName ? minDays.get(projectName.trim().toLowerCase()) ?? null : null;
    let remaining = 0;
    let finishDate: Date | null = null;
    if (minDay != null) {
      finishDate = addDays(projectCreatedAt, minDay);
      remaining = daysBetween(today, finishDate);
    }

    out.set(String(r.id), {
      id: String(r.id),
      displayId: r.drm_id ?? null,
      name: r.company_name ?? null,
      package: r.package_type ?? null,
      status: r.entry_type ?? null,
      person: r.sales_person_name ?? null,
      customerCreateDate: r.customer_created_at ?? null,
      gmPayDate: r.gm_pay_date ?? null,
      gmDoc: Number(r.doc_count) || 0,
      gmDocDate: null,
      bvDate: r.gm_bv_date ?? null,
      invoiceDate: r.ppi_created_at ?? r.inv_created_at ?? null,
      receiptDate: null, // no populated modern source
      method: r.ppi_method ?? r.inv_method ?? null,
      project: projectName,
      projectCreateDate: r.project_created_at ?? null,
      dataDate: r.data_verified_at ?? null,
      hodDate: r.hod_approved_at ?? null,
      depDate: null, // no real modern equivalent
      p15: taskCount,
      p15Penalty,
      assignDate: r.assigned_at ?? null,
      finish: finishDate ? finishDate.toISOString() : null,
      remaining,
    });
  }
  return out;
}

/** Escape LIKE wildcards in user input. */
function likeEscape(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function listProjectReport(filters: ProjectReportFilters): Promise<{ rows: ProjectReportRow[]; total: number }> {
  const { companyName, startDate, endDate, search, page, limit } = filters;

  const pageResult = await pool.query<{ total: number; kind: "L" | "M" | null; key: string | null }>(PAGE_SQL, [
    startDate,
    endDate,
    companyName ? `%${likeEscape(companyName)}%` : null,
    search ? `%${likeEscape(search)}%` : null,
    limit,
    (page - 1) * limit,
  ]);

  const total = Number(pageResult.rows[0]?.total ?? 0);
  const keys = pageResult.rows.filter((r) => r.kind && r.key) as { kind: "L" | "M"; key: string }[];

  const [legacy, modern] = await Promise.all([
    fetchLegacyRows(keys.filter((k) => k.kind === "L").map((k) => k.key)),
    fetchModernRows(keys.filter((k) => k.kind === "M").map((k) => k.key)),
  ]);

  const rows: ProjectReportRow[] = [];
  keys.forEach((k, index) => {
    const row = (k.kind === "L" ? legacy : modern).get(k.key);
    if (row) rows.push({ rowNumber: (page - 1) * limit + index + 1, ...row });
  });

  return { rows, total };
}

/**
 * Company-name suggestions for the report's "Company Name" filter: distinct
 * names from drm.customers plus old companies that have a webxl_create_project
 * row, matching `q` (case-insensitive), prefix matches first.
 */
export async function suggestProjectReportCompanies(q: string, limit = 20): Promise<string[]> {
  const term = q.trim();
  if (!term) return [];
  const escaped = likeEscape(term);
  const result = await pool.query<{ name: string }>(
    `
    WITH names AS (
      SELECT trim(c.company_name) AS name
      FROM drm.customers c
      WHERE coalesce(c.is_deleted, false) = false AND c.company_name ILIKE $1
      UNION ALL
      SELECT trim(co.cname)
      FROM (SELECT DISTINCT com_id FROM legacy_archive.webxl_create_project
            WHERE _source_table = '${LEGACY_SOURCE}') cp
      JOIN legacy_archive.webxl_company co
        ON co._source_table = 'webxl_company' AND co._legacy_pk = cp.com_id
      WHERE co.cname ILIKE $1
    )
    SELECT min(name) AS name
    FROM names
    WHERE name <> ''
    GROUP BY lower(name)
    ORDER BY (lower(min(name)) LIKE lower($2)) DESC, min(length(name)), lower(name)
    LIMIT $3
    `,
    [`%${escaped}%`, `${escaped}%`, limit],
  );
  return result.rows.map((r) => r.name);
}
