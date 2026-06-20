/**
 * Canonical import path for the config-driven action-permission guard
 * (PATCH 6 Stage 1).
 *
 * The implementation lives in `./action-permission` (kept there so the eight
 * existing importers — users/loan/leave/overtime/attendance/drm routes plus the
 * financial- and report-permission wrappers — continue to work unchanged). This
 * module is a thin, one-way re-export: it introduces NO second implementation
 * and NO circular import (`action-permission.ts` does not import this file). New
 * code should import `requireActionPermission` from here.
 */
export {
    requireActionPermission,
    type ActionPermissionOptions,
    type ActionPermissionContext,
} from "./action-permission";

export {
    ACTION_PERMISSIONS,
    getActionPolicy,
    isServiceWriteRole,
    type ActionPolicy,
} from "../config/action-permissions";
