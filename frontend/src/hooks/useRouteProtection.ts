import { useEffect } from "react";
import { useLocation } from "wouter";
import { normalizeRole as normalize } from "@/lib/role-utils";
import { isRouteAccessAllowed } from "@/lib/route-access";

// Default dashboards for each role
const ROLE_DASHBOARDS: Record<string, string> = {
    admin: "/",
    super_hod: "/",
    sales_manager: "/dashboard/sales-manager",
    sales_assistant_manager: "/dashboard/sales-assistant-manager",
    sales_executive: "/dashboard/sales-executive",
    account_manager: "/",
    service_manager: "/dashboard/service-manager",
    service_assistant_manager: "/dashboard/service-manager",
    service_executive: "/dashboard/service-executive",
    developer: "/dashboard/developer",
    dd_manager: "/dashboard/dd-manager",
    dd_executive: "/dashboard/dd-executive",
    product_posting_manager: "/product-posting",
    product_posting_executive: "/product-posting",
    posting_executive: "/product-posting",
    qa_manager: "/qa/manager",
    verification_manager: "/verification/manager",
    reception_manager: "/dashboard/reception",
    software_manager: "/dashboard/software-manager",
    software_executive: "/dashboard/software-executive",
    lead_manager: "/dashboard/lead-manager",
    lead_executive: "/dashboard/lead-executive",
    marketing_manager: "/dashboard/marketing-manager",
    it_manager: "/dashboard/it-manager",
    it_executive: "/dashboard/it-executive",
    seo_smm_manager: "/dashboard/seo-smm",
    seo_smm_executive: "/dashboard/seo-smm-executive",
    complaint_manager: "/dashboard/complaint-manager",
};

interface RouteProtectionState {
    /** Server-validated active role (from /api/auth/me activeRoleId/role). */
    activeRoleId?: string | null;
    /** Server-validated full list of assigned roles. */
    userRoles?: string[];
    /** True once the authoritative /api/auth/me check has resolved. */
    ready: boolean;
    /** True when the server confirmed the session is authenticated. */
    isAuthenticated: boolean;
}

export function useRouteProtection(authState: RouteProtectionState) {
    const [location, setLocation] = useLocation();
    const { activeRoleId, userRoles, ready, isAuthenticated } = authState;

    useEffect(() => {
        if (!ready) return;
        if (!isAuthenticated) return;

        if (!isRouteAccessAllowed(location, activeRoleId, userRoles)) {
            const primaryRole = normalize(activeRoleId) || normalize(userRoles?.[0]) || "";
            const defaultDashboard = ROLE_DASHBOARDS[primaryRole] || "/";
            console.log(`[Route Protection] Redirecting ${primaryRole || "unknown"} from ${location} to ${defaultDashboard}`);
            setLocation(defaultDashboard);
        }
    }, [location, setLocation, activeRoleId, userRoles, ready, isAuthenticated]);
}
