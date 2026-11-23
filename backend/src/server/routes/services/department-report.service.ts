import { pool, db } from "../../db";
import { departmentTeamCommissions } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Real implementation of the legacy "Department Project" report
 * (dpreport.php + func.php's `user_project_view` handler). Replaces a route
 * that queried drm.gm_entries by u.department — plausible-looking but wrong:
 * gm_entries.status is a fixed enum (Pending/Approved/Rejected/Completed)
 * that can never hold the filter's real values ("Manager Complete", "Qa
 * Completed", ...), and live users.department only ever contains '' or
 * 'Sale', never the ~26 department names the old frontend dropdown offered.
 *
 * The real department dimension for this report is drm.projects.department_type
 * (confirmed live: PRODUCT_POSTING, DND, IT, SEO_SMM, DESIGN_DEVELOPMENT,
 * "SEO/SMM"), and project delivery phases are tracked in
 * product_posting_workflows.current_phase — shared across ALL department
 * types in the live data, not just Product Posting.
 *
 * Legacy's per-step completion timestamps (dep_finish/qa/verification JSON
 * blobs in webxl_dep_project_comm) have no modern equivalent; the closest
 * real columns (manager_completed_at / qa_reviewed_at / verification_reviewed_at)
 * exist but are never populated in live data (confirmed: 0/56 projects). Date
 * filtering for the completion modes falls back to the workflow row's
 * updated_at when the specific stamp is null — same "best available proxy"
 * approach already used in project-report.service.ts.
 *
 * Old-DRM data: every drm.projects row copied from webxl_create_project is
 * excluded from the modern query and reported instead by
 * listLegacyDepartmentProjectReport, a SQL port of the PHP handler over the
 * legacy_archive.webxl_* tables (verified row-for-row against a literal port
 * of the PHP loops).
 */

export interface DepartmentFilters {
  departments: { value: string; label: string }[];
  cities: string[];
}

const DEPARTMENT_LABELS: Record<string, string> = {
  PRODUCT_POSTING: "Product Posting",
  DND: "D&D",
  IT: "IT",
  SEO_SMM: "SEO/SMM",
  "SEO/SMM": "SEO/SMM",
  DESIGN_DEVELOPMENT: "Design & Development",
  SOFTWARE: "Software",
};

function humanizeDepartment(value: string): string {
  return DEPARTMENT_LABELS[value] ?? value.replace(/_/g, " ");
}

/**
 * Old-DRM department ids (legacy_archive.webxl_department.id, the `$dep`
 * passed to allPmsDepProjects($dep) -> webxl_quotation_services.dep_id) for
 * each modern drm.projects.department_type value. Departments with no modern
 * equivalent are addressed as `LEGACY_DEP_<id>`.
 */
const LEGACY_DEP_ID_BY_VALUE: Record<string, string> = {
  SALES: "2",
  SEO_SMM: "8",
  "SEO/SMM": "8",
  PRODUCT_POSTING: "9",
  DND: "10",
  DESIGN_DEVELOPMENT: "10",
  IT: "13",
  MEDIA: "24",
  SOFTWARE: "27",
};
const CANONICAL_VALUE_BY_LEGACY_DEP_ID: Record<string, string> = {
  "2": "SALES",
  "8": "SEO_SMM",
  "9": "PRODUCT_POSTING",
  "10": "DND",
  "13": "IT",
  "24": "MEDIA",
  "27": "SOFTWARE",
};
const LEGACY_DEP_PREFIX = "LEGACY_DEP_";

function legacyDepIdFor(value: string): string | null {
  if (LEGACY_DEP_ID_BY_VALUE[value]) return LEGACY_DEP_ID_BY_VALUE[value];
  if (value.startsWith(LEGACY_DEP_PREFIX)) {
    const id = value.slice(LEGACY_DEP_PREFIX.length);
    return /^\d+$/.test(id) ? id : null;
  }
  return null;
}

