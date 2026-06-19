import type { Request } from "express";
import { pool } from "../db";
import { ensureDbOnce } from "../db/ensure";
import {
  INVOICE_TYPES,
  PROJECT_TYPES,
  PROJECT_DEPENDENCY_TYPES,
  mapProjectInitialStatusToDb,
  type DbProjectStatus,
} from "../../shared/gm-sales-constants";
import { getConfigValue } from "./gm-sales-config.service";
import { AuditLogService } from "./audit-log.service";
import { NotificationService } from "./notification-service";

/**
 * InvoiceToProjectService — Patch 5 Stage 5 (P9 + P10).
 *
 * Standardizes how an APPROVED product-posting invoice becomes a project, and
 * enforces the Product-Posting -> Listing-Page-QA dependency. It mirrors the
 * conventions of gm-invoice-generation.service.ts:
 *
 *   - BEST-EFFORT: never throws to its caller. Approval / assignment flows must
 *     not break if project generation or dependency bookkeeping hiccups. All
 *     outcomes are surfaced via structured return values.
 *   - SELF-HEALING: calls ensureDbOnce() so the Stage 5 columns/table exist even
 *     in tests that don't boot the full server.
 *   - IDEMPOTENT: at most one INVOICE_ROOT project per invoice (pre-check + the
 *     partial unique index uq_projects_invoice_root as the hard backstop). The
 *     service "creates OR links" — the earliest existing project for an invoice
 *     is treated as the root.
 *   - CONFIG-DRIVEN: initial project status comes from
 *     defaultProjectStatusAfterInvoiceApproval (mapped to the DB enum, never
 *     hardcoded). The LP-QA dependency is only created/enforced when
 *     requireProductPostingWaitForListingQa is true; otherwise every dependency
 *     code path is a no-op.
 *
 * Routing is by STRUCTURED fields, not loose text: department_type / invoice_type
 * / service_type / project_type are written on the project row so downstream
 * logic reads stored values instead of parsing names.
 */

const MODULE = "project-generation";
const ENTITY = "Project";
const DEPENDENCY_TYPE = PROJECT_DEPENDENCY_TYPES.LISTING_PAGE_QA_APPROVAL;

export interface CreateOrLinkProjectInput {
  invoiceId: string;
  actorUserId?: string | null;
  req?: Request;
}

export interface CreateOrLinkProjectResult {
  ok: boolean;
  /** A new root project row was inserted. */
  created: boolean;
  /** An existing project for this invoice was reused (no insert). */
  linked: boolean;
  projectId: string | null;
  /** Final DB status of the root project (e.g. Active / OnHold). */
  status: string | null;
  /** True when the root project is held by an unsatisfied LP-QA dependency. */
  held: boolean;
  /** The reconciled dependency row id, when one applies. */
  dependencyId: string | null;
  reason?: string;
}

function failResult(reason: string): CreateOrLinkProjectResult {
  return {
    ok: false,
    created: false,
    linked: false,
    projectId: null,
    status: null,
    held: false,
    dependencyId: null,
    reason,
  };
}

/**
 * Structured routing department for a project, derived from the canonical
 * invoice type. PRODUCT_POSTING -> 'PRODUCT_POSTING'; LISTING_PAGE / MINIWEBSITE
 * are DND department work. Falls back to PRODUCT_POSTING for unknown/missing
 * types (matches the existing routing fallback), so a row always has a value.
 */
function departmentForInvoiceType(invoiceType?: string | null): string {
  const t = String(invoiceType ?? "").trim().toUpperCase();
  if (t === INVOICE_TYPES.PRODUCT_POSTING) return "PRODUCT_POSTING";
  if (t === INVOICE_TYPES.LISTING_PAGE || t === INVOICE_TYPES.MINIWEBSITE) return "DND";
  return "PRODUCT_POSTING";
}

function isProductPostingType(invoiceType?: string | null): boolean {
  return String(invoiceType ?? "").trim().toUpperCase() === INVOICE_TYPES.PRODUCT_POSTING;
}

/**
 * Resolve the configured initial project status to a DB enum value. The config
 * value is the single source of truth; if it has no DB equivalent yet
 * (DOCUMENTS_PENDING / PENDING_PROJECT), we log and fall back to 'Active' so the
 * generation never hard-fails on an as-yet-unmapped policy value.
 */
