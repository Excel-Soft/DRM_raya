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

export async function listDepartmentFilters(): Promise<DepartmentFilters> {
  const deptRes = await pool.query<{ department_type: string }>(
    `SELECT DISTINCT department_type FROM drm.projects WHERE department_type IS NOT NULL AND department_type <> '' ORDER BY 1`,
  );
  const cityRes = await pool.query<{ city: string }>(
    `SELECT DISTINCT city FROM drm.customers WHERE city IS NOT NULL AND city <> '' ORDER BY 1`,
  );
  return {
    departments: deptRes.rows.map((r) => ({ value: r.department_type, label: humanizeDepartment(r.department_type) })),
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

const GM_MATCH_CTE = `
  WITH gm_match AS (
    SELECT DISTINCT ON (p.id)
      p.id AS project_id,
      g.package_type,
      g.entry_type,
      g.amount_usd,
      g.amount_pkr
    FROM drm.projects p
    LEFT JOIN drm.product_posting_invoices ppi_g ON ppi_g.id = p.invoice_id
    LEFT JOIN drm.gm_entries g ON g.id::text = ppi_g.gm_id OR g.customer_id = p.customer_id
    ORDER BY p.id, (g.id::text = ppi_g.gm_id) DESC NULLS LAST, g.created_at DESC NULLS LAST
  )
`;

export async function listDepartmentProjectReport(
  params: DepartmentReportParams,
): Promise<{ rows: DepartmentReportRow[]; total: number; amountTotal: string }> {
  const mode = MODE_MAP[params.status];
  if (!mode) {
    const err: any = new Error(`Unknown status filter: ${params.status}`);
    err.statusCode = 400;
    throw err;
  }

  const where: string[] = ["p.is_deleted IS NOT TRUE", "p.department_type = $1"];
  const queryParams: any[] = [params.departmentType];
  const add = (v: any) => {
    queryParams.push(v);
    return `$${queryParams.length}`;
  };

  if (params.city && params.city !== "All") {
    where.push(`c.city = ${add(params.city)}`);
  }

  let dateColumn: string;
  let approvedAtExpr: string;
  let statusExpr: string;
  let joinClause = `
    LEFT JOIN drm.customers c ON c.id = p.customer_id
    LEFT JOIN gm_match gm ON gm.project_id = p.id
    LEFT JOIN drm.product_posting_invoices ppi ON ppi.id = p.invoice_id
    LEFT JOIN drm.invoices inv ON inv.id = p.invoice_id
  `;

  if (mode.kind === "create") {
    dateColumn = "p.created_at";
    approvedAtExpr = "p.created_at";
    statusExpr = "gm.entry_type";
  } else {
    joinClause += `LEFT JOIN drm.product_posting_workflows w ON w.project_id = p.id\n`;
    const qualifyingPhases = mode.match === "atLeast" ? phasesAtOrBeyond(mode.phaseKey) : [mode.phaseKey];
    where.push(`w.current_phase = ANY(${add(qualifyingPhases)}::text[])`);
    const tsExpr = `COALESCE(w.${mode.timestampColumn}, w.updated_at)`;
    dateColumn = tsExpr;
    approvedAtExpr = tsExpr;
    // Legacy's own template for this branch (func.php ~line 21005-21013)
    // always shows the literal "Complete" in the Status cell for every mode
    // here — a row only ever reaches the output once its gate's helper
    // function has returned Complete, so the label is constant, not
    // per-mode. Inlined (not a bound param) since it's a fixed string that
    // never appears in the COUNT query's WHERE clause — see the pg 42P18
    // note this used to trip before `mode.label` was handled the same way.
    statusExpr = `'Complete'`;
  }

  where.push(`${dateColumn} >= ${add(params.startDate)}::date`);
  where.push(`${dateColumn} < (${add(params.endDate)}::date + interval '1 day')`);

  const whereSql = `WHERE ${where.join(" AND ")}`;

  // Legacy's "create" mode (func.php ~line 20836-20845) appends an Amount-sum
  // total row after the full (unpaginated) result set — no equivalent exists
  // for the other modes. Computed over ALL matching rows here (not just the
  // current page), same scope as `total`. Mixing amount_pkr/amount_usd in one
  // sum is a simplification: legacy only ever had a single `amount` column.
  const countSql = `
    ${GM_MATCH_CTE}
    SELECT count(*)::int AS total, COALESCE(SUM(coalesce(gm.amount_pkr, gm.amount_usd, 0)), 0) AS amount_total
    FROM drm.projects p
    ${joinClause}
    ${whereSql}
  `;
  const countRes = await pool.query(countSql, queryParams);
  const total = countRes.rows[0]?.total ?? 0;
  const amountTotal = String(countRes.rows[0]?.amount_total ?? "0");

  const limitParam = add(params.pageSize);
  const offsetParam = add((params.page - 1) * params.pageSize);

  const listSql = `
    ${GM_MATCH_CTE}
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

  const rows: DepartmentReportRow[] = result.rows.map((r: any) => ({
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

  return { rows, total, amountTotal };
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

  const { rows } = await listDepartmentProjectReport({
    departmentType: params.departmentType,
    city: "All",
    status: params.status,
    startDate: params.startDate,
    endDate: params.endDate,
    page: 1,
    pageSize: 10000,
  });
  const companyCount = new Set(rows.map((r) => r.companyId).filter(Boolean)).size;
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
