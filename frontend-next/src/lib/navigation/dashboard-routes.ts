/** Canonical Next.js paths for migrated modules (logged-in app). */
export const DASHBOARD_HOME = "/dashboard" as const;
export const DASHBOARD_NOTICE_BOARD = "/dashboard/notice-board" as const;
export const DASHBOARD_POLICIES = "/dashboard/policies" as const;
export const DASHBOARD_AUDIT_LOGS = "/dashboard/audit-logs" as const;
export const DASHBOARD_DRM_IP_LIST = "/dashboard/allowed-ip/drm-ip-list" as const;
export const DASHBOARD_TRAINING = "/dashboard/training" as const;

export const NEXT_MIGRATED_DASHBOARD_PATHS = [
  DASHBOARD_HOME,
  DASHBOARD_NOTICE_BOARD,
  DASHBOARD_POLICIES,
  DASHBOARD_AUDIT_LOGS,
  DASHBOARD_DRM_IP_LIST,
  DASHBOARD_TRAINING,
  "/api-health",
] as const;