async function resolveInitialDbStatus(): Promise<DbProjectStatus> {
  const configured = await getConfigValue("defaultProjectStatusAfterInvoiceApproval");
  const mapped = mapProjectInitialStatusToDb(configured as string);
  if (mapped.ok && mapped.value) return mapped.value;
  console.warn(
    `[invoice-to-project] initial status '${String(
      configured,
    )}' has no DB enum value; defaulting to 'Active'. ${mapped.warnings.join("; ")}`,
  );
  return "Active";
}

async function requireWaitForListingQa(): Promise<boolean> {
  return Boolean(await getConfigValue("requireProductPostingWaitForListingQa"));
}

/** Earliest INVOICE_ROOT project for a (gm_id, invoice_type), if any. */
async function findRootProjectForGm(
  gmId: string,
  invoiceType: string,
): Promise<{ id: string; status: string } | null> {
  const { rows } = await pool.query(
    `SELECT id, status FROM drm.projects
       WHERE gm_id = $1 AND invoice_type = $2 AND project_type = $3
         AND COALESCE(is_deleted, false) = false
       ORDER BY created_at ASC
       LIMIT 1`,
    [gmId, invoiceType, PROJECT_TYPES.INVOICE_ROOT],
  );
  return rows[0] ?? null;
}

/** All INVOICE_ROOT Product-Posting projects for a GM (typically one). */
async function findProductPostingRootsForGm(
  gmId: string,
): Promise<Array<{ id: string; status: string }>> {
  const { rows } = await pool.query(
    `SELECT id, status FROM drm.projects
       WHERE gm_id = $1 AND invoice_type = $2 AND project_type = $3
         AND COALESCE(is_deleted, false) = false`,
    [gmId, INVOICE_TYPES.PRODUCT_POSTING, PROJECT_TYPES.INVOICE_ROOT],
  );
  return rows;
}

/**
 * Whether the Listing-Page QA is already satisfied for a GM. True when either a
 * dependency row for this GM is already SATISFIED, OR the GM's Listing-Page root
 * project's product-posting workflow has passed QA (qa_reviewed_at set). The
 * second check makes ordering robust: it handles LP QA completing BEFORE the PP
 * root project exists (so there was no dependency row to satisfy at QA time).
 */
