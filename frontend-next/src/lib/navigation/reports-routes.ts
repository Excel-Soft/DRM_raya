/**
 * Canonical Next.js paths for the Main Reports module (legacy "Reports"
 * permKey group in app-sidebar.tsx — 20 items, distinct from the already-
 * migrated "User Reports" module). See frontend-next/docs/modules/reports.md
 * for the full per-page inventory, including items intentionally NOT listed
 * here yet (Loan/Vas/Bv company-scope share the User Reports dynamic route;
 * Projects Report aliases PMS's Project Report; Salary Create/Bonuses/Report
 * are payroll pages tracked separately below as they land).
 */

export const REPORTS_RAW_ATTENDANCE = "/dashboard/reports/raw-attendance" as const;
export const REPORTS_FOLLOW_UP = "/dashboard/reports/follow-up" as const;
export const REPORTS_DAY_TARGET = "/dashboard/reports/day-target" as const;
export const REPORTS_DIAGNOSE = "/dashboard/reports/diagnose" as const;
export const REPORTS_BV_PENDING_ECNC = "/dashboard/reports/bv-pending-ecnc" as const;
export const REPORTS_EVENT = "/dashboard/reports/event" as const;
export const REPORTS_ATTENDANCE = "/dashboard/reports/attendance" as const;
export const ANALYTICS_GM = "/dashboard/analytics/gm" as const;
export const REPORTS_DEPARTMENT = "/dashboard/reports/department" as const;
export const REPORTS_RECEPTION = "/dashboard/reports/reception" as const;
export const REPORTS_BV_PENDING_RC = "/dashboard/reports/bv-pending-rc" as const;
export const REPORTS_EDIT_ATT = "/dashboard/reports/edit-att" as const;
export const REPORTS_SALARY_CREATE = "/dashboard/reports/salary-create" as const;
export const REPORTS_SALARY_BONUSES = "/dashboard/reports/salary-bonuses" as const;
export const REPORTS_SALARY = "/dashboard/reports/salary" as const;

export const REPORTS_SIDEBAR_PATHS = [
  REPORTS_RAW_ATTENDANCE,
  REPORTS_FOLLOW_UP,
  REPORTS_DAY_TARGET,
  REPORTS_DIAGNOSE,
  REPORTS_BV_PENDING_ECNC,
  REPORTS_EVENT,
  REPORTS_ATTENDANCE,
  ANALYTICS_GM,
  REPORTS_DEPARTMENT,
  REPORTS_RECEPTION,
  REPORTS_BV_PENDING_RC,
  REPORTS_EDIT_ATT,
  REPORTS_SALARY_CREATE,
  REPORTS_SALARY_BONUSES,
  REPORTS_SALARY,
] as const;

export const REPORTS_LEGACY_TO_DASHBOARD = [
  { source: "/reports/raw-attendance", destination: REPORTS_RAW_ATTENDANCE },
  { source: "/reports/follow-up", destination: REPORTS_FOLLOW_UP },
  { source: "/reports/day-target", destination: REPORTS_DAY_TARGET },
  { source: "/reports/diagnose", destination: REPORTS_DIAGNOSE },
  { source: "/reports/bv-pending-ecnc", destination: REPORTS_BV_PENDING_ECNC },
  { source: "/reports/event", destination: REPORTS_EVENT },
  { source: "/reports/attendance", destination: REPORTS_ATTENDANCE },
  { source: "/analytics/gm", destination: ANALYTICS_GM },
  { source: "/reports/department", destination: REPORTS_DEPARTMENT },
  { source: "/reports/reception", destination: REPORTS_RECEPTION },
  { source: "/reports/bv-pending-rc", destination: REPORTS_BV_PENDING_RC },
  { source: "/reports/edit-att", destination: REPORTS_EDIT_ATT },
  { source: "/reports/salary-create", destination: REPORTS_SALARY_CREATE },
  { source: "/reports/salary-bonuses", destination: REPORTS_SALARY_BONUSES },
  { source: "/reports/salary", destination: REPORTS_SALARY },
] as const;
