import {
  requireActionPermission,
  type ActionPermissionOptions,
} from "./action-permission";
import { ROLES } from "../utils/role-utils";

/**
 * Office Accounts financial-permission guard (PATCH 4 Stage 1).
 *
 * A thin, financial-specific wrapper around the existing, fail-closed
 * `requireActionPermission`. It exists so every money-handling WRITE action
 * (create / edit / delete / status-change / export) is gated through one
 * consistent, auditable place with a sensible default role policy.
 *
 * Default policy: only Admins and Account Managers may mutate financial
 * records. Call sites may widen/narrow by passing `roles` and/or `allowRole`
 * (e.g. `allowRole: isManagerialRole` for approval-style actions).
 *
 * Fails CLOSED: unauthenticated -> 401; role not permitted -> 403. Role
 * comparison is done after `normalizeRole()` on both sides (handled by the
 * underlying guard), and `req.user.roleId/activeRoleId` are already normalized
 * role slugs by the auth middleware.
 */

export const FINANCIAL_WRITE_ROLES: string[] = [
  ROLES.ADMIN,
  ROLES.ACCOUNT_MANAGER,
];

/**
 * Stable action keys for Office Accounts financial actions. Used both for the
 * permission guard's log line and as the `action` recorded in the audit trail,
 * so a denied attempt and a successful action share the same vocabulary.
 */
export const FINANCIAL_ACTIONS = {
  accountHeadCreate: "account_head.create",
  accountHeadUpdate: "account_head.update",
  accountHeadDelete: "account_head.delete",
  accountHeadExport: "account_head.export",
  journalVoucherCreate: "journal_voucher.create",
  journalVoucherPost: "journal_voucher.post",
  journalVoucherCancel: "journal_voucher.cancel",
  ledgerPost: "ledger.post",
  ledgerReverse: "ledger.reverse",
  ledgerExport: "ledger.export",
  expenseCreate: "expense.create",
  expenseDelete: "expense.delete",
  expenseExport: "expense.export",
  vasCreate: "vas.create",
  vasDelete: "vas.delete",
  chequeCreate: "cheque.create",
  chequeStatusUpdate: "cheque.status_update",
  chequeDelete: "cheque.delete",
  businessCustomerCreate: "business_customer.create",
  businessCustomerDelete: "business_customer.delete",
  dollarTransaction: "dollar_system.transaction",
} as const;

export type FinancialPermissionOptions = ActionPermissionOptions;

/**
 * Build an Express middleware that authorizes a financial action.
 *
 * @param actionKey Stable identifier for the protected action (see
 *                  FINANCIAL_ACTIONS). Namespaced as `finance:<actionKey>`.
 * @param options   Optional overrides. When neither `roles` nor `allowRole`
 *                  is provided, FINANCIAL_WRITE_ROLES is used.
 */
export function requireFinancialPermission(
  actionKey: string,
  options: FinancialPermissionOptions = {},
) {
  const hasExplicitRoleConstraint =
    options.roles !== undefined || options.allowRole !== undefined;

  return requireActionPermission(`finance:${actionKey}`, {
    roles: hasExplicitRoleConstraint ? options.roles : FINANCIAL_WRITE_ROLES,
    allowRole: options.allowRole,
    predicate: options.predicate,
    message:
      options.message ??
      "You are not authorized to perform this financial action.",
  });
}
