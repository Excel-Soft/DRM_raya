import { ROLES, isManagerialRole, normalizeRole } from "../utils/role-utils";

/**
 * Central registry of named backend ACTION permissions (PATCH 6 Stage 1).
 *
 * This is the single, reviewable source of truth for *which roles* may perform a
 * given sensitive write action, consumed by `requireActionPermission` (see
 * `server/middleware/action-permission.ts`). Each entry maps a stable action key
 * to a declarative policy:
 *
 *   - `roles`         allow-list of roles (compared after normalizeRole()).
 *   - `allowRole`     optional predicate on the normalized role (OR'd with roles).
 *   - `adminOverride` when true, a normalized ADMIN bypasses the ROLE gate only
 *                     (never a handler-level predicate / segregation-of-duties).
 *                     Defaults to FALSE so admin is granted only where opted in.
 *   - `audit`         when true, DENIED attempts are recorded best-effort.
 *   - `entityType`    resource type recorded on a denied-attempt audit row.
 *   - `module`        owning module, recorded on the audit row.
 *   - `message`       human-readable 403 message.
 *
 * IMPORTANT (no double-guarding): actions already enforced by their own
 * dedicated, audited guards are intentionally NOT duplicated here to avoid
 * role-map drift breaking live workflows. They are documented in
 * PATCH6_ACTION_PERMISSION_MATRIX.md:
 *   - GM sales create        -> requireGmSalesActionPermission (gm-sales-permissions)
 *   - Office Accounts writes  -> requireFinancialPermission (financial-permission)
 *   - Reports export/finalize -> requireReportPermission (report-permission)
 *   - Penalty create/decide/void/delete -> handler-level canCreate/canDecide/canVoid + audit
 */

export interface ActionPolicy {
  /** Owning module, recorded on denied-attempt audit rows. */
  module: string;
  /** Short human description (documentation / matrix generation). */
  description?: string;
  /** Allowed roles (normalized on both sides). Omit for authenticated-only. */
  roles?: string[];
  /** Optional predicate on the normalized caller role (OR'd with `roles`). */
  allowRole?: (normalizedRole: string) => boolean;
  /** Allow a normalized ADMIN to bypass the ROLE gate only. Defaults to false. */
  adminOverride?: boolean;
  /** Record denied attempts best-effort to the audit log. */
  audit?: boolean;
  /** Resource type recorded on a denied-attempt audit row. */
  entityType?: string;
  /** Human-readable 403 message. */
  message?: string;
}

/** Roles with org-wide management authority (admin + super HOD). */
const FULL_ACCESS_ROLES: string[] = [ROLES.ADMIN, ROLES.SUPER_HOD];

/** Roles permitted to mutate financial/account-invoice records. */
const INVOICE_WRITE_ROLES: string[] = [ROLES.ADMIN, ROLES.ACCOUNT_MANAGER];

/**
 * Service-module write authority: service staff (manager / assistant manager /
 * executive) plus any managerial role and full-access. `isManagerialRole`
 * already covers service managers/assistant managers, HOD, super HOD and admin,
 * but deliberately EXCLUDES executives, so service executives are added back
 * explicitly here (creating/handling service records is their core job).
 */
export function isServiceWriteRole(role: string): boolean {
  const n = normalizeRole(role);
  return isManagerialRole(n) || n === ROLES.SERVICE_EXECUTIVE;
}

