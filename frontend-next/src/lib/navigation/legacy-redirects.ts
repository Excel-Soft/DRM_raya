import type { Redirect } from "next/dist/lib/load-custom-routes";
import { CUSTOMER_LEGACY_TO_DASHBOARD } from "./customer-routes";
import { DOMAIN_HOSTING_LEGACY_TO_DASHBOARD } from "./domain-hosting-routes";
import { DRM_LEGACY_TO_DASHBOARD } from "./drm-routes";
import { DAILY_REPORTS_LEGACY_TO_DASHBOARD } from "./daily-reports-routes";
import { EVENTS_LEGACY_TO_DASHBOARD } from "./events-routes";
import { PORTFOLIO_LEGACY_TO_DASHBOARD } from "./portfolio-routes";
import { POSTING_DATA_LEGACY_TO_DASHBOARD } from "./posting-data-routes";
import { TARGET_SYSTEM_LEGACY_TO_DASHBOARD } from "./target-system-routes";
import { SOCIAL_MEDIA_LEGACY_TO_DASHBOARD } from "./social-media-routes";
import { USER_REPORTS_LEGACY_TO_DASHBOARD } from "./user-reports-routes";
import { USERS_LEGACY_TO_DASHBOARD } from "./users-routes";
import { LEAD_LEGACY_TO_DASHBOARD } from "./lead-routes";
import { QUICK_LINK_LEGACY_TO_DASHBOARD } from "./quick-link-routes";

/** Legacy Vite-style paths → canonical Next dashboard URLs (Phase 13 + 14 Customer). */
export const LEGACY_TO_DASHBOARD_REDIRECTS = [
  { source: "/notice-board", destination: "/dashboard/notice-board" },
  { source: "/policies", destination: "/dashboard/policies" },
  { source: "/training", destination: "/dashboard/training" },
  { source: "/admin/audit-logs", destination: "/dashboard/audit-logs" },
  { source: "/allowed-ip/drm-ip-list", destination: "/dashboard/allowed-ip/drm-ip-list" },
  ...CUSTOMER_LEGACY_TO_DASHBOARD,
  ...DRM_LEGACY_TO_DASHBOARD,
  ...USERS_LEGACY_TO_DASHBOARD,
  ...SOCIAL_MEDIA_LEGACY_TO_DASHBOARD,
  ...DAILY_REPORTS_LEGACY_TO_DASHBOARD,
  ...EVENTS_LEGACY_TO_DASHBOARD,
  ...TARGET_SYSTEM_LEGACY_TO_DASHBOARD,
  ...POSTING_DATA_LEGACY_TO_DASHBOARD,
  ...DOMAIN_HOSTING_LEGACY_TO_DASHBOARD,
  ...PORTFOLIO_LEGACY_TO_DASHBOARD,
  ...USER_REPORTS_LEGACY_TO_DASHBOARD,
  ...LEAD_LEGACY_TO_DASHBOARD,
  ...QUICK_LINK_LEGACY_TO_DASHBOARD,
] as const;

export function legacyAppRedirects(): Redirect[] {
  return LEGACY_TO_DASHBOARD_REDIRECTS.map(({ source, destination }) => ({
    source,
    destination,
    permanent: false,
  }));
}
