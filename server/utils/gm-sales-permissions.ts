/**
 * Patch 5 — GM/Sales action permission helper.
 *
 * `requireGmSalesActionPermission(actionKey, options)` returns Express middleware
 * that enforces, server-side:
 *   - a static baseline role map per action,
 *   - config-driven initiator roles for GM-create / manual-invoice actions,
 *   - optional ownership / status gates (callbacks supplied by the caller).
 *
 * It fails CLOSED: unauthenticated => 401, unknown/disallowed role => 403, and a
 * config-load error => 503 unless `failOpenOnConfigError` is explicitly set.
 * `admin` always passes. Responses use the Patch 5 error envelope.
 *
 * STAGE 1: this helper is provided for new GM/Sales endpoints. It is NOT attached
 * to existing GM/invoice routes yet (that happens in later, confirmed stages).
 */
import type { Request, Response, NextFunction } from "express";
import { ROLES, normalizeRole } from "./role-utils";
import { sendError } from "./api-response";
import { getConfig } from "../services/gm-sales-config.service";
import { recordGmSalesAudit, GM_SALES_AUDIT_ACTIONS } from "../services/gm-sales-audit";
import type { GmSalesConfig } from "../../shared/gm-sales-constants";

export const GM_SALES_ACTION_KEYS = {
  GM_CREATE: "gm.create",
  GM_CREATE_FULL: "gm.create.full",
  GM_CREATE_PARTIAL: "gm.create.partial",
  GM_CREATE_LOAN: "gm.create.loan",
  GM_CREATE_ACCOUNT: "gm.create.account",
  GM_EDIT: "gm.edit",
  GM_SUBMIT: "gm.submit",
  GM_APPROVE_HOD: "gm.approve.hod",
  GM_APPROVE_ACCOUNTS: "gm.approve.accounts",
  GM_APPROVE_ADMIN: "gm.approve.admin",
  GM_APPROVE_SALES_MANAGER: "gm.approve.sales_manager",
  GM_DELETE: "gm.delete",
  GM_FIX_STATUS: "gm.fix_status",
  GM_ADD_PARTIAL_RECEIPT: "gm.add_partial_receipt",
  GM_FINALIZE_PARTIAL: "gm.finalize_partial",
  GM_UPDATE_LOAN_RETURN: "gm.update_loan_return",
  INVOICE_MANUAL_CREATE: "invoice.manual_create",
  INVOICE_AUTO_GENERATE: "invoice.auto_generate",
  INVOICE_HOD_APPROVE: "invoice.hod_approve",
  INVOICE_HOD_REJECT: "invoice.hod_reject",
  INVOICE_ACCOUNT_APPROVE: "invoice.account_approve",
  INVOICE_ACCOUNT_REJECT: "invoice.account_reject",
  INVOICE_MARK_PAID: "invoice.mark_paid",
  INVOICE_GENERATE_PROJECT: "invoice.generate_project",
  PRODUCT_POSTING_ASSIGN_WHEN_DEPENDENCY_MET: "product_posting.assign_when_dependency_met",
} as const;

export type GmSalesActionKey =
  (typeof GM_SALES_ACTION_KEYS)[keyof typeof GM_SALES_ACTION_KEYS];

/** Conservative baseline role rules (foundation defaults). */
const STATIC_ROLE_RULES: Record<string, string[]> = {
  [GM_SALES_ACTION_KEYS.GM_EDIT]: [ROLES.SALES_EXECUTIVE, ROLES.SALES_MANAGER, ROLES.SALES_ASSISTANT_MANAGER],
  [GM_SALES_ACTION_KEYS.GM_SUBMIT]: [ROLES.SALES_EXECUTIVE, ROLES.SALES_MANAGER, ROLES.SALES_ASSISTANT_MANAGER],
  [GM_SALES_ACTION_KEYS.GM_APPROVE_HOD]: [ROLES.HOD, ROLES.SUPER_HOD],
  [GM_SALES_ACTION_KEYS.GM_APPROVE_ACCOUNTS]: [ROLES.ACCOUNT_MANAGER],
  [GM_SALES_ACTION_KEYS.GM_APPROVE_ADMIN]: [ROLES.SUPER_HOD],
  // Patch 7 Stage 2: distinct sales-manager approval stage; delete is a sales-owner
  // action (matches the gm-pool UI). fix-status is admin-only break-glass (empty set
  // => only the admin bypass passes).
  [GM_SALES_ACTION_KEYS.GM_APPROVE_SALES_MANAGER]: [ROLES.SALES_MANAGER],
  [GM_SALES_ACTION_KEYS.GM_DELETE]: [ROLES.SALES_EXECUTIVE, ROLES.SALES_MANAGER, ROLES.SALES_ASSISTANT_MANAGER],
  [GM_SALES_ACTION_KEYS.GM_FIX_STATUS]: [],
  [GM_SALES_ACTION_KEYS.GM_ADD_PARTIAL_RECEIPT]: [ROLES.SALES_EXECUTIVE, ROLES.SALES_MANAGER, ROLES.ACCOUNT_MANAGER],
  [GM_SALES_ACTION_KEYS.GM_FINALIZE_PARTIAL]: [ROLES.ACCOUNT_MANAGER, ROLES.HOD, ROLES.SUPER_HOD],
  [GM_SALES_ACTION_KEYS.GM_UPDATE_LOAN_RETURN]: [ROLES.ACCOUNT_MANAGER, ROLES.SALES_MANAGER],
  [GM_SALES_ACTION_KEYS.INVOICE_AUTO_GENERATE]: [],
  [GM_SALES_ACTION_KEYS.INVOICE_HOD_APPROVE]: [ROLES.HOD, ROLES.SUPER_HOD],
  [GM_SALES_ACTION_KEYS.INVOICE_HOD_REJECT]: [ROLES.HOD, ROLES.SUPER_HOD],
  [GM_SALES_ACTION_KEYS.INVOICE_ACCOUNT_APPROVE]: [ROLES.ACCOUNT_MANAGER],
  [GM_SALES_ACTION_KEYS.INVOICE_ACCOUNT_REJECT]: [ROLES.ACCOUNT_MANAGER],
  [GM_SALES_ACTION_KEYS.INVOICE_MARK_PAID]: [ROLES.ACCOUNT_MANAGER],
  [GM_SALES_ACTION_KEYS.INVOICE_GENERATE_PROJECT]: [ROLES.ACCOUNT_MANAGER, ROLES.HOD, ROLES.SUPER_HOD],
  [GM_SALES_ACTION_KEYS.PRODUCT_POSTING_ASSIGN_WHEN_DEPENDENCY_MET]: [
    ROLES.PRODUCT_POSTING_MANAGER,
    ROLES.HOD,
    ROLES.SUPER_HOD,
  ],
};

