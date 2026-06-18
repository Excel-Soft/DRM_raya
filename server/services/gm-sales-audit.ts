/**
 * Patch 5 — GM/Sales audit foundation.
 *
 * Thin wrapper over the existing `AuditLogService` (which reuses
 * `drm.activity_logs`). It provides a controlled set of action strings so every
 * future GM/Sales transition logs a consistent, queryable action, and a helper
 * to derive the actor/role from the request.
 *
 * SECURITY: never pass secrets, password hashes or tokens in before/after.
 */
import type { Request } from "express";
import AuditLogService from "./audit-log.service";

export const GM_SALES_AUDIT_ACTIONS = {
  GM_CREATE: "gm.create",
  GM_TYPE_CHANGE: "gm.type_change",
  GM_TYPE_SET: "gm.type_set",
  GM_TYPE_CHANGE_DENIED: "gm.type_change_denied",
  GM_THRESHOLD_VALIDATION_FAILED: "gm.threshold_validation_failed",
  GM_CREATE_UNAUTHORIZED_ATTEMPT: "gm.create_unauthorized_attempt",
  GM_SUBMIT: "gm.submit",
  GM_APPROVE: "gm.approve",
  GM_REJECT: "gm.reject",
  GM_PARTIAL_RECEIPT_ADD: "gm.partial_receipt_add",
  GM_PARTIAL_FINAL_APPROVE: "gm.partial_final_approve",
  GM_LOAN_TERMS_ADD: "gm.loan_terms_add",
  GM_LOAN_ADMIN_APPROVE: "gm.loan_admin_approve",
  GM_LOAN_RETURN_UPDATE: "gm.loan_return_update",
  INVOICE_AUTO_GENERATE: "invoice.auto_generate",
  INVOICE_MANUAL_CREATE: "invoice.manual_create",
  INVOICE_HOD_APPROVE: "invoice.hod_approve",
  INVOICE_HOD_REJECT: "invoice.hod_reject",
  INVOICE_ACCOUNT_APPROVE: "invoice.account_approve",
  INVOICE_ACCOUNT_REJECT: "invoice.account_reject",
  INVOICE_PROJECT_GENERATE: "invoice.project_generate",
  PRODUCT_POSTING_DEPENDENCY_LOCKED: "product_posting.dependency_locked",
  PRODUCT_POSTING_DEPENDENCY_UNLOCKED: "product_posting.dependency_unlocked",
  WORKFLOW_TRANSITION: "workflow.transition",
  /** Not a workflow action, but config changes should be auditable too. */
  CONFIG_UPDATE: "gm_sales.config_update",
} as const;

export type GmSalesAuditAction =
  (typeof GM_SALES_AUDIT_ACTIONS)[keyof typeof GM_SALES_AUDIT_ACTIONS];

/** Derive a safe actor descriptor from the request. */
export function auditActorFromReq(
  req?: Request,
): { actorUserId?: string; activeRole?: string } {
  const user = req?.user as
    | { userId?: string; activeRoleId?: string; roleId?: string }
    | undefined;
  if (!user) return {};
  return {
    actorUserId: user.userId,
    activeRole: user.activeRoleId ?? user.roleId,
  };
}

export interface GmSalesAuditInput {
  action: GmSalesAuditAction;
  entityType: string;
  entityId: string;
  module?: string;
  actorUserId?: string;
  activeRole?: string;
  previousStatus?: string;
  nextStatus?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  req?: Request;
}

/** Record a GM/Sales audit event. Best-effort: never throws to the caller. */
export async function recordGmSalesAudit(input: GmSalesAuditInput): Promise<void> {
  const actor = auditActorFromReq(input.req);
  try {
    await AuditLogService.record({
      action: input.action,
      module: input.module ?? "gm_sales",
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId: input.actorUserId ?? actor.actorUserId,
      activeRole: input.activeRole ?? actor.activeRole,
      previousStatus: input.previousStatus,
      nextStatus: input.nextStatus,
      before: input.before,
      after: input.after,
      reason: input.reason,
      req: input.req,
    });
  } catch (err) {
    // Auditing must never break the business action it accompanies.
    console.warn(
      `[gm-sales-audit] failed to record "${input.action}":`,
      (err as Error)?.message ?? err,
    );
  }
}
