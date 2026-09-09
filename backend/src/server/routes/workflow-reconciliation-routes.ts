/**
 * Patch 6 Stage 4 — cross-department workflow reconciliation report (read-only).
 *
 *   GET /api/workflow/reconciliation   (admin / super_hod / super_admin)
 *
 * A broad, honest mismatch report across the GM → invoice → project → workflow →
 * QA → verification chain. It complements the existing financial reconciliation
 * (`GET /api/reports/gm-bv-reconciliation`) by surfacing *workflow* drift rather
 * than money drift.
 *
 * Design notes:
 *   - 100% read-only. No writes, no status changes, no fabricated rows: every
 *     check returns the real offending rows or nothing.
 *   - Each check runs in its own try/catch. A single failing check is reported
 *     under `checkErrors` and never 500s the whole report.
 *   - Raw SQL is used (matching the financial reconciliation endpoint). The
 *     gm_entries.id column is varchar while projects/invoices/dependencies carry
 *     gm_id as text, so those joins use ::text casts to avoid type errors.
 *   - The "verification pending too long" threshold is env-configurable via
 *     WORKFLOW_VERIFICATION_PENDING_MAX_DAYS (default 3 days).
 */
import { Router, type Request, type Response } from "express";
import { pool } from "../db";
import { ROLES, normalizeRole } from "../utils/role-utils";

export const workflowReconciliationRouter = Router();

const VERIFICATION_PENDING_MAX_DAYS = (() => {
  const raw = process.env.WORKFLOW_VERIFICATION_PENDING_MAX_DAYS;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 3;
})();

/** Admin / super-HOD / super-admin may view the reconciliation report. */
function canViewReconciliation(req: Request): boolean {
  const u = (req.user ?? {}) as {
    activeRoleId?: string;
    roleId?: string;
    role?: string;
    roles?: string[];
  };
  const raw = [u.activeRoleId, u.roleId, u.role, ...(Array.isArray(u.roles) ? u.roles : [])]
    .filter(Boolean)
    .map((r) => String(r));
  const normalized = new Set(raw.map((r) => normalizeRole(r)));
  const rawLower = new Set(raw.map((r) => r.toLowerCase()));
  return (
    normalized.has(ROLES.ADMIN) ||
    normalized.has(ROLES.SUPER_HOD) ||
    rawLower.has("admin") ||
    rawLower.has("super_admin") ||
    rawLower.has("super_hod")
  );
}

interface ReconIssue {
  type: string;
  severity: "high" | "medium" | "low";
  entity: string;
  entityId: string;
  label?: string | null;
  detail: string;
  context?: Record<string, unknown>;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

workflowReconciliationRouter.get(
  "/reconciliation",
  async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!canViewReconciliation(req)) {
      return res
        .status(403)
        .json({ error: "You are not permitted to view the workflow reconciliation report." });
    }

    const issues: ReconIssue[] = [];
    const checkErrors: Record<string, string> = {};

    const runCheck = async (name: string, fn: () => Promise<ReconIssue[]>) => {
      try {
        const found = await fn();
        for (const i of found) issues.push(i);
      } catch (e: any) {
        checkErrors[name] = e?.message ?? String(e);
        console.error(`[workflow-reconciliation] check "${name}" failed`, e);
      }
    };

    // 1. APPROVED invoices that never produced a project.
    await runCheck("approved_invoice_without_project", async () => {
      const { rows } = await pool.query(`
        select i.id, i.company_name, i.project_name, i.status, i.gm_id, i.created_at
          from drm.product_posting_invoices i
          left join drm.projects p
            on p.invoice_id = i.id and coalesce(p.is_deleted, false) = false
         where i.status = 'APPROVED' and p.id is null
         order by i.created_at desc
         limit 500
      `);
      return rows.map((r: any) => ({
        type: "approved_invoice_without_project",
        severity: "high" as const,
        entity: "invoice",
        entityId: String(r.id),
        label: r.company_name || r.project_name || String(r.id),
        detail: "Invoice is APPROVED but no project is linked to it.",
        context: { gmId: r.gm_id, createdAt: r.created_at },
      }));
    });

    // 2. INVOICE_ROOT projects with no invoice link.
    await runCheck("invoice_root_project_without_invoice", async () => {
      const { rows } = await pool.query(`
        select p.id, p.name, p.status, p.project_type, p.department_type, p.gm_id, p.created_at
          from drm.projects p
         where coalesce(p.is_deleted, false) = false
           and p.project_type = 'INVOICE_ROOT'
           and p.invoice_id is null
         order by p.created_at desc
         limit 500
      `);
      return rows.map((r: any) => ({
        type: "invoice_root_project_without_invoice",
        severity: "medium" as const,
        entity: "project",
        entityId: String(r.id),
        label: r.name || String(r.id),
        detail: "INVOICE_ROOT project has no linked invoice (invoice_id is null).",
        context: {
          status: r.status,
          departmentType: r.department_type,
          gmId: r.gm_id,
          createdAt: r.created_at,
        },
      }));
    });