/** Resolve the effective allowed-role set for an action, merging config rules. */
export function resolveAllowedRoles(
  actionKey: string,
  config: GmSalesConfig,
): string[] {
  const base = [...(STATIC_ROLE_RULES[actionKey] ?? [])];

  switch (actionKey) {
    case GM_SALES_ACTION_KEYS.GM_CREATE:
      // Coarse entry gate for POST /api/gm: admit anyone allowed to initiate ANY
      // GM type. The route handler narrows to the resolved type's specific list
      // once the canonical type is known. Union keeps defaults a no-op.
      base.push(
        ...config.fullGmAllowedInitiatorRoles,
        ...config.partialGmAllowedInitiatorRoles,
        ...config.loanGmAllowedInitiatorRoles,
      );
      if (config.serviceExecutiveCanCreateGM) base.push(ROLES.SERVICE_EXECUTIVE);
      base.push(...config.gmCreateOverrideRoles);
      break;
    case GM_SALES_ACTION_KEYS.GM_CREATE_FULL:
      base.push(...config.fullGmAllowedInitiatorRoles);
      if (config.serviceExecutiveCanCreateGM) base.push(ROLES.SERVICE_EXECUTIVE);
      base.push(...config.gmCreateOverrideRoles);
      break;
    case GM_SALES_ACTION_KEYS.GM_CREATE_PARTIAL:
      base.push(...config.partialGmAllowedInitiatorRoles);
      if (config.serviceExecutiveCanCreateGM) base.push(ROLES.SERVICE_EXECUTIVE);
      base.push(...config.gmCreateOverrideRoles);
      break;
    case GM_SALES_ACTION_KEYS.GM_CREATE_LOAN:
      base.push(...config.loanGmAllowedInitiatorRoles);
      if (config.serviceExecutiveCanCreateGM) base.push(ROLES.SERVICE_EXECUTIVE);
      base.push(...config.gmCreateOverrideRoles);
      break;
    case GM_SALES_ACTION_KEYS.GM_CREATE_ACCOUNT:
      base.push(...config.accountGmAllowedInitiatorRoles);
      base.push(...config.gmCreateOverrideRoles);
      break;
    case GM_SALES_ACTION_KEYS.INVOICE_MANUAL_CREATE:
      base.push(ROLES.SALES_MANAGER, ROLES.ACCOUNT_MANAGER);
      if (config.serviceExecutiveCanCreateManualInvoice) base.push(ROLES.SERVICE_EXECUTIVE);
      break;
    default:
      break;
  }

  return Array.from(new Set(base.map((r) => normalizeRole(r))));
}

export interface GmSalesPermissionOptions {
  /** Fail open (allow) if config can't be loaded. Default false (fail closed). */
  failOpenOnConfigError?: boolean;
  /** Return true if the current user owns / manages the target record. */
  checkOwnership?: (req: Request) => boolean | Promise<boolean>;
  /** Return true if the action is valid in the current record status/stage. */
  checkStatus?: (req: Request) => boolean | Promise<boolean>;
  /** When true, a role-denied (403) attempt is recorded as an audit event. */
  auditUnauthorizedAttempt?: boolean;
  /** Entity type used for the unauthorized-attempt audit (default "gm_entry"). */
  auditEntityType?: string;
}

