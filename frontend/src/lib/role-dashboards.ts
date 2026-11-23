/** Default landing path when switching to or operating as a given role. */
export const ROLE_HOME_PATH: Record<string, string> = {
  admin: "/admin",
  super_admin: "/admin",
  administrator: "/admin",
  super_hod: "/dashboard/super-hod",
  hod: "/dashboard/hod",
  sales_manager: "/dashboard/sales-manager",
  sales_assistant_manager: "/dashboard/sales-assistant-manager",
  sales_executive: "/dashboard/sales-executive",
  account_manager: "/dashboard/account-manager",
  service_manager: "/dashboard/service-manager",
  service_assistant_manager: "/dashboard/service-assistant-manager",
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

export function getRoleHome(role: string): string {
  const key = role.toLowerCase().trim().replace(/[\s-]+/g, "_");
  return ROLE_HOME_PATH[key] || "/";
}

/** True when the URL is another role's primary dashboard (not general app pages). */
export function isOnRoleHomeDashboard(location: string, homePath: string): boolean {
  if (homePath === "/") {
    return location === "/" || location === "/dashboard";
  }
  return location === homePath || location.startsWith(`${homePath}/`);
}

export function findMismatchedRoleHome(location: string, activeRoleHome: string): string | null {
  for (const path of Object.values(ROLE_HOME_PATH)) {
    if (path === activeRoleHome) continue;
    if (isOnRoleHomeDashboard(location, path)) {
      return activeRoleHome;
    }
  }
  return null;
}