    // 3. Projects still OnHold even though their listing-QA dependency is satisfied.
    await runCheck("project_onhold_with_satisfied_dependency", async () => {
      const { rows } = await pool.query(`
        select p.id, p.name, p.status, p.department_type,
               d.id as dependency_id, d.status as dependency_status, d.satisfied_at
          from drm.projects p
          join drm.project_dependencies d on d.project_id = p.id
         where coalesce(p.is_deleted, false) = false
           and p.status = 'OnHold'
           and d.dependency_type = 'LISTING_PAGE_QA_APPROVAL'
           and (d.satisfied_at is not null or d.status = 'SATISFIED')
         order by d.satisfied_at desc nulls last
         limit 500
      `);
      return rows.map((r: any) => ({
        type: "project_onhold_with_satisfied_dependency",
        severity: "high" as const,
        entity: "project",
        entityId: String(r.id),
        label: r.name || String(r.id),
        detail:
          "Project is OnHold but its listing-page QA dependency is already satisfied; it should have been released.",
        context: {
          departmentType: r.department_type,
          dependencyId: r.dependency_id,
          dependencyStatus: r.dependency_status,
          satisfiedAt: r.satisfied_at,
        },
      }));
    });

    // 4. QA complete but verification has been pending too long (PP + Software).
    const verificationStallCheck = (table: string, dept: string) => async (): Promise<ReconIssue[]> => {
      const { rows } = await pool.query(
        `
        select w.project_id, w.current_phase, w.qa_reviewed_at, w.updated_at,
               p.name, p.department_type
          from ${table} w
          join drm.projects p on p.id = w.project_id
         where w.qa_reviewed_at is not null
           and w.verification_reviewed_at is null
           and w.qa_reviewed_at < now() - ($1 || ' days')::interval
         order by w.qa_reviewed_at asc
         limit 500
      `,
        [String(VERIFICATION_PENDING_MAX_DAYS)],
      );
      return rows.map((r: any) => ({
        type: "verification_pending_too_long",
        severity: "medium" as const,
        entity: "project",
        entityId: String(r.project_id),
        label: r.name || String(r.project_id),
        detail: `${dept}: QA was completed but verification has been pending longer than ${VERIFICATION_PENDING_MAX_DAYS} day(s).`,
        context: {
          currentPhase: r.current_phase,
          qaReviewedAt: r.qa_reviewed_at,
          departmentType: r.department_type,
        },
      }));
    };
    await runCheck(
      "verification_pending_product_posting",
      verificationStallCheck("drm.product_posting_workflows", "Product Posting"),
    );
    await runCheck(
      "verification_pending_software",
      verificationStallCheck("drm.software_workflows", "Software"),
    );

    // 5. Approved/completed GM entries that never produced an invoice.
    await runCheck("approved_gm_without_invoice", async () => {
      const { rows } = await pool.query(`
        select g.id, g.company_name, g.status, g.order_id, g.created_at
          from drm.gm_entries g
         where g.status in ('Approved', 'Completed')
           and coalesce(g.is_deleted, false) = false
           and not exists (
             select 1 from drm.product_posting_invoices i
              where i.gm_id::text = g.id::text
           )
         order by g.created_at desc
         limit 500
      `);
      return rows.map((r: any) => ({
        type: "approved_gm_without_invoice",
        severity: "medium" as const,
        entity: "gm_entry",
        entityId: String(r.id),
        label: r.company_name || String(r.id),
        detail: "GM entry is approved/completed but has no linked invoice.",
        context: { status: r.status, orderId: r.order_id, createdAt: r.created_at },
      }));
    });

