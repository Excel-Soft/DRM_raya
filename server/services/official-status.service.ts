import { pool } from "../db";
import {
  GM_WORKFLOW_STAGES,
  type GmWorkflowStage,
} from "../../shared/gm-sales-constants";

/**
 * OfficialStatusService (Patch 5 Stage 6, P14).
 *
 * The single source of truth for "what is this entity's current status" so the
 * dashboard, the detail screen, a report and the central workflow service can
 * never disagree. Every helper reads the CANONICAL backend column(s) only —
 * never a frontend-derived label — and the GM helper folds the GM record's many
 * status fields into one logical stage.
 *
 * These are pure reads: they never mutate and never throw on a missing row
 * (they return null) so they are safe to call from any read path.
 */

export interface GmStatusInputRow {
  status?: string | null;
  is_loan?: number | null;
  isLoan?: number | null;
  is_partial_payment?: number | null;
  isPartialPayment?: number | null;
  withdrawal_status?: string | null;
  withdrawalStatus?: string | null;
  super_hod_status?: string | null;
  superHodStatus?: string | null;
}

export interface GmLoanTermsRow {
  admin_approval_status?: string | null;
  adminApprovalStatus?: string | null;
  return_status?: string | null;
  returnStatus?: string | null;
}

function n(value: unknown): number {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

function pick<T>(...vals: (T | null | undefined)[]): T | null {
  for (const v of vals) {
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

/**
 * Fold a GM record (+ optional loan terms) into one logical workflow stage.
 *
 * GM has no single status column; it carries a coarse DB enum
 * (`Pending`/`Approved`/`Rejected`/`Completed`) plus loan / partial-payment /
 * withdrawal side-flags. This derivation is intentionally BEST-EFFORT and
 * read-only — it never changes how GM approval is stored. It exists so reads
 * (dashboards, reports, the central service's validation) agree on one stage.
 */
export function deriveOfficialGmStatus(
  gm: GmStatusInputRow,
  loanTerms?: GmLoanTermsRow | null,
): GmWorkflowStage {
  const dbStatus = (gm.status ?? "").toString();
  const isLoan = n(pick(gm.is_loan, gm.isLoan)) === 1;
  const isPartial = n(pick(gm.is_partial_payment, gm.isPartialPayment)) === 1;

  // Terminal DB states win outright.
  if (dbStatus === "Rejected") return GM_WORKFLOW_STAGES.REJECTED;
  if (dbStatus === "Completed") return GM_WORKFLOW_STAGES.PROJECT_CREATED;
  if (dbStatus === "Approved") return GM_WORKFLOW_STAGES.APPROVED;

  // Still Pending (or unknown): refine using the side-flags.
  const loanAdmin = (
    pick(loanTerms?.admin_approval_status, loanTerms?.adminApprovalStatus) ?? ""
  ).toString();
  const loanReturn = (
    pick(loanTerms?.return_status, loanTerms?.returnStatus) ?? ""
  ).toString();

  if (isLoan) {
    if (loanAdmin === "" || loanAdmin === "PENDING") {
      return GM_WORKFLOW_STAGES.PENDING_ADMIN;
    }
    if (loanReturn === "PENDING") {
      return GM_WORKFLOW_STAGES.LOAN_RETURN_PENDING;
    }
  }

  if (isPartial) {
    return GM_WORKFLOW_STAGES.PARTIAL_PAYMENT_PENDING;
  }

  return GM_WORKFLOW_STAGES.PENDING_ACCOUNTS;
}

/** Official GM stage by id (reads gm_entries + gm_loan_terms). null if absent. */
export async function getOfficialGmStatus(
  gmId: string,
): Promise<GmWorkflowStage | null> {
  const { rows } = await pool.query(
    `select status, is_loan, is_partial_payment, withdrawal_status, super_hod_status
       from drm.gm_entries where id = $1 limit 1`,
    [gmId],
  );
  if (!rows[0]) return null;
  const { rows: loanRows } = await pool.query(
    `select admin_approval_status, return_status
       from drm.gm_loan_terms where gm_id = $1 limit 1`,
    [gmId],
  );
  return deriveOfficialGmStatus(rows[0], loanRows[0] ?? null);
}

/** Official invoice status by id (product_posting_invoices.status). */
export async function getOfficialInvoiceStatus(
  invoiceId: string,
): Promise<string | null> {
  const { rows } = await pool.query(
    `select status from drm.product_posting_invoices where id = $1 limit 1`,
    [invoiceId],
  );
  return rows[0]?.status ?? null;
}

/** Official project status by id (projects.status). */
export async function getOfficialProjectStatus(
  projectId: string,
): Promise<string | null> {
  const { rows } = await pool.query(
    `select status from drm.projects where id = $1 limit 1`,
    [projectId],
  );
  return rows[0]?.status ?? null;
}

/**
 * Official workflow status for a project's product-posting / software workflow.
 * Prefers the workflow's `current_phase`; falls back to the project status when
 * no workflow row exists yet. null if neither is present.
 */
export async function getOfficialWorkflowStatus(
  projectId: string,
): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `select current_phase from drm.product_posting_workflows where project_id = $1 limit 1`,
      [projectId],
    );
    if (rows[0]?.current_phase) return rows[0].current_phase;
  } catch {
    // Workflow table may not exist in every environment; fall through.
  }
  return getOfficialProjectStatus(projectId);
}
