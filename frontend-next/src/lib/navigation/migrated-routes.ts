import {
  DASHBOARD_AUDIT_LOGS,
  DASHBOARD_DRM_IP_LIST,
  DASHBOARD_HOME,
  DASHBOARD_NOTICE_BOARD,
  DASHBOARD_POLICIES,
  DASHBOARD_TRAINING,
  NEXT_MIGRATED_DASHBOARD_PATHS,
} from "./dashboard-routes";
import {
  CUSTOMER_ATTRIBUTE,
  CUSTOMER_CREATE_INVOICE,
  CUSTOMER_QUOTATION,
  CUSTOMER_SIDEBAR_PATHS,
} from "./customer-routes";
import { DRM_SETTING_SIDEBAR_PATHS } from "./drm-routes";
import { DAILY_REPORTS_SIDEBAR_PATHS } from "./daily-reports-routes";
import { EVENTS_SIDEBAR_PATHS } from "./events-routes";
import { DOMAIN_HOSTING_SIDEBAR_PATHS } from "./domain-hosting-routes";
import { POSTING_DATA_SIDEBAR_PATHS } from "./posting-data-routes";
import { TARGET_SYSTEM_SIDEBAR_PATHS } from "./target-system-routes";
import { PORTFOLIO_SIDEBAR_PATHS } from "./portfolio-routes";
import { SOCIAL_MEDIA_SIDEBAR_PATHS } from "./social-media-routes";
import { USER_REPORTS_SIDEBAR_PATHS } from "./user-reports-routes";
import { USERS_SIDEBAR_PATHS } from "./users-routes";
import { LEAD_SIDEBAR_PATHS } from "./lead-routes";
import { ATTENDANCE_SIDEBAR_PATHS } from "./attendance-routes";
import { QUICK_LINK_MIGRATED_PATHS } from "./quick-link-routes";
import { PMS_SIDEBAR_PATHS } from "./pms-routes";
import { REPORTS_SIDEBAR_PATHS } from "./reports-routes";
import { INCREMENT_SIDEBAR_PATHS } from "./increment-routes";
import { PENALTY_SIDEBAR_PATHS } from "./penalty-routes";
import { OFFICE_SIDEBAR_PATHS } from "./office-routes";

export const NEXT_MIGRATED_PATHS = new Set<string>([
  ...NEXT_MIGRATED_DASHBOARD_PATHS,
  ...CUSTOMER_SIDEBAR_PATHS,
  CUSTOMER_QUOTATION,
  CUSTOMER_CREATE_INVOICE,
  CUSTOMER_ATTRIBUTE,
  ...DRM_SETTING_SIDEBAR_PATHS,
  ...USERS_SIDEBAR_PATHS,
  ...SOCIAL_MEDIA_SIDEBAR_PATHS,
  ...DAILY_REPORTS_SIDEBAR_PATHS,
  ...EVENTS_SIDEBAR_PATHS,
  ...TARGET_SYSTEM_SIDEBAR_PATHS,
  ...POSTING_DATA_SIDEBAR_PATHS,
  ...DOMAIN_HOSTING_SIDEBAR_PATHS,
  ...PORTFOLIO_SIDEBAR_PATHS,
  ...USER_REPORTS_SIDEBAR_PATHS,
  ...LEAD_SIDEBAR_PATHS,
  ...ATTENDANCE_SIDEBAR_PATHS,
  ...QUICK_LINK_MIGRATED_PATHS,
  ...PMS_SIDEBAR_PATHS,
  ...REPORTS_SIDEBAR_PATHS,
  ...INCREMENT_SIDEBAR_PATHS,
  ...PENALTY_SIDEBAR_PATHS,
  ...OFFICE_SIDEBAR_PATHS,
]);

export function isNextMigratedPath(path: string): boolean {
  const bare = path.split("?")[0];
  return NEXT_MIGRATED_PATHS.has(path) || NEXT_MIGRATED_PATHS.has(bare);
}

/** Optional origin for legacy Vite app (e.g. `http://localhost:5173`). */
export function legacyAppHref(path: string): string {
  const origin = process.env.NEXT_PUBLIC_LEGACY_APP_ORIGIN?.replace(/\/$/, "");
  if (!origin) return path;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export {
  DASHBOARD_HOME,
  DASHBOARD_NOTICE_BOARD,
  DASHBOARD_POLICIES,
  DASHBOARD_AUDIT_LOGS,
  DASHBOARD_DRM_IP_LIST,
  DASHBOARD_TRAINING,
};