/** Every modern department_type value that means the same department as `value`. */
function modernDepartmentAliases(value: string): string[] {
  const depId = legacyDepIdFor(value);
  if (!depId) return [value];
  const aliases = Object.keys(LEGACY_DEP_ID_BY_VALUE).filter((k) => LEGACY_DEP_ID_BY_VALUE[k] === depId);
  return Array.from(new Set([value, ...aliases]));
}

export async function listDepartmentFilters(): Promise<DepartmentFilters> {
  // Same lists as the old DRM page: every webxl_department row (in id order) and the
  // city attribute list (webxl_attribute refId 10). Departments without old project
  // items simply return no rows, as in the old report.
  const legacyDeptRes = await pool.query<{ id: string; name: string }>(
    `SELECT d.id, btrim(d.name, E' \t\r\n') AS name
       FROM legacy_archive.webxl_department d
      ORDER BY d.id::int`,
  );
  const deptRes = await pool.query<{ department_type: string }>(
    `SELECT DISTINCT department_type FROM drm.projects WHERE department_type IS NOT NULL AND department_type <> '' ORDER BY 1`,
  );
  const cityRes = await pool.query<{ city: string }>(
    `SELECT DISTINCT ON (lower(btrim(name))) btrim(name) AS city
       FROM legacy_archive.webxl_attribute
      WHERE "refId" = '10' AND btrim(coalesce(name, '')) <> ''
      ORDER BY lower(btrim(name)), btrim(name)`,
  );

  const options = new Map<string, string>(); // value -> label (old order first)
  const coveredLegacyIds = new Set<string>();
  for (const d of legacyDeptRes.rows) {
    const value = CANONICAL_VALUE_BY_LEGACY_DEP_ID[d.id] ?? `${LEGACY_DEP_PREFIX}${d.id}`;
    options.set(value, d.name || humanizeDepartment(value));
    coveredLegacyIds.add(d.id);
  }
  for (const r of deptRes.rows) {
    const depId = legacyDepIdFor(r.department_type);
    // Aliases of an already-listed old department (e.g. DESIGN_DEVELOPMENT ~ DND)
    // are served by that option — the report matches all aliases.
    if (depId && coveredLegacyIds.has(depId)) continue;
    if (!options.has(r.department_type)) options.set(r.department_type, humanizeDepartment(r.department_type));
  }
  return {
    departments: Array.from(options, ([value, label]) => ({ value, label })),
    cities: cityRes.rows.map((r) => r.city),
  };
}

// Mirrors PRODUCT_POSTING_PHASE_KEYS (schema.ts) minus RETURNED_FOR_CHANGE,
// which isn't part of the forward sequence.
const PHASE_ORDER = [
  "PENDING_PROJECT",
  "DATA_VERIFY",
  "PROJECT_OVERVIEW",
  "TASK_ASSIGNMENT",
  "RUNNING_PROJECT",
  "MANAGER_COMPLETE",
  "QA_REVIEW",
  "QA_COMPLETE",
  "VERIFICATION_PENDING",
  "VERIFICATION_COMPLETE",
];

function phasesAtOrBeyond(phaseKey: string): string[] {
  const idx = PHASE_ORDER.indexOf(phaseKey);
  return idx === -1 ? [phaseKey] : PHASE_ORDER.slice(idx);
}

type ModeSpec =
  | { kind: "create" }
  | { kind: "phase"; match: "atLeast" | "exact"; phaseKey: string; timestampColumn: string; label: string };

// The 4 "completion" modes are the ones with a Verify Commission button in
// legacy — exported so route handlers can validate createDepartmentCommission
// is only called for one of these.
export const COMPLETION_STATUS_MODES = ["Manager Complete", "Qa Completed", "Verification Completed", "Verification Pending"];