async function listingQaSatisfiedForGm(gmId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1
       WHERE EXISTS (
         SELECT 1 FROM drm.project_dependencies d
          WHERE d.gm_id = $1 AND d.dependency_type = $2 AND d.status = 'SATISFIED'
       )
       OR EXISTS (
         SELECT 1
           FROM drm.projects p
           JOIN drm.product_posting_workflows w ON w.project_id = p.id
          WHERE p.gm_id = $1
            AND p.invoice_type = $3
            AND w.qa_reviewed_at IS NOT NULL
       )
       LIMIT 1`,
    [gmId, DEPENDENCY_TYPE, INVOICE_TYPES.LISTING_PAGE],
  );
  return rows.length > 0;
}

/** Is there a PENDING LP-QA dependency for this (dependent) project? */
async function pendingDependencyForProject(projectId: string): Promise<{ id: string } | null> {
  const { rows } = await pool.query(
    `SELECT id FROM drm.project_dependencies
       WHERE project_id = $1 AND dependency_type = $2 AND status = 'PENDING'
       LIMIT 1`,
    [projectId, DEPENDENCY_TYPE],
  );
  return rows[0] ?? null;
}

/** Put a project OnHold unless it is already terminal. Returns the new status. */
async function holdProject(projectId: string): Promise<string> {
  const { rows } = await pool.query(
    `UPDATE drm.projects
        SET status = 'OnHold', updated_at = now()
      WHERE id = $1 AND status <> 'OnHold' AND status <> 'Completed'
      RETURNING status`,
    [projectId],
  );
  if (rows[0]?.status) return rows[0].status;
  const current = await pool.query(`SELECT status FROM drm.projects WHERE id = $1 LIMIT 1`, [projectId]);
  return current.rows[0]?.status ?? "OnHold";
}

/**
 * Ensure the LP-QA dependency rows for a GM reflect the current set of PP root
 * projects. No-op unless requireProductPostingWaitForListingQa is true and at
 * least one PP root exists. The dependency is matched/keyed on gm_id and seeded
 * SATISFIED when LP QA is already done (order-robust). Idempotent via the unique
 * index uq_project_dependencies_project_type; never downgrades a SATISFIED row.
 */
async function reconcileListingProductDependencies(
  gmId: string,
): Promise<{ created: boolean; affectedDependencyIds: string[] }> {
  if (!gmId) return { created: false, affectedDependencyIds: [] };
  if (!(await requireWaitForListingQa())) return { created: false, affectedDependencyIds: [] };

  const ppRoots = await findProductPostingRootsForGm(gmId);
  if (ppRoots.length === 0) return { created: false, affectedDependencyIds: [] };

  const lpRoot = await findRootProjectForGm(gmId, INVOICE_TYPES.LISTING_PAGE);
  const satisfied = await listingQaSatisfiedForGm(gmId);
  const status = satisfied ? "SATISFIED" : "PENDING";

  const affectedDependencyIds: string[] = [];
  for (const pp of ppRoots) {
    const { rows } = await pool.query(
      `INSERT INTO drm.project_dependencies (
         id, project_id, dependency_project_id, gm_id, dependency_type, status, satisfied_at, metadata, created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5,
         CASE WHEN $5 = 'SATISFIED' THEN now() ELSE NULL END,
         $6, now(), now()
       )
       ON CONFLICT (project_id, dependency_type) DO UPDATE
         SET dependency_project_id = COALESCE(drm.project_dependencies.dependency_project_id, EXCLUDED.dependency_project_id),
             gm_id = COALESCE(drm.project_dependencies.gm_id, EXCLUDED.gm_id),
             status = CASE
               WHEN drm.project_dependencies.status = 'PENDING' AND EXCLUDED.status = 'SATISFIED'
               THEN 'SATISFIED' ELSE drm.project_dependencies.status END,
             satisfied_at = CASE
               WHEN drm.project_dependencies.status = 'PENDING' AND EXCLUDED.status = 'SATISFIED'
               THEN now() ELSE drm.project_dependencies.satisfied_at END,
             updated_at = now()
       RETURNING id`,
      [
        pp.id,
        lpRoot?.id ?? null,
        gmId,
        DEPENDENCY_TYPE,
        status,
        JSON.stringify({ source: "reconcile", lpRootProjectId: lpRoot?.id ?? null }),
      ],
    );
    if (rows[0]?.id) affectedDependencyIds.push(rows[0].id);
  }
  return { created: true, affectedDependencyIds };
}

/**
 * Gate used by the assign-task flow: may a Product-Posting root project start?
 * Satisfied when the controlling config is off, or when no PENDING LP-QA
 * dependency exists for the project. Best-effort: on error it returns satisfied
 * (fail-open) so a bookkeeping glitch never permanently blocks legitimate work —
 * the dependency is an additive safeguard, not a hard invariant.
 */
export async function assertProductPostingDependencySatisfied(
  projectId: string,
): Promise<{ satisfied: boolean; dependencyId: string | null; reason?: string }> {
  try {
    await ensureDbOnce();
    if (!projectId) return { satisfied: true, dependencyId: null };
    if (!(await requireWaitForListingQa())) return { satisfied: true, dependencyId: null };

    // Gate ONLY genuine Product-Posting root projects. Non-PP work, sub-projects
    // and legacy (untagged) projects are never blocked here — this prevents a
    // stale or mis-keyed dependency row from blocking legitimate assignments.
    const projRes = await pool.query(
      `SELECT gm_id, invoice_type, project_type FROM drm.projects WHERE id = $1 LIMIT 1`,
      [projectId],
    );
    const proj = projRes.rows[0];
    if (!proj) return { satisfied: true, dependencyId: null };
    const isPpRoot =
      isProductPostingType(proj.invoice_type as string | null) &&
      String(proj.project_type ?? "").toUpperCase() === PROJECT_TYPES.INVOICE_ROOT;
    if (!isPpRoot) return { satisfied: true, dependencyId: null };

    // Reconcile first so a PP root whose dependency row is missing (legacy root,
    // or config enabled after generation) gets one created/satisfied before we
    // decide — closing the bypass where such a root could start unguarded.
    if (proj.gm_id) await reconcileListingProductDependencies(String(proj.gm_id));

    const pending = await pendingDependencyForProject(projectId);
    if (!pending) return { satisfied: true, dependencyId: null };
    return {
      satisfied: false,
      dependencyId: pending.id,
      reason: "Listing Page QA must be completed before this Product Posting project can start.",
    };
  } catch (err) {
    console.error("[invoice-to-project] dependency check failed (fail-open):", err);
    return { satisfied: true, dependencyId: null };
  }
}

/**
 * Mark all PENDING LP-QA dependencies for a GM as SATISFIED, then release any PP
 * root projects that were held (OnHold -> configured initial status). Called when
 * a Listing-Page project's QA completes. No-op when no dependency rows exist
 * (i.e. config was off), so it is always safe to call. Best-effort.
 */
export async function satisfyListingQaDependencies(input: {
  gmId: string;
  actorUserId?: string | null;
  req?: Request;
}): Promise<{ satisfiedCount: number; releasedProjectIds: string[] }> {
  try {
    await ensureDbOnce();
    const gmId = String(input.gmId ?? "").trim();
    if (!gmId) return { satisfiedCount: 0, releasedProjectIds: [] };

    const { rows } = await pool.query(
      `UPDATE drm.project_dependencies
          SET status = 'SATISFIED', satisfied_at = now(), satisfied_by = $2, updated_at = now()
        WHERE gm_id = $1 AND dependency_type = $3 AND status = 'PENDING'
        RETURNING id, project_id`,
      [gmId, input.actorUserId ?? null, DEPENDENCY_TYPE],
    );
    if (rows.length === 0) return { satisfiedCount: 0, releasedProjectIds: [] };

    const releasedProjectIds: string[] = [];
    const targetStatus = await resolveInitialDbStatus();
    for (const dep of rows) {
      const projectId = dep.project_id as string;
      // Only flip projects that are currently held; leave any other status alone.
      const released = await pool.query(
        `UPDATE drm.projects
            SET status = $2, updated_at = now()
          WHERE id = $1 AND status = 'OnHold'
          RETURNING id`,
        [projectId, targetStatus],
      );
      if (released.rows[0]?.id) releasedProjectIds.push(projectId);

      await AuditLogService.record({
        actorUserId: input.actorUserId ?? undefined,
        action: "PROJECT_DEPENDENCY_SATISFIED",
        module: MODULE,
        entityType: ENTITY,
        entityId: projectId,
        nextStatus: released.rows[0]?.id ? targetStatus : undefined,
        after: { dependencyId: dep.id, dependencyType: DEPENDENCY_TYPE, gmId },
        req: input.req,
      });
    }

    if (releasedProjectIds.length > 0) {
      await NotificationService.notifyWorkflowTransition({
        message: `Listing Page QA approved — ${releasedProjectIds.length} Product Posting project(s) released to start.`,
        type: "INFO",
        recipientRoles: ["product_posting_manager", "product_posting_executive"],
        module: MODULE,
        entityType: ENTITY,
        entityId: releasedProjectIds[0],
        targetUrl: "/pms/product-posting",
      });
    }

    return { satisfiedCount: rows.length, releasedProjectIds };
  } catch (err) {
    console.error("[invoice-to-project] satisfy dependencies failed (best-effort):", err);
    return { satisfiedCount: 0, releasedProjectIds: [] };
  }
}

/**
 * Create OR link the single INVOICE_ROOT project for an APPROVED invoice.
 * Idempotent: re-running produces zero duplicates. Honors the LP-QA dependency
 * (PP root created/kept OnHold while an unsatisfied dependency applies). Returns
 * a structured result; never throws.
 */
export async function createOrLinkProjectForApprovedInvoice(
  input: CreateOrLinkProjectInput,
): Promise<CreateOrLinkProjectResult> {
  try {
    await ensureDbOnce();

    const invoiceId = String(input.invoiceId ?? "").trim();
    if (!invoiceId) return failResult("no invoiceId provided");

    const invRes = await pool.query(
      `SELECT id, sales_exec_id, customer_id, project_name, company_name,
              status, service_type, gm_id, invoice_type
         FROM drm.product_posting_invoices
        WHERE id = $1
        LIMIT 1`,
      [invoiceId],
    );
    const inv = invRes.rows[0];
    if (!inv) return failResult(`invoice ${invoiceId} not found`);
    if (String(inv.status ?? "").toUpperCase() !== "APPROVED") {
      return failResult(`invoice ${invoiceId} is not APPROVED (status=${inv.status})`);
    }

    const ownerUserId = (inv.sales_exec_id as string | null) ?? null;
    if (!ownerUserId) return failResult(`invoice ${invoiceId} has no sales_exec_id owner`);

    const gmId = (inv.gm_id as string | null) ?? null;
    const invoiceType = (inv.invoice_type as string | null) ?? null;
    const serviceType =
      (inv.service_type as string | null) ?? (inv.project_name as string | null) ?? null;
    const departmentType = departmentForInvoiceType(invoiceType);
    const actor = input.actorUserId ?? ownerUserId;

    // 1) IDEMPOTENCY — link the earliest existing project for this invoice, if
    //    one exists (treat it as the root and backfill structured fields).
    //    SUBPROJECTs deliberately copy the parent invoice_id, so they must be
    //    excluded here or one could be mistaken for the generated root.
    const existingRes = await pool.query(
      `SELECT id, status FROM drm.projects
         WHERE invoice_id = $1 AND COALESCE(is_deleted, false) = false
           AND project_type IS DISTINCT FROM $3
         ORDER BY (project_type = $2) DESC, created_at ASC
         LIMIT 1`,
      [invoiceId, PROJECT_TYPES.INVOICE_ROOT, PROJECT_TYPES.SUBPROJECT],
    );

    let projectId: string | undefined = existingRes.rows[0]?.id;
    let dbStatus: string | null = existingRes.rows[0]?.status ?? null;
    let created = false;

    if (projectId) {
      await pool.query(
        `UPDATE drm.projects
            SET gm_id = COALESCE(gm_id, $2),
                service_type = COALESCE(service_type, $3),
                invoice_type = COALESCE(invoice_type, $4),
                department_type = COALESCE(department_type, $5),
                project_type = COALESCE(project_type, $6),
                created_by = COALESCE(created_by, $7),
                updated_at = now()
          WHERE id = $1`,
        [projectId, gmId, serviceType, invoiceType, departmentType, PROJECT_TYPES.INVOICE_ROOT, actor],
      );
    } else {
      // 2) CREATE — initial status from config; held when an unsatisfied LP-QA
      //    dependency applies to this Product-Posting project.
      let initialStatus: DbProjectStatus | "OnHold" = await resolveInitialDbStatus();
      if (isProductPostingType(invoiceType) && gmId && (await requireWaitForListingQa())) {
        if (!(await listingQaSatisfiedForGm(gmId))) initialStatus = "OnHold";
      }

      const name =
        (inv.project_name as string | null) || (inv.company_name as string | null) || "Project";

      try {
        const insertRes = await pool.query(
          `INSERT INTO drm.projects (
             id, invoice_id, customer_id, name, description, owner_user_id,
             department_type, gm_id, service_type, invoice_type, project_type,
             status, created_by, created_at, updated_at
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, $12, now(), now()
           )
           RETURNING id, status`,
          [
            invoiceId,
            (inv.customer_id as string | null) ?? null,
            name,
            "Generated from approved invoice (Patch 5 Stage 5).",
            ownerUserId,
            departmentType,
            gmId,
            serviceType,
            invoiceType,
            PROJECT_TYPES.INVOICE_ROOT,
            initialStatus,
            actor,
          ],
        );
        projectId = insertRes.rows[0]?.id;
        dbStatus = insertRes.rows[0]?.status ?? String(initialStatus);
        created = true;
      } catch (err: any) {
        // 23505 = unique_violation on uq_projects_invoice_root: a concurrent
        // generation won the race. Link that root instead of duplicating.
        if (err?.code === "23505") {
          const raceRes = await pool.query(
            `SELECT id, status FROM drm.projects
               WHERE invoice_id = $1 AND project_type = $2
               LIMIT 1`,
            [invoiceId, PROJECT_TYPES.INVOICE_ROOT],
          );
          projectId = raceRes.rows[0]?.id;
          dbStatus = raceRes.rows[0]?.status ?? null;
        } else {
          throw err;
        }
      }
    }

    if (!projectId) return failResult("project row could not be created or linked");

    // 3) DEPENDENCY — reconcile LP<->PP rows (no-op unless config requires it),
    //    then ensure this PP root is held while a PENDING dependency exists.
    let dependencyId: string | null = null;
    if (gmId) {
      const recon = await reconcileListingProductDependencies(gmId);
      dependencyId = recon.affectedDependencyIds[0] ?? null;
      if (isProductPostingType(invoiceType)) {
        const pending = await pendingDependencyForProject(projectId);
        if (pending) {
          dependencyId = pending.id;
          dbStatus = await holdProject(projectId);
        }
      }
    }

    const held = dbStatus === "OnHold";

    await AuditLogService.record({
      actorUserId: actor ?? undefined,
      action: created ? "PROJECT_GENERATED_FROM_INVOICE" : "PROJECT_LINKED_FROM_INVOICE",
      module: MODULE,
      entityType: ENTITY,
      entityId: projectId,
      nextStatus: dbStatus ?? undefined,
      after: {
        invoiceId,
        gmId,
        invoiceType,
        departmentType,
        projectType: PROJECT_TYPES.INVOICE_ROOT,
        held,
        dependencyId,
      },
      req: input.req,
    });

    return {
      ok: true,
      created,
      linked: !created,
      projectId,
      status: dbStatus,
      held,
      dependencyId,
    };
  } catch (err) {
    console.error("[invoice-to-project] generation failed (best-effort):", err);
    return failResult("generation error (see server logs)");
  }
}
