/** @deprecated Import from `./route-access` — kept for Phase 0 spec references. */
export {
  AUDIT_LOG_VIEWER_ROLES,
  isRouteAccessAllowed,
  canShowAuditLogsNav,
} from "./route-access";

import { AUDIT_LOG_VIEWER_ROLES } from "./route-access";

export const AUDIT_LOG_ROUTE = "/admin/audit-logs" as const;

export type AuditLogViewerRole = (typeof AUDIT_LOG_VIEWER_ROLES)[number];

export { ADMIN_ONLY_ROUTE_ROLES, DRM_IP_LIST_ROUTE } from "./route-access";

export function isAuditLogViewerRole(normalizedRole: string): boolean {
  return (AUDIT_LOG_VIEWER_ROLES as readonly string[]).includes(normalizedRole);
}