const MODE_MAP: Record<string, ModeSpec> = {
  "Project Create": { kind: "create" },
  // Same "coalesce to updated_at" fallback as the completion modes below —
  // data_verified_at is never populated live either (0/56 projects), so
  // requiring it NOT NULL (as this used to) made this mode always empty.
  "Data Verify": { kind: "phase", match: "atLeast", phaseKey: "DATA_VERIFY", timestampColumn: "data_verified_at", label: "Data Verify" },
  "Manager Complete": { kind: "phase", match: "atLeast", phaseKey: "MANAGER_COMPLETE", timestampColumn: "manager_completed_at", label: "Manager Complete" },
  "Qa Completed": { kind: "phase", match: "atLeast", phaseKey: "QA_COMPLETE", timestampColumn: "qa_reviewed_at", label: "Qa Completed" },
  "Verification Completed": { kind: "phase", match: "exact", phaseKey: "VERIFICATION_COMPLETE", timestampColumn: "verification_reviewed_at", label: "Verification Completed" },
  // No dedicated "entered pending" stamp exists; qa_reviewed_at marks the
  // handoff into this state, so it's the closest honest proxy.
  "Verification Pending": { kind: "phase", match: "exact", phaseKey: "VERIFICATION_PENDING", timestampColumn: "qa_reviewed_at", label: "Verification Pending" },
};

/**
 * UI status option -> old func.php `$type_fillter` branch of the
 * `user_project_view` handler. For the 4 completion modes the old filter
 * value was the same string; the JSON column is the one the PHP helper reads:
 *   Manager Complete       -> CommisionProjectsMnagerCompleted -> dep_finish
 *   Qa Completed           -> CommisionProjectsQACompleted     -> qa
 *   Verification Completed -> allProjectsOverviewDepStatusVFYANDStatus -> verification
 *   Verification Pending   -> same helper/column as Verification Completed
 *     (the PHP also fetches the qa status into $VerfyStatus_Pending but never
 *     uses it, so the old output was identical to Verification Completed).
 */
type LegacyMode =
  | { kind: "create" }
  | { kind: "verify" }
  | { kind: "completion"; column: "dep_finish" | "qa" | "verification" };

const LEGACY_MODE_MAP: Record<string, LegacyMode> = {
  "Project Create": { kind: "create" },
  "Data Verify": { kind: "verify" },
  "Manager Complete": { kind: "completion", column: "dep_finish" },
  "Qa Completed": { kind: "completion", column: "qa" },
  "Verification Completed": { kind: "completion", column: "verification" },
  "Verification Pending": { kind: "completion", column: "verification" },
};

export interface DepartmentReportRow {
  id: string;
  companyId: string | null;
  company_name: string | null;
  package_type: string | null;
  status: string | null;
  entry_type: string | null;
  project: string | null;
  amount_usd: string | null;
  amount_pkr: string | null;
  payment_status: string | null;
  created_at: string | null;
  approved_at: string | null;
  department: string | null;
}

export interface DepartmentReportParams {
  departmentType: string;
  city: string;
  status: string;
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
}

// gm_match is computed only for the projects that pass the report's filters
// (`scoped`, materialized first) — the OR join against gm_entries is far too
// slow when the planner runs it over every project before filtering.
function gmMatchCte(scopeJoins: string, whereSql: string): string {
  return `
  WITH scoped AS MATERIALIZED (
    SELECT DISTINCT p.id
    FROM drm.projects p
    ${scopeJoins}
    ${whereSql}
  ),
  gm_match AS (
    SELECT DISTINCT ON (p.id)
      p.id AS project_id,
      g.package_type,
      g.entry_type,
      g.amount_usd,
      g.amount_pkr
    FROM scoped s
    JOIN drm.projects p ON p.id = s.id
    LEFT JOIN drm.product_posting_invoices ppi_g ON ppi_g.id = p.invoice_id
    LEFT JOIN drm.gm_entries g ON g.id::text = ppi_g.gm_id OR g.customer_id = p.customer_id
    ORDER BY p.id, (g.id::text = ppi_g.gm_id) DESC NULLS LAST, g.created_at DESC NULLS LAST
  )
`;
}

// ---------------------------------------------------------------------------
// Legacy (old DRM) rows — SQL port of func.php's `user_project_view` handler
// over the legacy_archive.webxl_* copies (all columns TEXT).
// ---------------------------------------------------------------------------

