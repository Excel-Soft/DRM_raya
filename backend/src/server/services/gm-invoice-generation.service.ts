import type { Request } from "express";
import { pool } from "../db";
import { ensureDbOnce } from "../db/ensure";
import {
  INVOICE_TYPE_VALUES,
  INVOICE_TYPE_TO_PRODUCT_NAME,
  GM_INVOICE_GENERATION_TIMING,
  type InvoiceType,
  type GmInvoiceGenerationTiming,
} from "../../shared/gm-sales-constants";
import { getConfigValue } from "./gm-sales-config.service";
import { AuditLogService } from "./audit-log.service";
import { CrossDepartmentStatusService } from "./cross-department-status.service";

/**
 * GmInvoiceGenerationService — Patch 5 Stage 4 (P6).
 *
 * Owns the *default* (auto-generated) product-posting invoices that the system
 * historically created as a blind 3-row insert. This consolidates that logic so
 * every GM-creation surface delegates here, and adds three guarantees the old
 * helper lacked:
 *
 *   1. TIMING — generation only fires for the configured event
 *      (`gmInvoiceGenerationTiming`: ON_GM_CREATION | AFTER_FINAL_GM_APPROVAL).
 *      Default stays ON_GM_CREATION, so current behavior is preserved.
 *   2. IDEMPOTENCY — at most one auto-generated invoice per (gm_id, invoice_type),
 *      enforced both by a pre-check and the partial unique index
 *      `uq_ppi_autogen_gm_type`. Re-running creates zero duplicates.
 *   3. CANONICAL TYPE — each invoice carries a canonical `invoice_type`
 *      (LISTING_PAGE / MINIWEBSITE / PRODUCT_POSTING) plus the matching
 *      `project_name`, instead of only a free-text project name.
 *
 * This service NEVER throws to its caller: GM creation must not break if invoice
 * generation fails. It returns a structured result describing what happened.
 *
 * It deliberately inserts directly (not via InvoiceWorkflowService.create) so it
 * bypasses the manual-create duplicate/role checks — these are *system* rows,
 * created at zero amount, that sales later fills in before submitting for HOD
 * approval. (Approval completeness is enforced separately at approval time.)
 */

export interface GenerateDefaultInvoicesInput {
  /** GM/source record id this batch is linked to. Null for sources with no GM
   *  (e.g. wallet operations, BV reports) — those get no idempotency key. */
  gmId?: string | null;
  customerId?: string | null;
  companyName?: string | null;
  /** Sales owner the invoices are attributed to (sales_exec_id / generated_by). */
  ownerUserId: string;
  /** The event firing this call; compared against the configured timing. */
  event: GmInvoiceGenerationTiming;
  /** Who triggered generation (for audit). Defaults to ownerUserId. */
  actorUserId?: string | null;
  req?: Request;
}

export interface GenerateDefaultInvoicesResult {
  /** True when generation actually ran for this event (timing matched). */
  generated: boolean;
  createdCount: number;
  skippedCount: number;
  createdTypes: InvoiceType[];
  /** Human-readable reason when generation did not run / partially failed. */
  reason?: string;
}

const MODULE = "invoice-workflow";
const ENTITY = "Invoice";
const SOURCE_MODULE = "gm-invoice-generation";

function emptyResult(reason: string): GenerateDefaultInvoicesResult {
  return { generated: false, createdCount: 0, skippedCount: 0, createdTypes: [], reason };
}

/**
 * Generate the default invoice set for a GM record, honoring the configured
 * timing. Best-effort: any failure is logged and surfaced via the result, never
 * thrown.
 */
