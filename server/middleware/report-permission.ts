import { normalizeRole } from "../utils/role-utils";
import { requireActionPermission } from "./action-permission";

/**
 * Patch 2 Stage 1 — backend report-permission matrix.
 *
 * This is the API-side authorization layer for report actions. It deliberately
 * governs ONLY backend report endpoints; sidebar/menu visibility stays driven by
 * `drm.menu_permissions` (a separate source of truth — do not merge them here).
 *
 * Roles are compared after `normalizeRole()` on BOTH sides (mirroring
 * `requireActionPermission`). Note `normalizeRole` collapses
 * `super_admin`/`administrator` → `admin`, while `super_hod` stays distinct, so
 * the matrix is written in already-normalized keys.
 *
 * The guard fails CLOSED (401 unauthenticated, 403 unauthorized) and returns the
 * standard sanitized error envelope. Row-level scoping ("own data only") is NOT
 * this layer's job — handlers still filter rows by the caller's identity.
 */

export type ReportKey =
  | "raw_attendance"
  | "salary_create"
  | "salary_report"
  | "event_report"
  | "reception_report"
  | "edit_attendance"
  | "day_target"
  | "diagnosis_report"
  | "bv_report"
  | "penalty_report"
  | "project_report"
  | "link_report";

export type ReportAction =
  | "view"
  | "create"
  | "edit"
  | "export"
  | "approve"
  | "finalize"
  | "delete";

/**
 * Roles permitted to perform ANY report action. `admin` here also covers
 * `super_admin`/`administrator` because `normalizeRole` collapses them.
 */
const ALWAYS_ALLOWED: string[] = ["admin", "super_hod"];

/**
 * Per-report extra roles (beyond ALWAYS_ALLOWED) allowed for each action.
 * Keys are normalized role strings. An action absent from a report's map is
 * permitted to ALWAYS_ALLOWED only.
 */
const REPORT_PERMISSION_MATRIX: Record<
  ReportKey,
  Partial<Record<ReportAction, string[]>>
> = {
  raw_attendance: {
    view: ["account_manager", "hr", "hr_manager", "hod"],
    export: ["account_manager", "hr", "hr_manager"],
  },
  salary_create: {
    view: ["account_manager", "hr", "hr_manager"],
    create: ["account_manager"],
    edit: ["account_manager"],
    finalize: ["account_manager"],
    export: ["account_manager"],
  },
  salary_report: {
    view: ["account_manager", "hr", "hr_manager", "hod"],
    export: ["account_manager", "hr", "hr_manager"],
  },
  event_report: {
    view: ["account_manager", "hod", "reception_manager"],
    export: ["account_manager", "hod"],
  },
  reception_report: {
    // "reception_executive" is listed explicitly because normalizeRole maps
    // "Reception Executive" → reception_executive (NOT matched by the plain
    // "reception" entry). Row-scope (resolveReceptionScope) then limits an
    // executive to their own reception rows even though they may view.
    view: ["reception_manager", "reception", "reception_executive", "account_manager", "hod"],
    export: ["reception_manager", "account_manager"],
  },
  edit_attendance: {
    view: ["account_manager", "hr", "hr_manager", "hod"],
    approve: ["account_manager", "hr_manager", "hod"],
    finalize: ["account_manager", "hod"],
  },
  day_target: {
    view: [
      "account_manager",
      "hod",
      "hr",
      "hr_manager",
      "sales_manager",
      "dd_manager",
      "service_manager",
      "reception_manager",
    ],
    export: ["account_manager", "hod"],
  },
  diagnosis_report: {
    view: ["account_manager", "hod", "sales_manager", "dd_manager", "service_manager"],
    export: ["account_manager", "hod"],
  },
  bv_report: {
    view: [
      "account_manager",
      "hod",
      "sales_manager",
      "sales_assistant_manager",
      "sales_executive",
      "dd_manager",
    ],
    create: ["sales_executive", "sales_assistant_manager", "sales_manager", "account_manager"],
    edit: ["sales_executive", "sales_assistant_manager", "sales_manager", "account_manager"],
    export: ["account_manager", "hod", "sales_manager"],
    approve: ["account_manager", "hod"],
  },
  penalty_report: {
    view: ["dd_manager", "service_manager", "hod", "account_manager"],
    create: ["dd_manager", "service_manager"],
    approve: ["hod", "account_manager"],
    delete: ["account_manager"],
  },
  // project_report / link_report mirror the managerial+HOD gating already
  // enforced inline in project-report-routes.ts / team-report-link-report-routes.ts
  // (executives get 403). Kept conservative; row-scope stays in the handlers.
  project_report: {
    view: ["hod", "sales_manager", "dd_manager", "service_manager", "account_manager"],
    export: ["hod", "account_manager"],
  },
  link_report: {
    view: ["hod", "sales_manager", "dd_manager", "service_manager", "account_manager"],
    export: ["hod", "account_manager"],
  },
};

/**
 * Resolve the normalized, de-duplicated set of roles allowed to perform
 * `action` on `reportKey` (always includes ALWAYS_ALLOWED).
 */
export function resolveReportRoles(reportKey: ReportKey, action: ReportAction): string[] {
  const extra = REPORT_PERMISSION_MATRIX[reportKey]?.[action] ?? [];
  const merged = [...ALWAYS_ALLOWED, ...extra].map((r) => normalizeRole(r));
  return Array.from(new Set(merged));
}

/**
 * Express guard for a report action. Thin composition over
 * `requireActionPermission` so the normalization, fail-closed behaviour and
 * sanitized error envelope are shared with the rest of the app.
 */
export function requireReportPermission(reportKey: ReportKey, action: ReportAction) {
  const human = `${action} the ${reportKey.replace(/_/g, " ")} report`;
  return requireActionPermission(`report:${reportKey}:${action}`, {
    roles: resolveReportRoles(reportKey, action),
    message: `You are not authorized to ${human}.`,
  });
}

export { REPORT_PERMISSION_MATRIX };