// allPmsDepProjects($dep): the item names belonging to the department.
const LEGACY_DEP_NAMES_CTE = `
  dep_names AS (
    SELECT DISTINCT name FROM legacy_archive.webxl_quotation_services WHERE dep_id = $1
  )`;

// verifyGm($com_id): latest webxl_verify_gm row excluding Kwa/Ai/CAT packages
// (MySQL compare is case-insensitive and ignores trailing spaces; NULL
// package fails `!=` and is excluded as well).
const LEGACY_GM_CTE = `
  gm AS (
    SELECT DISTINCT ON (com_id) com_id, package, renwal
      FROM legacy_archive.webxl_verify_gm
     WHERE package IS NOT NULL AND lower(rtrim(package)) NOT IN ('kwa', 'ai', 'cat')
     ORDER BY com_id, id::bigint DESC
  )`;

// PHP (7.x loose ==) label: 1=New, 0/''/NULL/no verify_gm row = Rc, 2=Ec.
// Any other value (3/4/5) set nothing, so the previous row's label carried
// over — NULL here, resolved with a window in the final SELECT.
const legacyRenwalExpr = (g: string) => `
  CASE
    WHEN ${g}.com_id IS NULL OR ${g}.renwal IS NULL OR btrim(${g}.renwal) IN ('', '0') THEN 'Rc'
    WHEN btrim(${g}.renwal) = '1' THEN 'New'
    WHEN btrim(${g}.renwal) = '2' THEN 'Ec'
    ELSE NULL
  END`;