    // 6. Partial-payment GMs (approved) with an outstanding balance.
    await runCheck("partial_gm_with_pending_balance", async () => {
      const { rows } = await pool.query(`
        select g.id, g.company_name, g.amount_usd,
               coalesce(sum(pr.amount_usd), 0) as received_usd,
               (coalesce(g.amount_usd, 0) - coalesce(sum(pr.amount_usd), 0)) as pending_usd
          from drm.gm_entries g
          left join drm.gm_partial_receipts pr on pr.gm_id = g.id
         where g.is_partial_payment = 1
           and g.status in ('Approved', 'Completed')
           and coalesce(g.is_deleted, false) = false
         group by g.id, g.company_name, g.amount_usd
        having (coalesce(g.amount_usd, 0) - coalesce(sum(pr.amount_usd), 0)) > 0.01
         order by pending_usd desc
         limit 500
      `);
      return rows.map((r: any) => ({
        type: "partial_gm_with_pending_balance",
        severity: "low" as const,
        entity: "gm_entry",
        entityId: String(r.id),
        label: r.company_name || String(r.id),
        detail: "Partial-payment GM is approved but still has an outstanding balance.",
        context: {
          amountUsd: num(r.amount_usd),
          receivedUsd: num(r.received_usd),
          pendingUsd: num(r.pending_usd),
        },
      }));
    });

    // 7. Loan GMs (approved) missing loan terms or admin approval.
    await runCheck("loan_gm_without_terms_or_approval", async () => {
      const { rows } = await pool.query(`
        select g.id, g.company_name, g.status, g.created_at,
               lt.gm_id as terms_gm_id, lt.admin_approval_status, lt.return_status
          from drm.gm_entries g
          left join drm.gm_loan_terms lt on lt.gm_id = g.id
         where g.is_loan = 1
           and g.status in ('Approved', 'Completed')
           and coalesce(g.is_deleted, false) = false
           and (lt.gm_id is null or coalesce(lt.admin_approval_status, '') <> 'APPROVED')
         order by g.created_at desc
         limit 500
      `);
      return rows.map((r: any) => ({
        type: "loan_gm_without_terms_or_approval",
        severity: "high" as const,
        entity: "gm_entry",
        entityId: String(r.id),
        label: r.company_name || String(r.id),
        detail: r.terms_gm_id
          ? "Loan GM is approved but its loan terms are not admin-approved."
          : "Loan GM is approved but has no loan terms recorded.",
        context: {
          adminApprovalStatus: r.admin_approval_status ?? null,
          returnStatus: r.return_status ?? null,
          createdAt: r.created_at,
        },
      }));
    });

    // 8. Project status vs workflow phase mismatch (PMS / report vs workflow).
    //    Only the high-confidence direction is flagged: a project marked
    //    "Completed" whose PP/Software workflow has NOT reached the terminal
    //    VERIFICATION_COMPLETE phase. The reverse direction (workflow terminal but
    //    project not Completed) is intentionally NOT flagged: the workflow handlers
    //    complete the *task*, not the parent *project*, so "verified but project
    //    still Active" is the normal end-state and would be pure noise.
    // NOTE: deliberately selects only columns guaranteed to exist on drm.projects
    // (id, name, status). It does NOT reference p.department_type — that column is
    // in shared/schema.ts but absent from some live DBs (db:push is broken), which
    // makes the loose-mapping checks above fail in those environments. Keeping this
    // check column-minimal lets it run everywhere.
    const statusMismatchCheck = (table: string, dept: string) => async (): Promise<ReconIssue[]> => {
      const { rows } = await pool.query(`
        select w.project_id, w.current_phase, w.updated_at,
               p.name, p.status as project_status
          from ${table} w
          join drm.projects p on p.id = w.project_id
         where coalesce(p.is_deleted, false) = false
           and p.status = 'Completed'
           and w.current_phase <> 'VERIFICATION_COMPLETE'
         order by w.updated_at desc
         limit 500
      `);
      return rows.map((r: any) => ({
        type: "pms_workflow_status_mismatch",
        severity: "medium" as const,
        entity: "project",
        entityId: String(r.project_id),
        label: r.name || String(r.project_id),
        detail: `${dept}: project is marked "Completed" but its workflow has not reached Verification Complete (current phase: ${r.current_phase}).`,
        context: {
          projectStatus: r.project_status,
          workflowPhase: r.current_phase,
        },
      }));
    };
    await runCheck(
      "status_mismatch_product_posting",
      statusMismatchCheck("drm.product_posting_workflows", "Product Posting"),
    );
    await runCheck(
      "status_mismatch_software",
      statusMismatchCheck("drm.software_workflows", "Software"),
    );

    const summary = issues.reduce<Record<string, number>>((acc, i) => {
      acc[i.type] = (acc[i.type] ?? 0) + 1;
      return acc;
    }, {});

    return res.json({
      generatedAt: new Date().toISOString(),
      thresholds: { verificationPendingMaxDays: VERIFICATION_PENDING_MAX_DAYS },
      totalIssues: issues.length,
      summary,
      issues,
      checkErrors: Object.keys(checkErrors).length ? checkErrors : undefined,
    });
  },
);

export default workflowReconciliationRouter;
