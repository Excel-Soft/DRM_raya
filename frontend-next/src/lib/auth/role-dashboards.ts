import { normalizeRole } from "./role-utils";

/** Port of legacy useRouteProtection ROLE_DASHBOARDS */
const ROLE_DASHBOARDS: Record<string, string> = {
  admin: "/dashboard",
  super_hod: "/dashboard",
  sales_manager: "/dashboard/sales-manager",
  sales_assistant_manager: "/dashboard/sales-assistant-manager",
  sales_executive: "/dashboard/sales-executive",
  account_manager: "/dashboard",
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

export function getDefaultDashboardPath(activeRoleId: string | null | undefined): string {
  const key = normalizeRole(activeRoleId);
  return ROLE_DASHBOARDS[key] || "/dashboard";
}