function legacyBaseSql(mode: LegacyMode): string {
  if (mode.kind === "create") {
    // One row per webxl_payments row dated in range (ORDER BY id DESC) whose
    // company has >=1 project of this department created in range. City is
    // NOT filtered in this branch of the PHP. The Project cell for dep 13
    // is the list of matching projects; for every other dep the PHP printed
    // $project = the last project iterated for that company (pro_id order),
    // whether or not it belongs to the department.
    return `
      ${LEGACY_DEP_NAMES_CTE},
      ${LEGACY_GM_CTE},
      pay AS (
        SELECT id::bigint AS pid, com_id, amount, method, create_date
          FROM legacy_archive.webxl_payments
         WHERE left(create_date, 10) BETWEEN $2 AND $3
      ),
      proj AS (
        SELECT cp.com_id, cp.pro_id::bigint AS pro_id, cp.project,
               EXISTS (SELECT 1 FROM dep_names d WHERE d.name = cp.project) AS in_dep
          FROM legacy_archive.webxl_create_project cp
         WHERE left(cp.create_data, 10) BETWEEN $2 AND $3
           AND cp.com_id IN (SELECT com_id FROM pay)
      ),
      pa AS (
        SELECT com_id,
               string_agg(project, ', ' ORDER BY pro_id) FILTER (WHERE in_dep) AS dep_list,
               (array_agg(project ORDER BY pro_id DESC))[1] AS last_project
          FROM proj GROUP BY com_id HAVING bool_or(in_dep)
      ),
      base AS (
        SELECT row_number() OVER (ORDER BY pay.pid DESC) AS ord,
               'legacy-create-' || pay.pid AS row_key,
               pay.com_id, pay.amount, pay.method, pay.create_date AS event_at,
               CASE WHEN $1 = '13' THEN pa.dep_list ELSE pa.last_project END AS project,
               g.package,
               ${legacyRenwalExpr("g")} AS label_raw
          FROM pay
          JOIN pa ON pa.com_id = pay.com_id
          LEFT JOIN gm g ON g.com_id = pay.com_id
      )`;
  }
  if (mode.kind === "verify") {
    // webxl_project_status rows with mag_verify=1 and vfy_date in range
    // (ORDER BY id DESC), whose webxl_create_project (same pro_id+com_id)
    // item belongs to the department. Amount/method = the company's latest
    // payment. City is NOT filtered in this branch of the PHP. For dep 13 the
    // PHP took package/renwal via the payment's com_id and showed the payment
    // date instead of vfy_date.
    return `
      ${LEGACY_DEP_NAMES_CTE},
      ${LEGACY_GM_CTE},
      ps AS (
        SELECT id::bigint AS psid, com_id, pro_id, vfy_date
          FROM legacy_archive.webxl_project_status
         WHERE btrim(mag_verify) = '1' AND left(vfy_date, 10) BETWEEN $2 AND $3
      ),
      pay_last AS (
        SELECT DISTINCT ON (com_id) com_id, amount, method, create_date
          FROM legacy_archive.webxl_payments
         ORDER BY com_id, id::bigint DESC
      ),
      base AS (
        SELECT row_number() OVER (ORDER BY ps.psid DESC) AS ord,
               'legacy-verify-' || ps.psid AS row_key,
               ps.com_id, pl.amount, pl.method,
               CASE WHEN $1 = '13' THEN pl.create_date ELSE ps.vfy_date END AS event_at,
               cp.project,
               g.package,
               ${legacyRenwalExpr("g")} AS label_raw
          FROM ps
          JOIN legacy_archive.webxl_create_project cp
            ON cp._source_table = 'webxl_create_project' AND cp._legacy_pk = ps.pro_id AND cp.com_id = ps.com_id
          JOIN dep_names d ON d.name = cp.project
          LEFT JOIN pay_last pl ON pl.com_id = ps.com_id
          LEFT JOIN gm g ON g.com_id = CASE WHEN $1 = '13' THEN pl.com_id ELSE ps.com_id END
      )`;
  }
  // Completion modes: every pro_id listed in webxl_dep_project_comm.verification
  // (rows ORDER BY id DESC, city = acc_holder_city), looked up (first match)
  // in the mode's JSON column; kept when that entry is Complete with date in
  // range and the project (comPro) belongs to the department. Amount/method =
  // the company's first payment (PHP ran an un-ordered SELECT ... LIMIT 1).
  const col = mode.column;
  return `
    ${LEGACY_DEP_NAMES_CTE},
    ${LEGACY_GM_CTE},
    dpc AS (
      SELECT id::bigint AS dpcid, com_id, verification::jsonb AS ver,
             CASE WHEN pg_input_is_valid(${col}, 'jsonb') THEN ${col}::jsonb END AS mc
        FROM legacy_archive.webxl_dep_project_comm
       WHERE pg_input_is_valid(verification, 'jsonb')
         AND ($4::text IS NULL OR lower(rtrim(acc_holder_city)) = lower(rtrim($4::text)))
    ),
    el AS (
      SELECT dpc.dpcid, dpc.com_id, dpc.mc, e.v ->> 'pro_id' AS pro_id, e.n
        FROM dpc
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(dpc.ver) = 'array' THEN dpc.ver ELSE '[]'::jsonb END)
             WITH ORDINALITY AS e(v, n)
       WHERE jsonb_typeof(e.v) = 'object' AND e.v ->> 'pro_id' IS NOT NULL
    ),
    st AS (
      SELECT el.dpcid, el.com_id, el.pro_id, el.n, s.dt
        FROM el
        CROSS JOIN LATERAL (
          SELECT m.v ->> 'dep_finish_status' AS status, m.v ->> 'date' AS dt
            FROM jsonb_array_elements(CASE WHEN jsonb_typeof(el.mc) = 'array' THEN el.mc ELSE '[]'::jsonb END)
                 WITH ORDINALITY AS m(v, n)
           WHERE jsonb_typeof(m.v) = 'object' AND m.v ->> 'pro_id' = el.pro_id
           ORDER BY m.n LIMIT 1
        ) s
       WHERE s.status = 'Complete' AND s.dt >= $2 AND s.dt <= $3
    ),
    pay_first AS (
      SELECT DISTINCT ON (com_id) com_id, amount, method
        FROM legacy_archive.webxl_payments
       ORDER BY com_id, id::bigint ASC
    ),
    base AS (
      SELECT row_number() OVER (ORDER BY st.dpcid DESC, st.n) AS ord,
             'legacy-${col}-' || st.dpcid || '-' || st.n AS row_key,
             st.com_id, pf.amount, pf.method, st.dt AS event_at,
             cp.project,
             g.package,
             'Complete'::text AS label_raw
        FROM st
        JOIN legacy_archive.webxl_create_project cp
          ON cp._source_table = 'webxl_create_project' AND cp._legacy_pk = st.pro_id
        JOIN dep_names d ON d.name = cp.project
        LEFT JOIN pay_first pf ON pf.com_id = st.com_id
        LEFT JOIN gm g ON g.com_id = st.com_id
    )`;
}

