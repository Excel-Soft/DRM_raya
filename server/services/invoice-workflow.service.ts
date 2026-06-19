import type { Request } from "express";
import type { PoolClient } from "pg";
import { db, pool } from "../db";
import { productPostingInvoices, projects } from "../../shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { ApiError } from "../utils/api-error";
import { AuditLogService } from "./audit-log.service";
import { NotificationService } from "./notification-service";
import { normalizeRole } from "../utils/role-utils";
import {
  INVOICE_TYPE_TO_PRODUCT_NAME,
  PROJECT_GENERATION_MODE,
  type InvoiceType,
} from "../../shared/gm-sales-constants";
import { getConfigValue } from "./gm-sales-config.service";
import { createOrLinkProjectForApprovedInvoice } from "./invoice-to-project.service";

/**
 * InvoiceWorkflowService — the single owner of every product-posting invoice
 * state transition (Sales → HOD → Account → PMS). All invoice endpoints
 * delegate here so the state machine, role checks, validation side-effects,
 * audit trail and PMS linkage live in exactly one place.
 *
 * Illegal state changes throw ApiError(400); wrong role/stage throws
 * ApiError(403); missing invoice throws ApiError(404); duplicate-blocked
 * creates throw ApiError(409).
 */

export const INVOICE_STATUS = {
  DRAFT: "DRAFT",
  PENDING_HOD: "PENDING_HOD",
  PENDING_ACCOUNT: "PENDING_ACCOUNT",
  APPROVED: "APPROVED",
  PAID: "PAID",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

/**
 * Statuses that still occupy the pipeline (used for duplicate detection).
 * PAID is included: a completed billing event must still block a second active
 * invoice for the same customer + service + source (override-with-reason aside).
 */
const ACTIVE_STATUSES: InvoiceStatus[] = [
  INVOICE_STATUS.DRAFT,
  INVOICE_STATUS.PENDING_HOD,
  INVOICE_STATUS.PENDING_ACCOUNT,
  INVOICE_STATUS.APPROVED,
  INVOICE_STATUS.PAID,
];

/** Legal transition map: current status -> set of allowed next statuses. */
const LEGAL_TRANSITIONS: Record<string, InvoiceStatus[]> = {
  [INVOICE_STATUS.DRAFT]: [INVOICE_STATUS.PENDING_HOD, INVOICE_STATUS.CANCELLED],
  [INVOICE_STATUS.PENDING_HOD]: [
    INVOICE_STATUS.PENDING_ACCOUNT,
    INVOICE_STATUS.REJECTED,
    INVOICE_STATUS.CANCELLED,
  ],
  [INVOICE_STATUS.PENDING_ACCOUNT]: [
    INVOICE_STATUS.APPROVED,
    INVOICE_STATUS.REJECTED,
    INVOICE_STATUS.CANCELLED,
  ],
  [INVOICE_STATUS.APPROVED]: [INVOICE_STATUS.PAID, INVOICE_STATUS.CANCELLED],
  [INVOICE_STATUS.PAID]: [],
  [INVOICE_STATUS.REJECTED]: [],
  [INVOICE_STATUS.CANCELLED]: [],
};

export interface Actor {
  userId: string;
  roleId?: string;
  roles?: string[];
  activeRoleId?: string;
}

const MODULE = "invoice-workflow";
const ENTITY = "Invoice";
/**
 * The audit-log `entityType` the invoice history view (`GET /:id/history`) reads
 * by. Migrated routes route their audit through the central workflow-status
 * service with `auditEntityType: INVOICE_AUDIT_ENTITY` so the transition audit
 * keeps landing where the history view looks for it.
 */
export const INVOICE_AUDIT_ENTITY = ENTITY;

let schemaEnsured = false;
async function ensureInvoiceWorkflowSchema(): Promise<void> {
  if (schemaEnsured) return;
  schemaEnsured = true;
  try {
    await pool.query(`
      alter table drm.product_posting_invoices
        add column if not exists currency text default 'USD',
        add column if not exists invoice_date timestamptz,
        add column if not exists payment_terms text,
        add column if not exists service_type text,
        add column if not exists service_package text,
        add column if not exists source_module text,
        add column if not exists source_id text,
        add column if not exists receipt_reference text,
        add column if not exists paid_amount numeric(12,2),
        add column if not exists paid_date timestamptz,
        add column if not exists rejection_reason text,
        add column if not exists notes text;
    `);
  } catch (err) {
    schemaEnsured = false;
    console.error("[invoice-workflow] failed to ensure schema (continuing):", err);
  }
}

function actorRoleSet(actor: Actor): Set<string> {
  const raw = [actor.roleId, actor.activeRoleId, ...(actor.roles || [])].filter(
    Boolean,
  ) as string[];
  return new Set(raw.map((r) => normalizeRole(r)));
}

function hasAnyRole(actor: Actor, ...roles: string[]): boolean {
  const set = actorRoleSet(actor);
  return roles.some((r) => set.has(normalizeRole(r)));
}

function isAdmin(actor: Actor): boolean {
  return hasAnyRole(actor, "admin");
}

function isHodActor(actor: Actor): boolean {
  return hasAnyRole(actor, "hod", "super_hod", "admin");
}

function isAccountActor(actor: Actor): boolean {
  return hasAnyRole(actor, "account_manager", "admin");
}

/** Admins and managers may override duplicate blocking / edit locked invoices. */
function isOverrideRole(actor: Actor): boolean {
  return hasAnyRole(
    actor,
    "admin",
    "super_hod",
    "hod",
    "sales_manager",
    "account_manager",
  );
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function serviceKey(serviceType?: string | null, projectName?: string | null): string {
  return (serviceType || projectName || "").trim().toLowerCase();
}

function assertTransition(current: string, next: InvoiceStatus): void {
  const allowed = LEGAL_TRANSITIONS[current];
  if (!allowed) {
    throw new ApiError(
      400,
      "BAD_REQUEST",
      `Invoice has an unknown status "${current}" and cannot be transitioned`,
    );
  }
  if (!allowed.includes(next)) {
    throw new ApiError(
      400,
      "BAD_REQUEST",
      `Illegal status change: ${current} → ${next}`,
    );
  }
}

/**
 * Approval completeness gate (Patch 5 Stage 4, P8). An invoice can only be
 * approved when it carries the data that makes it a real billing document:
 * a customer, a positive amount, and a known service/type. Auto-generated
 * placeholders start at amount 0, so this also blocks approving an unfilled
 * placeholder. Throws ApiError(400) listing every missing field; never mutates.
 */
function assertApprovalReadiness(
  invoice: typeof productPostingInvoices.$inferSelect,
  stage: "HOD" | "Account",
): void {
  const missing: string[] = [];
  if (!invoice.customerId) missing.push("customer");
  if (num(invoice.amount) <= 0) missing.push("amount (must be greater than zero)");
  if (!invoice.invoiceType && !invoice.serviceType && !invoice.projectName) {
    missing.push("invoice type / service");
  }
  if (missing.length > 0) {
    throw new ApiError(
      400,
      "INCOMPLETE_INVOICE",
      `Invoice is incomplete and cannot be approved at the ${stage} stage. Missing: ${missing.join(", ")}.`,
      { stage, missing },
    );
  }
}

/**
 * Minimal result returned by the tx-aware decision executors (Patch 5 Stage 6).
 * Structurally compatible with the central service's WorkflowExecuteResult.
 */
export interface InvoiceTxResult {
  previousStatus: string;
  nextStatus: string;
  updatedEntity: { id: string; status: string; salesExecId: string | null };
}

/** Project a snake_case invoice row onto the shape assertApprovalReadiness reads. */
function rowToReadinessShape(row: {
  customer_id: string | null;
  amount: string | null;
  invoice_type: string | null;
  service_type: string | null;
  project_name: string | null;
}): typeof productPostingInvoices.$inferSelect {
  return {
    customerId: row.customer_id,
    amount: row.amount,
    invoiceType: row.invoice_type,
    serviceType: row.service_type,
    projectName: row.project_name,
  } as typeof productPostingInvoices.$inferSelect;
}

function txInvoiceResult(
  previousStatus: string,
  row: { id: string; status: string; sales_exec_id: string | null },
): InvoiceTxResult {
  return {
    previousStatus,
    nextStatus: row.status,
    updatedEntity: {
      id: row.id,
      status: row.status,
      salesExecId: row.sales_exec_id ?? null,
    },
  };
}

export class InvoiceWorkflowService {
  static async getInvoice(id: string) {
    await ensureInvoiceWorkflowSchema();
    const [invoice] = await db
      .select()
      .from(productPostingInvoices)
      .where(eq(productPostingInvoices.id, id));
    return invoice;
  }

  private static async requireInvoice(id: string) {
    const invoice = await this.getInvoice(id);
    if (!invoice) {
      throw new ApiError(404, "NOT_FOUND", "Invoice not found");
    }
    return invoice;
  }

  /**
   * Fail-closed duplicate detection: a second ACTIVE invoice for the same
   * customer + service + source is blocked. If the lookup itself errors we
   * THROW (never treat the row as unique) so a broken check can't admit a
   * silent duplicate.
   */
  private static async findActiveDuplicate(input: {
    customerId: string;
    serviceType?: string | null;
    projectName?: string | null;
    sourceModule?: string | null;
    sourceId?: string | null;
    excludeId?: string;
  }): Promise<string | null> {
    const key = serviceKey(input.serviceType, input.projectName);
    try {
      const { rows } = await pool.query(
        `select id from drm.product_posting_invoices
           where customer_id = $1
             and lower(coalesce(service_type, project_name, '')) = $2
             and coalesce(source_module, '') = coalesce($3, '')
             and coalesce(source_id, '') = coalesce($4, '')
             and status = any($5)
             and ($6::uuid is null or id <> $6::uuid)
           limit 1`,
        [
          input.customerId,
          key,
          input.sourceModule ?? "",
          input.sourceId ?? "",
          ACTIVE_STATUSES,
          input.excludeId ?? null,
        ],
      );
      return rows[0]?.id ?? null;
    } catch (err) {
      console.error("[invoice-workflow] duplicate check failed (fail-closed):", err);
      throw new ApiError(
        500,
        "INTERNAL_ERROR",
        "Could not verify invoice uniqueness; create blocked",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  static async create(
    actor: Actor,
    data: {
      customerId: string;
      amount: number;
      invoiceType?: InvoiceType;
      currency?: string;
      projectName?: string;
      serviceType?: string;
      servicePackage?: string;
      companyName?: string;
      gmId?: string;
      invoiceDate?: string;
      paymentTerms?: string;
      sourceModule?: string;
      sourceId?: string;
      notes?: string;
      status?: "DRAFT" | "PENDING_HOD";
      overrideDuplicate?: boolean;
      overrideReason?: string;
    },
    req?: Request,
  ) {
    await ensureInvoiceWorkflowSchema();

    // Canonical invoice type (closed enum) drives the project name / service
    // type so dedup and reporting key off a fixed vocabulary, not free text.
    const canonicalProjectName = data.invoiceType
      ? INVOICE_TYPE_TO_PRODUCT_NAME[data.invoiceType]
      : data.projectName ?? null;
    const canonicalServiceType =
      data.serviceType ??
      (data.invoiceType ? INVOICE_TYPE_TO_PRODUCT_NAME[data.invoiceType] : null);

    const existing = await this.findActiveDuplicate({
      customerId: data.customerId,
      serviceType: canonicalServiceType,
      projectName: canonicalProjectName,
      sourceModule: data.sourceModule,
      sourceId: data.sourceId,
    });

    if (existing) {
      if (!data.overrideDuplicate) {
        throw new ApiError(
          409,
          "CONFLICT",
          "An active invoice already exists for this customer, service and source",
          { duplicateInvoiceId: existing },
        );
      }
      if (!isOverrideRole(actor)) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "Only an admin or manager may override the duplicate check",
        );
      }
      if (!data.overrideReason || !data.overrideReason.trim()) {
        throw new ApiError(400, "BAD_REQUEST", "An override reason is required");
      }
    }

    const status = data.status || INVOICE_STATUS.PENDING_HOD;

    const [created] = await db
      .insert(productPostingInvoices)
      .values({
        amount: String(data.amount),
        salesExecId: actor.userId,
        customerId: data.customerId,
        projectName: canonicalProjectName,
        companyName: data.companyName ?? null,
        status,
        currency: data.currency ?? "USD",
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
        paymentTerms: data.paymentTerms ?? null,
        serviceType: canonicalServiceType,
        servicePackage: data.servicePackage ?? null,
        sourceModule: data.sourceModule ?? null,
        sourceId: data.sourceId ?? null,
        notes: data.notes ?? null,
        invoiceType: data.invoiceType ?? null,
        gmId: data.gmId ?? null,
        autoGenerated: false,
      })
      .returning();

    await AuditLogService.recordTransition({
      actorUserId: actor.userId,
      action: "INVOICE_CREATED",
      module: MODULE,
      entityType: ENTITY,
      entityId: created.id,
      previousStatus: undefined,
      nextStatus: status,
      reason: existing ? `Duplicate override: ${data.overrideReason}` : undefined,
      after: { amount: created.amount, currency: created.currency, status },
      req,
    });

    return created;
  }

  // ---------------------------------------------------------------------------
  // Submit DRAFT -> PENDING_HOD
  // ---------------------------------------------------------------------------
  static async submitToHod(actor: Actor, id: string, req?: Request) {
    const invoice = await this.requireInvoice(id);
    const isOwner = invoice.salesExecId === actor.userId;
    if (!isOwner && !isOverrideRole(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only the invoice owner or a manager may submit it");
    }
    assertTransition(invoice.status, INVOICE_STATUS.PENDING_HOD);
    return this.applyTransition(actor, invoice, INVOICE_STATUS.PENDING_HOD, {
      action: "INVOICE_SUBMITTED",
      notifyRoles: ["hod", "super_hod"],
      notifyMessage: `Invoice ${shortId(id)} submitted for HOD approval.`,
      targetUrl: "/hod/invoices",
      req,
    });
  }

  // ---------------------------------------------------------------------------
  // HOD decision
  // ---------------------------------------------------------------------------
  static async hodDecision(
    actor: Actor,
    id: string,
    action: "APPROVE" | "REJECT",
    reason: string | undefined,
    req?: Request,
  ) {
    const invoice = await this.requireInvoice(id);
    if (!isHodActor(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only an HOD may act on this stage");
    }
    if (invoice.status !== INVOICE_STATUS.PENDING_HOD) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        `This invoice is not awaiting HOD approval (status: ${invoice.status})`,
      );
    }
    if (action === "REJECT") {
      return this.reject(actor, invoice, reason, "HOD", req);
    }
    assertApprovalReadiness(invoice, "HOD");
    assertTransition(invoice.status, INVOICE_STATUS.PENDING_ACCOUNT);
    return this.applyTransition(actor, invoice, INVOICE_STATUS.PENDING_ACCOUNT, {
      action: "INVOICE_HOD_APPROVED",
      notifyRoles: ["account_manager"],
      notifyMessage: `Invoice ${shortId(id)} approved by HOD. Awaiting account approval.`,
      targetUrl: "/account/invoices",
      set: { hodApprovedBy: actor.userId, hodApprovedAt: new Date() },
      req,
    });
  }

  // ---------------------------------------------------------------------------
  // Account decision (+ PMS linkage on approve)
  // ---------------------------------------------------------------------------
  static async accountDecision(
    actor: Actor,
    id: string,
    action: "APPROVE" | "REJECT",
    reason: string | undefined,
    req?: Request,
  ) {
    const invoice = await this.requireInvoice(id);
    if (!isAccountActor(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only an account manager may act on this stage");
    }
    if (invoice.status !== INVOICE_STATUS.PENDING_ACCOUNT) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        `This invoice is not awaiting account approval (status: ${invoice.status})`,
      );
    }
    if (action === "REJECT") {
      const rejected = await this.reject(actor, invoice, reason, "Account", req);
      return { invoice: rejected, projectId: null as string | null };
    }
    assertApprovalReadiness(invoice, "Account");
    assertTransition(invoice.status, INVOICE_STATUS.APPROVED);
    const updated = await this.applyTransition(actor, invoice, INVOICE_STATUS.APPROVED, {
      action: "INVOICE_ACCOUNT_APPROVED",
      notifyUserId: invoice.salesExecId,
      notifyMessage: `Invoice ${shortId(id)} fully approved and queued for project creation.`,
      notifyType: "SUCCESS",
      targetUrl: "/pms/approvals?tab=invoices",
      set: { accountsApprovedBy: actor.userId, accountsApprovedAt: new Date() },
      req,
    });

    // PMS linkage: the invoice now appears in the existing pending-project queue
    // (projectsRepository.findPendingInvoices filters status='APPROVED' with no
    // project). Notify PMS managers; surface any existing project link.
    let projectLink = await this.findProjectLink(id);
    await NotificationService.notifyWorkflowTransition({
      message: `New approved invoice ${shortId(id)} is ready for project creation.`,
      type: "INFO",
      recipientRoles: ["product_posting_manager", "software_manager", "dd_manager"],
      module: MODULE,
      entityType: ENTITY,
      entityId: id,
      targetUrl: "/pms/approvals?tab=invoices",
    });

    // Patch 5 Stage 5 (P9): standardized invoice -> project generation. Only fires
    // when projectGenerationMode is AUTOMATIC; the default (MANUAL) preserves the
    // existing PMS pending-invoices queue untouched. Best-effort and idempotent —
    // the service creates-or-links a single INVOICE_ROOT project and never throws,
    // so approval cannot break if generation hiccups.
    try {
      const mode = await getConfigValue("projectGenerationMode");
      if (mode === PROJECT_GENERATION_MODE.AUTOMATIC) {
        const gen = await createOrLinkProjectForApprovedInvoice({
          invoiceId: id,
          actorUserId: actor.userId,
          req,
        });
        if (gen.ok && gen.projectId) projectLink = gen.projectId;
      }
    } catch (genErr) {
      console.error("[invoice-workflow] automatic project generation failed (best-effort):", genErr);
    }

    return { invoice: updated, projectId: projectLink };
  }

  // ---------------------------------------------------------------------------
  // Patch 5 Stage 6 (P14) — tx-aware decision EXECUTORS for the central
  // WorkflowStatusService. Each performs ONLY the validated invoice STATE WRITE
  // on the supplied transaction client (status + the approval/rejection audit
  // columns), re-reading the row `FOR UPDATE` inside the tx for race-safety, and
  // returns the prev/next status + a minimal updated entity. They are
  // deliberately SIDE-EFFECT FREE: history, the activity-log audit, notifications
  // and project generation are owned by the caller (central service + route) so
  // these compose atomically inside one transaction. Role / legal-transition are
  // re-asserted here as defense-in-depth on top of the central service's checks.
  // ---------------------------------------------------------------------------
  private static async loadInvoiceForUpdateTx(
    client: PoolClient,
    id: string,
  ): Promise<{
    id: string;
    status: string;
    sales_exec_id: string | null;
    customer_id: string | null;
    amount: string | null;
    invoice_type: string | null;
    service_type: string | null;
    project_name: string | null;
  }> {
    const { rows } = await client.query(
      `SELECT id, status, sales_exec_id, customer_id, amount,
              invoice_type, service_type, project_name
         FROM drm.product_posting_invoices
        WHERE id = $1
        FOR UPDATE`,
      [id],
    );
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Invoice not found");
    return rows[0];
  }

  static async approveByHodTx(
    client: PoolClient,
    actor: Actor,
    id: string,
  ): Promise<InvoiceTxResult> {
    const inv = await this.loadInvoiceForUpdateTx(client, id);
    if (!isHodActor(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only an HOD may act on this stage");
    }
    if (inv.status !== INVOICE_STATUS.PENDING_HOD) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        `This invoice is not awaiting HOD approval (status: ${inv.status})`,
      );
    }
    assertApprovalReadiness(rowToReadinessShape(inv), "HOD");
    assertTransition(inv.status, INVOICE_STATUS.PENDING_ACCOUNT);
    const { rows } = await client.query(
      `UPDATE drm.product_posting_invoices
          SET status = $2, hod_approved_by = $3::uuid, hod_approved_at = now(),
              updated_at = now()
        WHERE id = $1
        RETURNING id, status, sales_exec_id`,
      [id, INVOICE_STATUS.PENDING_ACCOUNT, actor.userId],
    );
    return txInvoiceResult(inv.status, rows[0]);
  }

  static async approveByAccountTx(
    client: PoolClient,
    actor: Actor,
    id: string,
  ): Promise<InvoiceTxResult> {
    const inv = await this.loadInvoiceForUpdateTx(client, id);
    if (!isAccountActor(actor)) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only an account manager may act on this stage",
      );
    }
    if (inv.status !== INVOICE_STATUS.PENDING_ACCOUNT) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        `This invoice is not awaiting account approval (status: ${inv.status})`,
      );
    }
    assertApprovalReadiness(rowToReadinessShape(inv), "Account");
    assertTransition(inv.status, INVOICE_STATUS.APPROVED);
    const { rows } = await client.query(
      `UPDATE drm.product_posting_invoices
          SET status = $2, accounts_approved_by = $3::uuid,
              accounts_approved_at = now(), updated_at = now()
        WHERE id = $1
        RETURNING id, status, sales_exec_id`,
      [id, INVOICE_STATUS.APPROVED, actor.userId],
    );
    return txInvoiceResult(inv.status, rows[0]);
  }

  static async rejectByStageTx(
    client: PoolClient,
    actor: Actor,
    id: string,
    reason: string | undefined,
    stage: "HOD" | "Account",
  ): Promise<InvoiceTxResult> {
    const inv = await this.loadInvoiceForUpdateTx(client, id);
    const roleOk = stage === "HOD" ? isHodActor(actor) : isAccountActor(actor);
    if (!roleOk) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        stage === "HOD"
          ? "Only an HOD may act on this stage"
          : "Only an account manager may act on this stage",
      );
    }
    const expected =
      stage === "HOD"
        ? INVOICE_STATUS.PENDING_HOD
        : INVOICE_STATUS.PENDING_ACCOUNT;
    if (inv.status !== expected) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        `This invoice is not awaiting ${stage} approval (status: ${inv.status})`,
      );
    }
    if (!reason || !reason.trim()) {
      throw new ApiError(400, "BAD_REQUEST", "A rejection reason is required");
    }
    assertTransition(inv.status, INVOICE_STATUS.REJECTED);
    const { rows } = await client.query(
      `UPDATE drm.product_posting_invoices
          SET status = $2, rejection_reason = $3, rejected_by = $4::uuid,
              rejected_at = now(), updated_at = now()
        WHERE id = $1
        RETURNING id, status, sales_exec_id`,
      [id, INVOICE_STATUS.REJECTED, reason, actor.userId],
    );
    return txInvoiceResult(inv.status, rows[0]);
  }

  // ---------------------------------------------------------------------------
  // Mark paid (APPROVED -> PAID)
  // ---------------------------------------------------------------------------
  static async markPaid(
    actor: Actor,
    id: string,
    data: {
      paymentMethod: string;
      receiptReference: string;
      paidAmount: number;
      paidDate?: string;
      notes?: string;
    },
    req?: Request,
  ) {
    const invoice = await this.requireInvoice(id);
    if (!isAccountActor(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only an account manager may record a payment");
    }
    if (invoice.status !== INVOICE_STATUS.APPROVED) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        `Only an APPROVED invoice can be marked paid (status: ${invoice.status})`,
      );
    }
    assertTransition(invoice.status, INVOICE_STATUS.PAID);

    const invoiceAmount = num(invoice.amount);
    if (Math.abs(num(data.paidAmount) - invoiceAmount) > 0.01) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `Paid amount (${data.paidAmount}) must reconcile with the invoice amount (${invoiceAmount})`,
      );
    }

    const [updated] = await db
      .update(productPostingInvoices)
      .set({
        status: INVOICE_STATUS.PAID,
        paymentMethod: data.paymentMethod,
        receiptReference: data.receiptReference,
        paidAmount: String(data.paidAmount),
        paidDate: data.paidDate ? new Date(data.paidDate) : new Date(),
        notes: data.notes ?? invoice.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(productPostingInvoices.id, id))
      .returning();

    await AuditLogService.recordTransition({
      actorUserId: actor.userId,
      action: "INVOICE_MARKED_PAID",
      module: MODULE,
      entityType: ENTITY,
      entityId: id,
      previousStatus: invoice.status,
      nextStatus: INVOICE_STATUS.PAID,
      before: { status: invoice.status },
      after: {
        status: INVOICE_STATUS.PAID,
        paymentMethod: data.paymentMethod,
        receiptReference: data.receiptReference,
        paidAmount: data.paidAmount,
      },
      req,
    });

    if (invoice.salesExecId) {
      await NotificationService.notify({
        userId: invoice.salesExecId,
        message: `Payment recorded for invoice ${shortId(id)}.`,
        type: "SUCCESS",
      });
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Cancel
  // ---------------------------------------------------------------------------
  static async cancel(actor: Actor, id: string, reason: string, req?: Request) {
    const invoice = await this.requireInvoice(id);
    const isOwner = invoice.salesExecId === actor.userId;
    if (!isOwner && !isOverrideRole(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only the invoice owner or a manager may cancel it");
    }
    assertTransition(invoice.status, INVOICE_STATUS.CANCELLED);
    return this.applyTransition(actor, invoice, INVOICE_STATUS.CANCELLED, {
      action: "INVOICE_CANCELLED",
      reason,
      notifyUserId: invoice.salesExecId,
      notifyMessage: `Invoice ${shortId(id)} was cancelled. Reason: ${reason}`,
      notifyType: "WARNING",
      req,
    });
  }

  // ---------------------------------------------------------------------------
  // Edit (field protection / whitelist per status)
  // ---------------------------------------------------------------------------
  static async patch(
    actor: Actor,
    id: string,
    data: Record<string, unknown>,
    req?: Request,
  ) {
    const invoice = await this.requireInvoice(id);
    const isOwner = invoice.salesExecId === actor.userId;
    const admin = isAdmin(actor);

    // Locked once finalized: only an admin may correct an APPROVED/PAID/REJECTED/
    // CANCELLED invoice, and it is fully audited.
    const locked = ([
      INVOICE_STATUS.APPROVED,
      INVOICE_STATUS.PAID,
      INVOICE_STATUS.REJECTED,
      INVOICE_STATUS.CANCELLED,
    ] as string[]).includes(invoice.status);

    if (locked && !admin) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        `A ${invoice.status} invoice cannot be edited (admin correction only)`,
      );
    }

    if (!locked && !isOwner && !isOverrideRole(actor)) {
      throw new ApiError(403, "FORBIDDEN", "Only the invoice owner or a manager may edit it");
    }

    // Whitelist of editable fields by status. DRAFT/PENDING_HOD allow the most;
    // PENDING_ACCOUNT only notes; admin on a locked invoice may also correct
    // financial fields as a correction.
    let allowed: string[];
    if (invoice.status === INVOICE_STATUS.DRAFT || invoice.status === INVOICE_STATUS.PENDING_HOD) {
      allowed = [
        "amount",
        "currency",
        "projectName",
        "serviceType",
        "servicePackage",
        "companyName",
        "invoiceDate",
        "paymentTerms",
        "notes",
      ];
      // Separation of duties: once an invoice is awaiting HOD approval, a
      // reviewing HOD / manager (anyone who is not the sales owner or an admin)
      // may NOT change the financial amount or currency during approval. The
      // sales owner can still correct figures; an admin retains full correction.
      if (invoice.status === INVOICE_STATUS.PENDING_HOD && !isOwner && !admin) {
        allowed = allowed.filter((f) => f !== "amount" && f !== "currency");
      }
    } else if (invoice.status === INVOICE_STATUS.PENDING_ACCOUNT) {
      allowed = admin
        ? ["amount", "currency", "paymentTerms", "notes"]
        : ["notes"];
    } else {
      // locked + admin
      allowed = ["amount", "currency", "paymentTerms", "notes", "projectName", "companyName"];
    }

    const update: Record<string, unknown> = {};
    const changed: Record<string, unknown> = {};
    for (const field of allowed) {
      const value = data[field];
      if (value === undefined) continue;
      if (field === "amount" || field === "paidAmount") {
        update[field] = String(value);
      } else if (field === "invoiceDate") {
        update[field] = value ? new Date(String(value)) : null;
      } else {
        update[field] = value;
      }
      changed[field] = value;
    }

    if (Object.keys(update).length === 0) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `No editable fields for a ${invoice.status} invoice were provided`,
      );
    }

    const [updated] = await db
      .update(productPostingInvoices)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(productPostingInvoices.id, id))
      .returning();

    await AuditLogService.record({
      actorUserId: actor.userId,
      action: "INVOICE_EDITED",
      module: MODULE,
      entityType: ENTITY,
      entityId: id,
      reason: typeof data.reason === "string" ? data.reason : undefined,
      before: { status: invoice.status },
      after: { changedFields: Object.keys(changed), ...changed },
      req,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Queues / history / export
  // ---------------------------------------------------------------------------
  static async queue(status: InvoiceStatus) {
    await ensureInvoiceWorkflowSchema();
    return db
      .select()
      .from(productPostingInvoices)
      .where(eq(productPostingInvoices.status, status))
      .orderBy(desc(productPostingInvoices.createdAt));
  }

  static async list(actor: Actor) {
    await ensureInvoiceWorkflowSchema();
    if (hasAnyRole(actor, "sales_executive") && !isOverrideRole(actor) && !isHodActor(actor)) {
      return db
        .select()
        .from(productPostingInvoices)
        .where(eq(productPostingInvoices.salesExecId, actor.userId))
        .orderBy(desc(productPostingInvoices.createdAt));
    }
    return db
      .select()
      .from(productPostingInvoices)
      .orderBy(desc(productPostingInvoices.createdAt));
  }

  static async history(id: string) {
    await this.requireInvoice(id);
    const logs = await AuditLogService.getHistory(ENTITY, id);
    return logs
      .map((log: any) => {
        let context: any = {};
        if (log.details) {
          try {
            context = JSON.parse(log.details);
          } catch {
            context = { note: log.details };
          }
        }
        return {
          id: log.id,
          action: log.action,
          actorUserId: log.userId,
          previousStatus: context.previousStatus ?? null,
          nextStatus: context.nextStatus ?? null,
          reason: context.reason ?? null,
          changedFields: context.after?.changedFields ?? null,
          createdAt: log.createdAt,
        };
      })
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  }

  static async exportInvoice(id: string) {
    const invoice = await this.requireInvoice(id);
    const history = await this.history(id);
    const projectId = await this.findProjectLink(id);
    return { invoice, history, projectId, exportedAt: new Date().toISOString() };
  }

  /**
   * Actor-scoped collection export. Returns exactly the same set of invoices the
   * caller can see via list() (sales execs see only their own) — it never widens
   * access — wrapped with an export timestamp.
   */
  static async exportList(actor: Actor) {
    const invoices = await this.list(actor);
    return { invoices, count: invoices.length, exportedAt: new Date().toISOString() };
  }

  static async findProjectLink(invoiceId: string): Promise<string | null> {
    try {
      const [row] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.invoiceId, invoiceId))
        .limit(1);
      return row?.id ?? null;
    } catch (err) {
      console.error("[invoice-workflow] findProjectLink failed:", err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Shared internals
  // ---------------------------------------------------------------------------
  private static async reject(
    actor: Actor,
    invoice: typeof productPostingInvoices.$inferSelect,
    reason: string | undefined,
    stage: string,
    req?: Request,
  ) {
    if (!reason || !reason.trim()) {
      throw new ApiError(400, "BAD_REQUEST", "A rejection reason is required");
    }
    assertTransition(invoice.status, INVOICE_STATUS.REJECTED);
    const [updated] = await db
      .update(productPostingInvoices)
      .set({
        status: INVOICE_STATUS.REJECTED,
        rejectionReason: reason,
        rejectedBy: actor.userId,
        rejectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(productPostingInvoices.id, invoice.id))
      .returning();

    await AuditLogService.recordTransition({
      actorUserId: actor.userId,
      action: "INVOICE_REJECTED",
      module: MODULE,
      entityType: ENTITY,
      entityId: invoice.id,
      previousStatus: invoice.status,
      nextStatus: INVOICE_STATUS.REJECTED,
      reason,
      before: { status: invoice.status },
      after: { status: INVOICE_STATUS.REJECTED, stage },
      req,
    });

    if (invoice.salesExecId) {
      await NotificationService.notify({
        userId: invoice.salesExecId,
        message: `Your invoice ${shortId(invoice.id)} was rejected at the ${stage} stage. Reason: ${reason}`,
        type: "ERROR",
      });
    }

    return updated;
  }

  private static async applyTransition(
    actor: Actor,
    invoice: typeof productPostingInvoices.$inferSelect,
    next: InvoiceStatus,
    opts: {
      action: string;
      reason?: string;
      notifyUserId?: string | null;
      notifyRoles?: string[];
      notifyMessage?: string;
      notifyType?: "INFO" | "WARNING" | "SUCCESS" | "ERROR";
      targetUrl?: string;
      /** Extra columns to set alongside the status (e.g. approval audit fields). */
      set?: Record<string, unknown>;
      req?: Request;
    },
  ) {
    const [updated] = await db
      .update(productPostingInvoices)
      .set({ status: next, updatedAt: new Date(), ...(opts.set ?? {}) })
      .where(eq(productPostingInvoices.id, invoice.id))
      .returning();

    await AuditLogService.recordTransition({
      actorUserId: actor.userId,
      action: opts.action,
      module: MODULE,
      entityType: ENTITY,
      entityId: invoice.id,
      previousStatus: invoice.status,
      nextStatus: next,
      reason: opts.reason,
      before: { status: invoice.status },
      after: { status: next },
      req: opts.req,
    });

    if (opts.notifyMessage) {
      if (opts.notifyUserId) {
        await NotificationService.notify({
          userId: opts.notifyUserId,
          message: opts.notifyMessage,
          type: opts.notifyType || "INFO",
          targetUrl: opts.targetUrl,
        });
      }
      if (opts.notifyRoles && opts.notifyRoles.length > 0) {
        await NotificationService.notifyWorkflowTransition({
          message: opts.notifyMessage,
          type: opts.notifyType || "INFO",
          recipientRoles: opts.notifyRoles,
          module: MODULE,
          entityType: ENTITY,
          entityId: invoice.id,
          targetUrl: opts.targetUrl,
        });
      }
    }

    return updated;
  }
}

function shortId(id: string): string {
  return `INV-${String(id).substring(0, 6)}`;
}

export default InvoiceWorkflowService;