export function requireGmSalesActionPermission(
  actionKey: GmSalesActionKey,
  options: GmSalesPermissionOptions = {},
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
    }

    const role = normalizeRole(
      (req.user as { activeRoleId?: string; roleId?: string }).activeRoleId ??
        (req.user as { roleId?: string }).roleId ??
        "",
    );

    if (role === ROLES.ADMIN) return next(); // admin bypass

    let config: GmSalesConfig;
    try {
      config = (await getConfig()).config;
    } catch {
      if (options.failOpenOnConfigError) return next();
      return sendError(res, 503, "CONFIG_UNAVAILABLE", "Workflow configuration is unavailable");
    }

    const allowed = resolveAllowedRoles(actionKey, config);
    if (!allowed.includes(role)) {
      if (options.auditUnauthorizedAttempt) {
        void recordGmSalesAudit({
          action: GM_SALES_AUDIT_ACTIONS.GM_CREATE_UNAUTHORIZED_ATTEMPT,
          entityType: options.auditEntityType ?? "gm_entry",
          entityId: "n/a",
          reason: `Role "${role}" is not permitted to perform ${actionKey}`,
          after: { action: actionKey, role },
          req,
        });
      }
      return sendError(res, 403, "FORBIDDEN", "You do not have permission to perform this action", {
        action: actionKey,
      });
    }

    try {
      if (options.checkOwnership && !(await options.checkOwnership(req))) {
        return sendError(res, 403, "FORBIDDEN_OWNERSHIP", "You can only act on records you own or manage", {
          action: actionKey,
        });
      }
      if (options.checkStatus && !(await options.checkStatus(req))) {
        return sendError(res, 409, "INVALID_STATE", "Action is not allowed in the current status", {
          action: actionKey,
        });
      }
    } catch {
      return sendError(res, 500, "PERMISSION_CHECK_FAILED", "Permission check failed");
    }

    return next();
  };
}

/** Collect every role the user carries (roleId, activeRoleId, roles[]), normalized. */
function collectUserRoles(user: unknown): Set<string> {
  const u = (user ?? {}) as { roleId?: string; activeRoleId?: string; roles?: string[] };
  const raw = [u.roleId, u.activeRoleId, ...(u.roles ?? [])].filter(Boolean) as string[];
  return new Set(raw.map((r) => normalizeRole(r)));
}

export interface ManualInvoiceCreatorOptions {
  /** Extra roles permitted in addition to the canonical sales set (e.g. the
   *  legacy accounts endpoint also allows account_manager). */
  extraAllowedRoles?: string[];
  /** Entity type used for the unauthorized-attempt audit (default "invoice"). */
  auditEntityType?: string;
}

/**
 * Manual invoice creation gate (Patch 5 Stage 4, P7).
 *
 * Preserves the canonical route's existing allowed set — sales_executive,
 * sales_manager, admin — while adding the policy that a service_executive may
 * create manual invoices ONLY when `serviceExecutiveCanCreateManualInvoice` is
 * enabled. Reads roles the same permissive way the legacy `requireRole` and the
 * invoice service do (roleId / activeRoleId / roles[]), so no existing caller
 * loses access. Every denial is audited. Fails CLOSED on config-load error.
 */
export function requireManualInvoiceCreator(options: ManualInvoiceCreatorOptions = {}) {
  const entityType = options.auditEntityType ?? "invoice";
  const extra = new Set((options.extraAllowedRoles ?? []).map((r) => normalizeRole(r)));

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
    }

    const roles = collectUserRoles(req.user);
    const auditedDeny = (reason: string) => {
      void recordGmSalesAudit({
        action: GM_SALES_AUDIT_ACTIONS.GM_CREATE_UNAUTHORIZED_ATTEMPT,
        entityType,
        entityId: "n/a",
        reason,
        after: { action: GM_SALES_ACTION_KEYS.INVOICE_MANUAL_CREATE, roles: Array.from(roles) },
        req,
      });
      return sendError(res, 403, "FORBIDDEN", "You do not have permission to create invoices", {
        action: GM_SALES_ACTION_KEYS.INVOICE_MANUAL_CREATE,
      });
    };

    if (roles.has(ROLES.ADMIN)) return next();
    if (roles.has(ROLES.SALES_EXECUTIVE) || roles.has(ROLES.SALES_MANAGER)) return next();
    for (const r of Array.from(extra)) {
      if (roles.has(r)) return next();
    }

    // service_executive is admitted only when the config flag is on.
    if (roles.has(ROLES.SERVICE_EXECUTIVE)) {
      let config: GmSalesConfig;
      try {
        config = (await getConfig()).config;
      } catch {
        return sendError(res, 503, "CONFIG_UNAVAILABLE", "Workflow configuration is unavailable");
      }
      if (config.serviceExecutiveCanCreateManualInvoice) return next();
      return auditedDeny(
        "Service Executive manual invoice creation is disabled (serviceExecutiveCanCreateManualInvoice=false)",
      );
    }

    return auditedDeny(`Roles [${Array.from(roles).join(", ")}] may not create manual invoices`);
  };
}