/** Old text timestamps are Pakistan local time; date-only values stay as-is. */
function legacyTimestamp(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.startsWith("0000")) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/.exec(v);
  return m ? `${m[1]}T${m[2].length === 5 ? `${m[2]}:00` : m[2]}+05:00` : null;
}

/**
 * Old-DRM rows for the Department Report, reproducing func.php's
 * `user_project_view` output (all matching rows, in the PHP's order).
 */
export async function listLegacyDepartmentProjectReport(params: {
  departmentType: string;
  city: string;
  status: string;
  startDate: string;
  endDate: string;
}): Promise<{ rows: DepartmentReportRow[]; amountTotal: number }> {
  const mode = LEGACY_MODE_MAP[params.status];
  const depId = legacyDepIdFor(params.departmentType);
  if (!mode || !depId) return { rows: [], amountTotal: 0 };

  const city = params.city && params.city !== "All" ? params.city : null;
  const sql = `
    WITH ${legacyBaseSql(mode)},
    grouped AS (
      SELECT b.*, count(b.label_raw) OVER (ORDER BY b.ord) AS label_grp FROM base b
    )
    SELECT b.ord, b.row_key, b.com_id, c.cname, b.package, b.project, b.amount, b.method, b.event_at,
           COALESCE(max(b.label_raw) OVER (PARTITION BY b.label_grp), '') AS label,
           m.modern_id AS customer_id,
           CASE WHEN btrim(b.amount) ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN btrim(b.amount)::numeric ELSE 0 END AS amount_num
      FROM grouped b
      LEFT JOIN legacy_archive.webxl_company c
        ON c._source_table = 'webxl_company' AND c._legacy_pk = b.com_id
      LEFT JOIN migration_meta.migration_legacy_ids m
        ON m.entity_type = 'customer' AND m.legacy_table = 'webxl_company' AND m.legacy_id = b.com_id
     ORDER BY b.ord
  `;
  // $4 (city) is only referenced by the completion branch.
  const queryParams: any[] = [depId, params.startDate, params.endDate];
  if (mode.kind === "completion") queryParams.push(city);
  const res = await pool.query(sql, queryParams);

  let amountTotal = 0;
  const rows: DepartmentReportRow[] = res.rows.map((r: any) => {
    amountTotal += Number(r.amount_num) || 0;
    const ts = legacyTimestamp(r.event_at);
    return {
      id: r.row_key,
      companyId: r.customer_id ?? (r.com_id ? `legacy-company:${r.com_id}` : null),
      company_name: r.cname ?? null,
      package_type: r.package ?? null,
      status: r.label || null,
      entry_type: mode.kind === "completion" ? null : r.label || null,
      project: r.project ?? null,
      amount_usd: null,
      amount_pkr: r.amount ?? null,
      payment_status: r.method ?? null,
      created_at: ts,
      approved_at: ts,
      department: params.departmentType,
    };
  });
  return { rows, amountTotal };
}

