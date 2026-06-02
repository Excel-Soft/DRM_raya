import { useEffect } from "react";
import { useLocation } from "wouter";

// Define which roles can access which route patterns
const ROUTE_PERMISSIONS: Record<string, string[]> = {
    "/admin": ["admin", "super_admin", "administrator", "service_manager", "super_hod"],
    "/super-admin": ["admin", "super_admin", "administrator", "service_manager", "super_hod"],
    "/hr": ["admin", "super_hod", "hod", "sales_assistant_manager", "sales_executive", "sales_manager", "account_manager", "developer", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "reception_manager", "verification_manager", "qa_manager", "service_manager", "service_assistant_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
    "/sales": ["admin", "super_hod", "hod", "sales_assistant_manager", "sales_executive", "sales_manager", "account_manager", "developer", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "reception_manager", "verification_manager", "qa_manager", "service_manager", "service_assistant_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
    "/pms": ["admin", "super_admin", "service_manager", "service_assistant_manager", "service_executive", "super_hod", "hod", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "developer", "support_agent", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "reception_manager", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
    "/reports": ["admin", "super_hod", "hod", "sales_assistant_manager", "sales_executive", "sales_manager", "account_manager", "developer", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "reception_manager", "verification_manager", "qa_manager", "service_manager", "service_assistant_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
    "/training": ["admin", "super_hod", "hod", "sales_assistant_manager", "sales_executive", "sales_manager", "account_manager", "developer", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "reception_manager", "verification_manager", "qa_manager", "service_manager", "service_assistant_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
    "/posting-data": ["admin", "super_hod", "hod", "product_posting_manager", "product_posting_executive", "posting_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
    "/portfolio": ["admin", "verification_manager", "hod", "super_hod", "software_manager", "lead_manager", "lead_executive", "marketing_manager"],
    "/it": ["admin", "super_admin", "administrator", "super_hod", "it_manager", "developer", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "service_manager"],
    "/service": ["admin", "super_hod", "hod", "service_manager", "service_assistant_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
    "/customers": ["admin", "super_hod", "hod", "sales_assistant_manager", "sales_executive", "sales_manager", "account_manager", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "service_manager", "service_assistant_manager", "service_executive", "reception_manager", "product_posting_manager", "product_posting_executive", "posting_executive"],
    "/analytics": ["admin", "super_hod", "hod", "sales_manager", "account_manager", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
    "/support": ["admin", "super_hod", "hod", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
    "/gm-pool": ["admin", "super_hod", "hod", "sales_assistant_manager", "sales_manager", "sales_executive", "account_manager", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "service_manager", "service_assistant_manager", "service_executive", "reception_manager", "product_posting_manager", "product_posting_executive", "posting_executive"],
    "/policies": ["admin", "super_hod", "reception_manager", "software_manager", "lead_manager", "lead_executive", "marketing_manager"],
    "/notice-board": ["admin", "super_hod", "reception_manager", "service_manager", "software_manager", "lead_manager", "lead_executive", "marketing_manager"],
    "/dashboard/software-manager": ["admin", "software_manager"],
    "/dashboard/software-executive": ["admin", "software_executive", "software_manager"],
    "/dashboard/lead-manager": ["admin", "lead_manager", "software_manager"],
    "/dashboard/lead-executive": ["admin", "lead_executive", "lead_manager", "software_manager"],
    "/product-posting": ["admin", "product_posting_manager", "product_posting_executive", "posting_executive"],
    "/qa": ["admin", "qa_manager"],
    "/verification": ["admin", "verification_manager"],
};

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
    developer: "/dashboard/software-executive",
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
};

export function useRouteProtection() {
    const [location, setLocation] = useLocation();

    useEffect(() => {
        const userRole = sessionStorage.getItem("userRole")?.toLowerCase().replace(/\s+/g, "_") || "";

        // Check if current route requires specific permissions
        for (const [routePattern, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
            if (location.startsWith(routePattern)) {
                const isAllowed = allowedRoles.some(role => role.toLowerCase() === userRole);

                if (!isAllowed) {
                    // Redirect to role's default dashboard
                    const defaultDashboard = ROLE_DASHBOARDS[userRole] || "/";
                    console.log(`[Route Protection] Redirecting ${userRole} from ${location} to ${defaultDashboard}`);
                    setLocation(defaultDashboard);
                    return;
                }
            }
        }
    }, [location, setLocation]);
}