export async function generateDefaultInvoicesForGm(
  input: GenerateDefaultInvoicesInput,
): Promise<GenerateDefaultInvoicesResult> {
  try {
    // Make sure the Stage 4 columns + idempotency index exist (memoized; cheap
    // after boot, and self-heals in tests that don't boot the full server).
    await ensureDbOnce();

    const configuredTiming = (await getConfigValue(
      "gmInvoiceGenerationTiming",
    )) as GmInvoiceGenerationTiming;

    // Only generate for the event that matches the configured timing. This is
    // what keeps the four creation-time call sites dormant when an operator
    // switches the policy to AFTER_FINAL_GM_APPROVAL, and vice-versa.
    if (configuredTiming !== input.event) {
      return emptyResult(
        `timing mismatch (configured=${configuredTiming}, event=${input.event})`,
      );
    }

    const gmId = input.gmId ?? null;
    const customerId = input.customerId ?? null;
    const companyName = input.companyName ?? "N/A";
    const generatedBy = input.actorUserId ?? input.ownerUserId;

    const createdTypes: InvoiceType[] = [];
    const createdIds: string[] = [];
    let skipped = 0;

    for (const invoiceType of INVOICE_TYPE_VALUES) {
      const projectName = INVOICE_TYPE_TO_PRODUCT_NAME[invoiceType];

      // Idempotency pre-check (only meaningful when we have a GM key). The
      // partial unique index is the hard backstop for races.
      if (gmId) {
        const existing = await pool.query(
          `SELECT id FROM drm.product_posting_invoices
             WHERE gm_id = $1 AND invoice_type = $2 AND auto_generated = true
             LIMIT 1`,
          [gmId, invoiceType],
        );
        if (existing.rows[0]?.id) {
          skipped += 1;
          continue;
        }
      }

      try {
        const inserted = await pool.query(
          `INSERT INTO drm.product_posting_invoices (
             id, amount, sales_exec_id, customer_id, project_name, company_name,
             status, service_type, source_module, source_id,
             gm_id, invoice_type, auto_generated, generated_by, generated_at,
             generation_event, created_at, updated_at
           ) VALUES (
             gen_random_uuid(), 0, $1, $2, $3, $4,
             'PENDING_HOD', $3, $5, $6,
             $6, $7, true, $8, now(),
             $9, now(), now()
           )
           RETURNING id`,
          [
            input.ownerUserId, // $1 sales_exec_id
            customerId, // $2 customer_id
            projectName, // $3 project_name + service_type
            companyName, // $4 company_name
            SOURCE_MODULE, // $5 source_module
            gmId, // $6 source_id + gm_id
            invoiceType, // $7 invoice_type
            generatedBy, // $8 generated_by
            input.event, // $9 generation_event
          ],
        );
        const newId = inserted.rows[0]?.id as string | undefined;
        if (newId) {
          createdIds.push(newId);
          createdTypes.push(invoiceType);
        }
      } catch (err: any) {
        // 23505 = unique_violation: another concurrent generation won the race
        // for this (gm_id, invoice_type). Treat as a successful skip, never a dup.
        if (err?.code === "23505") {
          skipped += 1;
          continue;
        }
        throw err;
      }
    }

    // Best-effort audit + cross-department ledger, one event per created invoice
    // for a queryable trail. Patch 7 Stage 3 also records the Sales/GM → HOD
    // invoice hand-off (ledger + audit only; deduped by event_key, never throws).
    for (let i = 0; i < createdIds.length; i++) {
      const id = createdIds[i];
      await AuditLogService.record({
        actorUserId: generatedBy ?? undefined,
        action: "INVOICE_AUTO_GENERATED",
        module: MODULE,
        entityType: ENTITY,
        entityId: id,
        after: {
          gmId,
          generationEvent: input.event,
          autoGenerated: true,
        },
        req: input.req,
      });
      await CrossDepartmentStatusService.onInvoiceCreated({
        invoiceId: id,
        gmId: gmId ?? null,
        projectName: INVOICE_TYPE_TO_PRODUCT_NAME[createdTypes[i]] ?? null,
        companyName,
        actorUserId: generatedBy ?? null,
        notify: false,
        req: input.req,
      });
    }

    return {
      generated: true,
      createdCount: createdIds.length,
      skippedCount: skipped,
      createdTypes,
      reason:
        createdIds.length === 0
          ? "all invoice types already existed (idempotent no-op)"
          : undefined,
    };
  } catch (err) {
    console.error("[gm-invoice-generation] generation failed (best-effort):", err);
    return emptyResult("generation error (see server logs)");
  }
}

/**
 * AFTER_FINAL_GM_APPROVAL convenience: given a GM id, look up its company/owner
 * and delegate to {@link generateDefaultInvoicesForGm} with the
 * AFTER_FINAL_GM_APPROVAL event. Dormant by default (config timing is
 * ON_GM_CREATION) — wiring this at final-approval surfaces is a safe no-op until
 * an operator switches the policy. Best-effort; never throws.
 */
export async function generateInvoicesAfterFinalGmApproval(
  gmId: string,
  actorUserId?: string | null,
  req?: Request,
): Promise<GenerateDefaultInvoicesResult> {
  try {
    if (!gmId) return emptyResult("no gm id provided");

    const { rows } = await pool.query(
      `SELECT company_name, sales_person_id
         FROM drm.gm_entries
        WHERE id = $1
        LIMIT 1`,
      [String(gmId)],
    );
    const gm = rows[0];
    if (!gm) return emptyResult(`gm ${gmId} not found`);

    const ownerUserId = (gm.sales_person_id as string | null) ?? actorUserId ?? null;
    if (!ownerUserId) {
      return emptyResult(`gm ${gmId} has no resolvable owner for invoice generation`);
    }

    return generateDefaultInvoicesForGm({
      gmId: String(gmId),
      customerId: null,
      companyName: (gm.company_name as string | null) ?? "N/A",
      ownerUserId,
      event: GM_INVOICE_GENERATION_TIMING.AFTER_FINAL_GM_APPROVAL,
      actorUserId: actorUserId ?? ownerUserId,
      req,
    });
  } catch (err) {
    console.error(
      "[gm-invoice-generation] after-final-approval generation failed (best-effort):",
      err,
    );
    return emptyResult("after-final-approval generation error (see server logs)");
  }
}