export const ACTION_PERMISSIONS: Record<string, ActionPolicy> = {
  // ── Attributes (shared dropdown / reference data) ────────────────────────
  // VIEW is authenticated-only: attribute lists feed dropdowns across many
  // forms, so every signed-in user must be able to read them. MANAGEMENT
  // (create/delete) is restricted to full-access roles, matching the
  // admin-only Attributes page.
  "attributes.view": {
    module: "attributes",
    description: "Read attribute/reference values for a category (dropdown data).",
  },
  "attributes.create": {
    module: "attributes",
    description: "Create an attribute/reference value.",
    roles: FULL_ACCESS_ROLES,
    adminOverride: true,
    audit: true,
    entityType: "Attribute",
    message: "You are not authorized to manage attributes.",
  },
  "attributes.delete": {
    module: "attributes",
    description: "Delete an attribute/reference value.",
    roles: FULL_ACCESS_ROLES,
    adminOverride: true,
    audit: true,
    entityType: "Attribute",
    message: "You are not authorized to manage attributes.",
  },
  // UPDATE mirrors create/delete authority. No attributes-update endpoint exists
  // today (the Attributes admin page is create/delete only); the key is defined so
  // any future edit route can be guarded consistently (PATCH 7 SEC-001).
  "attributes.update": {
    module: "attributes",
    description: "Update an attribute/reference value.",
    roles: FULL_ACCESS_ROLES,
    adminOverride: true,
    audit: true,
    entityType: "Attribute",
    message: "You are not authorized to manage attributes.",
  },

  // ── Account invoices ─────────────────────────────────────────────────────
  "invoice.update_status": {
    module: "account",
    description: "Change an invoice status (e.g. mark Paid / Cancelled).",
    roles: INVOICE_WRITE_ROLES,
    adminOverride: true,
    audit: true,
    entityType: "Invoice",
    message: "You are not authorized to change invoice status.",
  },
  "invoice.update": {
    module: "account",
    description: "Edit invoice fields.",
    roles: INVOICE_WRITE_ROLES,
    adminOverride: true,
    audit: true,
    entityType: "Invoice",
    message: "You are not authorized to edit invoices.",
  },
  "invoice.delete": {
    module: "account",
    description: "Delete an invoice.",
    roles: INVOICE_WRITE_ROLES,
    adminOverride: true,
    audit: true,
    entityType: "Invoice",
    message: "You are not authorized to delete invoices.",
  },

  // ── Service core writes ──────────────────────────────────────────────────
  "service.followup.create": {
    module: "service",
    description: "Create a service follow-up.",
    allowRole: isServiceWriteRole,
    adminOverride: true,
    audit: true,
    entityType: "ServiceFollowup",
    message: "You are not authorized to manage service records.",
  },
  "service.followup.complete": {
    module: "service",
    description: "Complete a service follow-up.",
    allowRole: isServiceWriteRole,
    adminOverride: true,
    audit: true,
    entityType: "ServiceFollowup",
    message: "You are not authorized to manage service records.",
  },
  "service.complaint.create": {
    module: "service",
    description: "Create a service complaint.",
    allowRole: isServiceWriteRole,
    adminOverride: true,
    audit: true,
    entityType: "ServiceComplaint",
    message: "You are not authorized to manage service records.",
  },
  "service.complaint.update": {
    module: "service",
    description: "Edit a service complaint.",
    allowRole: isServiceWriteRole,
    adminOverride: true,
    audit: true,
    entityType: "ServiceComplaint",
    message: "You are not authorized to manage service records.",
  },
  "service.complaint.assign": {
    module: "service",
    description: "Assign a service complaint.",
    allowRole: isServiceWriteRole,
    adminOverride: true,
    audit: true,
    entityType: "ServiceComplaint",
    message: "You are not authorized to manage service records.",
  },
  "service.complaint.resolve": {
    module: "service",
    description: "Resolve a service complaint.",
    allowRole: isServiceWriteRole,
    adminOverride: true,
    audit: true,
    entityType: "ServiceComplaint",
    message: "You are not authorized to manage service records.",
  },
  "service.complaint.close": {
    module: "service",
    description: "Close a service complaint.",
    allowRole: isServiceWriteRole,
    adminOverride: true,
    audit: true,
    entityType: "ServiceComplaint",
    message: "You are not authorized to manage service records.",
  },
  "service.complaint.reopen": {
    module: "service",
    description: "Reopen a service complaint.",
    allowRole: isServiceWriteRole,
    adminOverride: true,
    audit: true,
    entityType: "ServiceComplaint",
    message: "You are not authorized to manage service records.",
  },
  "service.dropout.create": {
    module: "service",
    description: "Create a service dropout record.",
    allowRole: isServiceWriteRole,
    adminOverride: true,
    audit: true,
    entityType: "ServiceDropout",
    message: "You are not authorized to manage service records.",
  },
  "service.dropout.recover": {
    module: "service",
    description: "Recover a service dropout.",
    allowRole: isServiceWriteRole,
    adminOverride: true,
    audit: true,
    entityType: "ServiceDropout",
    message: "You are not authorized to manage service records.",
  },
  "service.renewal.create": {
    module: "service",
    description: "Create a service renewal.",
    allowRole: isServiceWriteRole,
    adminOverride: true,
    audit: true,
    entityType: "ServiceRenewal",
    message: "You are not authorized to manage service records.",
  },
};

/** Look up an action policy by key (undefined when not registered). */
export function getActionPolicy(actionKey: string): ActionPolicy | undefined {
  return ACTION_PERMISSIONS[actionKey];
}
