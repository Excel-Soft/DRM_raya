/** Canonical Next.js paths for Daily Reports (Phase 20). */

export const DAILY_REPORTS_ADDED_GM = "/dashboard/daily-reports/added-gm" as const;

export const DAILY_REPORTS_SIDEBAR_PATHS = [DAILY_REPORTS_ADDED_GM] as const;

export const DAILY_REPORTS_LEGACY_TO_DASHBOARD = [
  { source: "/daily-reports/added-gm", destination: DAILY_REPORTS_ADDED_GM },
] as const;
