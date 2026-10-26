/** Canonical Next.js path for the Add Penalty module. */

export const PENALTY_ADD = "/dashboard/add-penalty" as const;

export const PENALTY_SIDEBAR_PATHS = [PENALTY_ADD] as const;

export const PENALTY_LEGACY_TO_DASHBOARD = [
  { source: "/drm/add-penalty", destination: PENALTY_ADD },
] as const;
