import { z } from "zod";
import {
  id,
  dateRange,
  pagination,
  reason,
} from "./common.validators";

/**
 * Report validators: shared, composable Zod schemas for report query/filter and
 * export requests. These are the backend counterpart to the frontend
 * `client/src/lib/reportApi.ts` helpers (date-range validation, required
 * filters, export params) so both sides reject the same bad input.
 *
 * The `reportKey` / `reportAction` enums intentionally MIRROR the canonical
 * lists in `server/middleware/report-permission.ts` (kept as plain tuples here
 * so this validators module stays dependency-free — it must not import
 * middleware). If a report key/action is added there, add it here too.
 */

/** Mirrors ReportKey in server/middleware/report-permission.ts. */
export const REPORT_KEYS = [
  "raw_attendance",
  "salary_create",
  "salary_report",
  "event_report",
  "reception_report",
  "edit_attendance",
  "day_target",
  "diagnosis_report",
  "bv_report",
  "penalty_report",
  "project_report",
  "link_report",
] as const;

/** Mirrors ReportAction in server/middleware/report-permission.ts. */
export const REPORT_ACTIONS = [
  "view",
  "create",
  "edit",
  "export",
  "approve",
  "finalize",
  "delete",
] as const;

export const reportKey = z.enum(REPORT_KEYS);
export const reportAction = z.enum(REPORT_ACTIONS);

/** Export output formats supported by the report toolbar/export endpoints. */
export const reportFormat = z.enum(["csv", "xlsx", "pdf"]);

/**
 * Generic report filter set. Every field is optional so each report can pick the
 * filters it supports; the shared shape keeps branch/department/user scoping and
 * pagination consistent across reports. `range` enforces from <= to.
 */
export const reportFilters = z
  .object({
    range: dateRange.optional(),
    branch: z.string().trim().min(1).max(128).optional(),
    department: z.string().trim().min(1).max(128).optional(),
    userId: id.optional(),
    status: z.string().trim().min(1).max(64).optional(),
  })
  .merge(pagination.partial());

/**
 * Export request: the active filters PLUS the chosen format. Export MUST run
 * against the same filters the user is viewing (no silent "export everything").
 */
export const reportExportRequest = z.object({
  format: reportFormat.default("csv"),
  filters: reportFilters.optional(),
  range: dateRange.optional(),
});

/**
 * A report action that mutates state (approve/reject/finalize/delete) must carry
 * a justification reason for the audit trail.
 */
export const reportDecisionRequest = z.object({
  reportKey,
  action: reportAction,
  entityId: id,
  reason: reason,
});

export type ReportFilters = z.infer<typeof reportFilters>;
export type ReportExportRequest = z.infer<typeof reportExportRequest>;
export type ReportDecisionRequest = z.infer<typeof reportDecisionRequest>;
