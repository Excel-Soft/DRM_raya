/** Canonical Next.js paths for User Reports (Phase 28). */

export const USER_REPORT_LOAN = "/dashboard/reports/loan" as const;
export const USER_REPORT_VAS = "/dashboard/reports/vas" as const;
export const USER_REPORT_GM = "/dashboard/reports/gm" as const;
export const USER_REPORT_BV = "/dashboard/reports/bv" as const;

export const USER_REPORTS_SIDEBAR_PATHS = [
  USER_REPORT_LOAN,
  USER_REPORT_VAS,
  USER_REPORT_GM,
  USER_REPORT_BV,
] as const;

export const USER_REPORTS_LEGACY_TO_DASHBOARD = [
  { source: "/reports/loan", destination: USER_REPORT_LOAN },
  { source: "/reports/vas", destination: USER_REPORT_VAS },
  { source: "/reports/gm", destination: USER_REPORT_GM },
  { source: "/reports/bv", destination: USER_REPORT_BV },
] as const;