export async function listDepartmentProjectReport(
  params: DepartmentReportParams,
): Promise<{ rows: DepartmentReportRow[]; total: number; amountTotal: string; companyCount: number }> {
  const mode = MODE_MAP[params.status];
  if (!mode) {
    const err: any = new Error(`Unknown status filter: ${params.status}`);
    err.statusCode = 400;
    throw err;
  }

  // Projects copied from the old DRM (webxl_create_project) are reported by
  // listLegacyDepartmentProjectReport from the original tables, so the modern
  // query skips them to avoid double counting.
  const where: string[] = [
    "p.is_deleted IS NOT TRUE",
    "p.department_type = ANY($1::text[])",
    `NOT EXISTS (
      SELECT 1 FROM migration_meta.migration_legacy_ids mli
       WHERE mli.modern_table = 'projects' AND mli.modern_id = p.id::text AND mli.legacy_table = 'webxl_create_project'
    )`,
  ];
  const queryParams: any[] = [modernDepartmentAliases(params.departmentType)];
  const add = (v: any) => {
    queryParams.push(v);
    return `$${queryParams.length}`;
  };

  if (params.city && params.city !== "All") {
    where.push(`lower(btrim(c.city)) = lower(btrim(${add(params.city)}))`);
  }

  let dateColumn: string;
  let approvedAtExpr: string;
  let statusExpr: string;
  let scopeJoins = `LEFT JOIN drm.customers c ON c.id = p.customer_id\n`;
  let joinClause = `
    LEFT JOIN drm.customers c ON c.id = p.customer_id
    LEFT JOIN gm_match gm ON gm.project_id = p.id
    LEFT JOIN drm.product_posting_invoices ppi ON ppi.id = p.invoice_id
    LEFT JOIN drm.invoices inv ON inv.id = p.invoice_id::text
  `;

  if (mode.kind === "create") {
    dateColumn = "p.created_at";
    approvedAtExpr = "p.created_at";
    statusExpr = "gm.entry_type";
  } else {
    joinClause += `LEFT JOIN drm.product_posting_workflows w ON w.project_id = p.id\n`;
    scopeJoins += `LEFT JOIN drm.product_posting_workflows w ON w.project_id = p.id\n`;
    const qualifyingPhases = mode.match === "atLeast" ? phasesAtOrBeyond(mode.phaseKey) : [mode.phaseKey];
    where.push(`w.current_phase = ANY(${add(qualifyingPhases)}::text[])`);
    const tsExpr = `COALESCE(w.${mode.timestampColumn}, w.updated_at)`;
    dateColumn = tsExpr;
    approvedAtExpr = tsExpr;
    // Legacy's own template for this branch always shows the literal
    // "Complete" in the Status cell for every completion mode.
    statusExpr = `'Complete'`;
  }

  where.push(`${dateColumn} >= ${add(params.startDate)}::date`);
  where.push(`${dateColumn} < (${add(params.endDate)}::date + interval '1 day')`);

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const countSql = `
    ${gmMatchCte(scopeJoins, whereSql)}
    SELECT count(*)::int AS total,
           COALESCE(SUM(coalesce(gm.amount_pkr, gm.amount_usd, 0)), 0) AS amount_total,
           array_remove(array_agg(DISTINCT p.customer_id::text), NULL) AS company_ids
    FROM drm.projects p
    ${joinClause}
    ${whereSql}
  `;
  const [countRes, legacy] = await Promise.all([
    pool.query(countSql, queryParams),
    listLegacyDepartmentProjectReport(params),
  ]);
  const modernTotal: number = countRes.rows[0]?.total ?? 0;
  const modernAmount = Number(countRes.rows[0]?.amount_total ?? 0) || 0;
  const companyIds = new Set<string>(countRes.rows[0]?.company_ids ?? []);
  for (const r of legacy.rows) if (r.companyId) companyIds.add(r.companyId);

  // Combined ordering: modern (post-cutover, newest) rows first, then the
  // old-DRM rows in the PHP's order. Paginate across the concatenation.
  const offset = (params.page - 1) * params.pageSize;
  let modernRows: DepartmentReportRow[] = [];
  if (offset < modernTotal) {
    const limitParam = add(params.pageSize);
    const offsetParam = add(offset);
    const listSql = `
      ${gmMatchCte(scopeJoins, whereSql)}
      SELECT
        p.id, p.customer_id, c.company_name,
        gm.package_type, gm.entry_type, gm.amount_usd, gm.amount_pkr,
        coalesce(p.service_type, p.name) AS project_name,
        coalesce(ppi.payment_method, inv.payment_method) AS method,
        ${statusExpr} AS status_value,
        ${approvedAtExpr} AS approved_at,
        p.created_at,
        p.department_type
      FROM drm.projects p
      ${joinClause}
      ${whereSql}
      ORDER BY ${dateColumn} DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;
    const result = await pool.query(listSql, queryParams);
    modernRows = result.rows.map((r: any) => ({
      id: r.id,
      companyId: r.customer_id ?? null,
      company_name: r.company_name ?? null,
      package_type: r.package_type ?? null,
      status: r.status_value ?? null,
      entry_type: r.entry_type ?? null,
      project: r.project_name ?? null,
      amount_usd: r.amount_usd ?? null,
      amount_pkr: r.amount_pkr ?? null,
      payment_status: r.method ?? null,
      created_at: r.created_at ?? null,
      approved_at: r.approved_at ?? null,
      department: r.department_type ?? null,
    }));
  }
  const legacyStart = Math.max(0, offset - modernTotal);
  const legacyRows = legacy.rows.slice(legacyStart, legacyStart + (params.pageSize - modernRows.length));

  return {
    rows: [...modernRows, ...legacyRows],
    total: modernTotal + legacy.rows.length,
    amountTotal: String(modernAmount + legacy.amountTotal),
    companyCount: companyIds.size,
  };
}

export async function getDepartmentCommission(departmentType: string, month: number, year: number) {
  const [row] = await db
    .select()
    .from(departmentTeamCommissions)
    .where(
      and(
        eq(departmentTeamCommissions.departmentType, departmentType),
        eq(departmentTeamCommissions.commMonth, month),
        eq(departmentTeamCommissions.commYear, year),
      ),
    );
  return row ?? null;
}

const PER_COMPANY_RATE = 500;
const MANAGER_RATE = 300;
const ASSISTANT_RATE = 200;

export async function createDepartmentCommission(params: {
  departmentType: string;
  status: string;
  startDate: string;
  endDate: string;
  createdByUserId: string;
}) {
  if (!COMPLETION_STATUS_MODES.includes(params.status)) {
    const err: any = new Error("Commission can only be verified for a completion status filter.");
    err.statusCode = 400;
    throw err;
  }

  const month = new Date(`${params.startDate}T00:00:00.000Z`).getUTCMonth() + 1;
  const year = new Date(`${params.startDate}T00:00:00.000Z`).getUTCFullYear();

  const existing = await getDepartmentCommission(params.departmentType, month, year);
  if (existing) {
    const err: any = new Error("Commission already created for this department and period.");
    err.statusCode = 400;
    throw err;
  }

  // companyCount is computed over the full (unpaginated) result set,
  // modern + old-DRM rows (legacy: count(array_unique($companyIdsArray))).
  const { companyCount } = await listDepartmentProjectReport({
    departmentType: params.departmentType,
    city: "All",
    status: params.status,
    startDate: params.startDate,
    endDate: params.endDate,
    page: 1,
    pageSize: 1,
  });
  const totalAmount = companyCount * PER_COMPANY_RATE;
  const managerAmount = companyCount * MANAGER_RATE;
  const assistantAmount = companyCount * ASSISTANT_RATE;

  const [created] = await db
    .insert(departmentTeamCommissions)
    .values({
      departmentType: params.departmentType,
      commMonth: month,
      commYear: year,
      companyCount,
      perCompanyRate: String(PER_COMPANY_RATE),
      totalAmount: String(totalAmount),
      managerAmount: String(managerAmount),
      assistantAmount: String(assistantAmount),
      finalPayAmount: String(totalAmount),
      createdByUserId: params.createdByUserId,
    })
    .returning();
  return created;
}
