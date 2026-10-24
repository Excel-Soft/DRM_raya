/** Canonical Next.js paths for Target System (Phase 22). */

export const TARGET_SYSTEM_CREATE = "/dashboard/target-system/create" as const;
export const TARGET_SYSTEM_SET = "/dashboard/target-system/set" as const;
export const TARGET_SYSTEM_VIEW = "/dashboard/target-system/view" as const;
export const TARGET_SYSTEM_DAILY = "/dashboard/target-system/daily" as const;
export const TARGET_SYSTEM_ADD_KWA = "/dashboard/target-system/add-kwa" as const;
export const TARGET_SYSTEM_KWA_HISTORY = "/dashboard/target-system/kwa-history" as const;

export const TARGET_SYSTEM_SIDEBAR_PATHS = [
  TARGET_SYSTEM_CREATE,
  TARGET_SYSTEM_SET,
  TARGET_SYSTEM_VIEW,
  TARGET_SYSTEM_DAILY,
  TARGET_SYSTEM_ADD_KWA,
  TARGET_SYSTEM_KWA_HISTORY,
] as const;

export const TARGET_SYSTEM_LEGACY_TO_DASHBOARD = [
  { source: "/target-system/create", destination: TARGET_SYSTEM_CREATE },
  { source: "/target-system/set", destination: TARGET_SYSTEM_SET },
  { source: "/target-system/view", destination: TARGET_SYSTEM_VIEW },
  { source: "/target-system/daily", destination: TARGET_SYSTEM_DAILY },
  { source: "/target-system/add-kwa", destination: TARGET_SYSTEM_ADD_KWA },
  { source: "/target-system/kwa-history", destination: TARGET_SYSTEM_KWA_HISTORY },
] as const;
