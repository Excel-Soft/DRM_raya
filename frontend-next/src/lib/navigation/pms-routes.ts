/**
 * Canonical Next.js paths for PMS (Project Management System).
 *
 * Legacy module has 10 real pages (see frontend-next/docs/modules/pms.md for
 * the full inventory). Only pages that are actually implemented in Next
 * belong in PMS_SIDEBAR_PATHS / PMS_LEGACY_TO_DASHBOARD below — every other
 * module in this codebase migrates page-by-page the same way, and listing an
 * unbuilt page here would make the sidebar link internally 404 instead of
 * correctly falling back to the legacy app (see migrated-routes.ts).
 */

export const PMS_RUNNING_PROJECTS = "/dashboard/pms/running-projects" as const;
export const PMS_PROJECT_REPORT = "/dashboard/pms/project-report" as const;
export const PMS_COMPLETE_CLOSED_PROJECTS = "/dashboard/pms/complete-closed-projects" as const;
export const PMS_TEAM_WORKSPACE = "/dashboard/pms/team-workspace" as const;
export const PMS_TASK_HISTORY = "/dashboard/pms/task-history" as const;
export const PMS_APPROVALS = "/dashboard/pms/approvals" as const;
export const PMS_TASKS = "/dashboard/pms/tasks" as const;
export const PMS_STATUS = "/dashboard/pms/status" as const;

export const PMS_SIDEBAR_PATHS = [
  PMS_RUNNING_PROJECTS,
  PMS_PROJECT_REPORT,
  PMS_COMPLETE_CLOSED_PROJECTS,
  PMS_TEAM_WORKSPACE,
  PMS_TASK_HISTORY,
  PMS_APPROVALS,
  PMS_TASKS,
  PMS_STATUS,
] as const;

export const PMS_LEGACY_TO_DASHBOARD = [
  { source: "/pms/running-projects", destination: PMS_RUNNING_PROJECTS },
  { source: "/pms/project-report", destination: PMS_PROJECT_REPORT },
  { source: "/pms/complete-closed-projects", destination: PMS_COMPLETE_CLOSED_PROJECTS },
  { source: "/pms/team-workspace", destination: PMS_TEAM_WORKSPACE },
  { source: "/pms/task-history", destination: PMS_TASK_HISTORY },
  { source: "/pms/approvals", destination: PMS_APPROVALS },
  { source: "/pms/tasks", destination: PMS_TASKS },
  { source: "/pms/status", destination: PMS_STATUS },
] as const;
