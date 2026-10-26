/** Canonical Next paths for home dashboard quick links (Phase — sales/reports stubs). */

export const QUICK_SALE_COMMISSION = "/dashboard/sale/commission-verification" as const;
export const QUICK_SALES_PERFORMANCE = "/dashboard/sales/performance-evaluation" as const;
export const QUICK_REPORTS_GRADE = "/dashboard/reports/grade-system" as const;
export const QUICK_SALES_APPOINTMENTS = "/dashboard/sales/appointments" as const;
export const QUICK_DD_MANAGER = "/dashboard/dd-manager" as const;

export const QUICK_LINK_MIGRATED_PATHS = [
  QUICK_SALE_COMMISSION,
  QUICK_SALES_PERFORMANCE,
  QUICK_REPORTS_GRADE,
  QUICK_SALES_APPOINTMENTS,
  QUICK_DD_MANAGER,
] as const;

/** Legacy bookmarks → canonical Next URLs. */
export const QUICK_LINK_LEGACY_TO_DASHBOARD = [
  { source: "/sale/commission-verification", destination: QUICK_SALE_COMMISSION },
  { source: "/sales/performance-evaluation", destination: QUICK_SALES_PERFORMANCE },
  { source: "/reports/grade-system", destination: QUICK_REPORTS_GRADE },
  { source: "/sales/appointments", destination: QUICK_SALES_APPOINTMENTS },
] as const;
