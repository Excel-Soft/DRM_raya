import { normalizeRole as normalize } from "./role-utils";
import { toLegacyGuardPath } from "./guard-path";

/**
 * Must stay aligned with backend audit-log-routes.ts ROLES (Express is authority).
 */
export const AUDIT_LOG_VIEWER_ROLES = ["admin", "super_admin", "super_hod"] as const;

/** Matches `ADMIN_ONLY` in legacy `frontend/src/routes/route-registry.ts`. */
export const ADMIN_ONLY_ROUTE_ROLES = ["admin", "super_admin", "administrator", "super_hod"] as const;

/** Next canonical path; guard maps to legacy `/allowed-ip/*` prefix. */
export const DRM_IP_LIST_ROUTE = "/dashboard/allowed-ip/drm-ip-list" as const;

/**
 * Prefix rules for client-side route guard (fail-closed per matching prefix).
 * Every matching prefix must pass; see isRouteAccessAllowed().
 */
export const ROUTE_PERMISSIONS: Record<string, string[]> = {
    "/allowed-ip/drm-ip-list": [...ADMIN_ONLY_ROUTE_ROLES],
    "/admin/audit-logs": [...AUDIT_LOG_VIEWER_ROLES],
    "/admin": ["admin", "super_admin", "administrator", "service_manager", "super_hod"],
    "/super-admin": ["admin", "super_admin", "administrator", "service_manager", "super_hod"],
    "/drm": [...ADMIN_ONLY_ROUTE_ROLES],
    "/hr": ["admin", "super_hod", "hod", "sales_assistant_manager", "sales_executive", "sales_manager", "account_manager", "developer", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "reception_manager", "verification_manager", "qa_manager", "service_manager", "service_assistant_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "it_manager", "it_executive", "seo_smm_executive", "complaint_manager"],
    "/sales": ["admin", "super_hod", "hod", "sales_assistant_manager", "sales_executive", "sales_manager", "account_manager", "developer", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "reception_manager", "verification_manager", "qa_manager", "service_manager", "service_assistant_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "seo_smm_executive", "complaint_manager"],
    "/pms": ["admin", "super_admin", "service_manager", "service_assistant_manager", "service_executive", "super_hod", "hod", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "developer", "support_agent", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "it_executive", "reception_manager", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "seo_smm_manager", "seo_smm_executive", "complaint_manager"],
    "/reports": ["admin", "super_hod", "hod", "sales_assistant_manager", "sales_executive", "sales_manager", "account_manager", "developer", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "reception_manager", "verification_manager", "qa_manager", "service_manager", "service_assistant_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "complaint_manager"],
    "/training": ["admin", "super_hod", "hod", "sales_assistant_manager", "sales_executive", "sales_manager", "account_manager", "developer", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "reception_manager", "verification_manager", "qa_manager", "service_manager", "service_assistant_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
    "/posting-data": ["admin", "super_hod", "hod", "account_manager", "product_posting_manager", "product_posting_executive", "posting_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
    "/social-media": ["admin", "super_hod", "hod", "marketing_manager"],
    "/daily-reports": [...ADMIN_ONLY_ROUTE_ROLES],
    "/events": ["admin", "hod", "super_hod", "marketing_manager", "reception_manager"],
    "/target-system": ["admin", "sales_manager", "hod", "super_hod", "account_manager"],
    "/portfolio": ["admin", "verification_manager", "hod", "super_hod", "software_manager", "lead_manager", "lead_executive", "marketing_manager", "seo_smm_manager", "seo_smm_executive"],
    "/it": ["admin", "super_admin", "administrator", "super_hod", "hod", "it_manager", "it_executive", "developer", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "service_manager"],
    "/service": ["admin", "super_hod", "hod", "service_manager", "service_assistant_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
    "/customers": ["admin", "super_hod", "hod", "sales_assistant_manager", "sales_executive", "sales_manager", "account_manager", "manager", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "service_manager", "service_assistant_manager", "service_executive", "reception_manager", "product_posting_manager", "product_posting_executive", "posting_executive", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "it_manager"],
    "/analytics": ["admin", "super_hod", "hod", "sales_manager", "account_manager", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
    "/support": ["admin", "super_hod", "hod", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "seo_smm_executive"],
    "/gm-pool": ["admin", "super_hod", "hod", "sales_assistant_manager", "sales_manager", "sales_executive", "account_manager", "manager", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "service_manager", "service_assistant_manager", "service_executive", "reception_manager", "product_posting_manager", "product_posting_executive", "posting_executive", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "it_manager"],
    "/account": ["admin", "super_hod", "hod", "account_manager", "sales_manager"],
    "/policies": ["admin", "super_hod", "reception_manager", "software_manager", "lead_manager", "lead_executive", "marketing_manager", "account_manager"],
    "/notice-board": ["admin", "super_hod", "reception_manager", "service_manager", "software_manager", "lead_manager", "lead_executive", "marketing_manager", "account_manager", "seo_smm_manager", "seo_smm_executive", "complaint_manager"],
    "/dashboard/software-manager": ["admin", "software_manager"],
    "/dashboard/software-executive": ["admin", "software_executive", "software_manager"],
    "/dashboard/lead-manager": ["admin", "lead_manager", "software_manager"],
    "/dashboard/lead-executive": ["admin", "lead_executive", "lead_manager", "software_manager"],
    "/product-posting": ["admin", "product_posting_manager", "product_posting_executive", "posting_executive"],
    "/qa": ["admin", "qa_manager"],
    "/verification": ["admin", "verification_manager"],
};

function normalizedRoleSet(activeRoleId: string | null | undefined, userRoles: string[] | undefined): Set<string> {
    const roles = new Set<string>();
    if (activeRoleId) roles.add(normalize(activeRoleId));
    (userRoles || []).forEach((r) => roles.add(normalize(r)));
    return roles;
}

/**
 * True when the user passes every ROUTE_PERMISSIONS prefix that matches location.
 * Multiple prefixes can match (e.g. /admin and /admin/audit-logs); all must pass.
 */
export function isRouteAccessAllowed(
    location: string,
    activeRoleId: string | null | undefined,
    userRoles: string[] | undefined,
): boolean {
    const roles = normalizedRoleSet(activeRoleId, userRoles);
    const guardLoc = toLegacyGuardPath(location);

    for (const [routePattern, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
        if (!guardLoc.startsWith(routePattern)) continue;
        const allowed = allowedRoles.map((r) => r.toLowerCase());
        const isAllowed = Array.from(roles).some((r) => allowed.includes(r));
        if (!isAllowed) return false;
    }
    return true;
}

/** Sidebar visibility helper — not authorization; mirrors audit log viewer roles. */
export function canShowAuditLogsNav(activeRoleId: string | null | undefined, userRoles: string[] | undefined): boolean {
    const roles = normalizedRoleSet(activeRoleId, userRoles);
    const allowed = AUDIT_LOG_VIEWER_ROLES.map((r) => r.toLowerCase());
    return Array.from(roles).some((r) => allowed.includes(r));
}
