/**
 * Fallback menu visibility by permission name — ported from legacy
 * `frontend/src/components/app-sidebar.tsx` (`DEPT_NAME_TO_ROLES`).
 * Used when Next does not load `menu_permissions` from the API.
 */
export const MENU_PERM_ROLES: Record<string, string[]> = {
  Dashboard: ["admin", "super_admin", "administrator", "super_hod", "hod", "sales_executive", "sales_manager", "account_manager"],
  Customer: ["admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "it_executive", "reception_manager", "service_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive"],
  Attendance: ["admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod", "developer", "support_agent", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "it_executive", "reception_manager", "service_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive"],
  LEAD: ["admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "it_executive", "reception_manager", "service_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive"],
  PMS: ["admin", "super_admin", "service_manager", "service_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod", "developer", "support_agent", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "it_executive", "reception_manager", "software_manager", "software_executive", "lead_manager", "lead_executive"],
  "User Reports": ["admin", "sales_executive", "sales_manager", "account_manager", "manager", "hod", "super_hod", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "it_executive", "reception_manager", "service_manager", "service_executive", "seo_smm_manager", "seo_smm_executive", "software_manager", "software_executive", "lead_manager", "lead_executive"],
  Training: ["admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod", "developer", "support_agent", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "it_executive", "reception_manager", "service_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive"],
  /** Legacy `DEPT_NAME_TO_ROLES` fallback — keep in sync with `app-sidebar.tsx`. */
  Notice: ["admin", "super_admin", "reception_manager", "seo_smm_manager", "seo_smm_executive"],
  "Notice Board": ["admin", "super_admin", "reception_manager", "seo_smm_manager", "seo_smm_executive"],
  "DRM Policies": ["admin", "super_admin", "reception_manager"],
  Portfolio: ["admin", "verification_manager", "hod", "super_hod", "seo_smm_manager", "seo_smm_executive", "software_manager", "lead_manager", "lead_executive", "marketing_manager"],
  "DRM Setting": ["admin", "super_admin", "administrator", "super_hod", "service_manager"],
  Admin: ["admin", "super_admin", "administrator", "super_hod"],
  Users: ["admin", "super_admin", "administrator", "super_hod"],
  Support: ["admin", "super_hod", "hod", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "seo_smm_executive"],
  Account: ["admin", "super_hod", "hod", "account_manager", "sales_manager"],
  "Office Account": ["admin", "super_hod", "hod", "account_manager"],
  Reports: ["admin", "super_hod", "hod", "service_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "it_manager", "it_executive", "reception_manager", "account_manager"],
  Increment: ["admin", "super_admin", "super_hod", "hod", "manager", "sales_manager", "sales_assistant_manager", "account_manager", "service_manager", "software_manager", "it_manager", "lead_manager", "marketing_manager", "qa_manager", "verification_manager", "dd_manager", "product_posting_manager", "reception_manager", "seo_smm_manager"],
  "Add Penalty": ["admin", "super_admin", "super_hod", "hod", "hr", "hr_manager", "dd_manager", "dnd_manager", "product_posting_manager", "software_manager"],
  "Domain Hosting": ["admin", "it_manager", "it_executive", "developer", "super_hod", "hod"],
  Branches: ["admin", "super_admin", "super_hod", "hod"],
  "Posting Data": ["admin", "hod", "super_hod", "product_posting_manager", "product_posting_executive", "posting_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"],
  "Target System": ["admin", "sales_manager", "hod", "super_hod"],
  Events: ["admin", "hod", "super_hod", "marketing_manager", "reception_manager"],
  "Social Media Posting": ["admin", "hod", "super_hod", "marketing_manager"],
  "Daily Reports": ["admin", "super_admin"],
  "Allowed IP": ["admin", "super_admin"],
};

const ADMIN_BYPASS = new Set(["admin", "super_admin", "administrator", "adm"]);

export function roleSet(activeRoleId: string | null | undefined, userRoles: string[] | undefined): Set<string> {
  const set = new Set<string>();
  const add = (r: string | null | undefined) => {
    if (!r) return;
    set.add(r.toLowerCase().trim().replace(/\s+/g, "_"));
  };
  add(activeRoleId);
  (userRoles ?? []).forEach(add);
  if (set.has("product_posting_executive")) set.add("posting_executive");
  if (set.has("posting_executive")) set.add("product_posting_executive");
  return set;
}

/** Menu visibility hint — not authorization. */
export function hasMenuPermAccess(
  permKey: string | undefined,
  activeRoleId: string | null | undefined,
  userRoles: string[] | undefined,
): boolean {
  if (!permKey) return true;
  const roles = roleSet(activeRoleId, userRoles);
  if (Array.from(roles).some((r) => ADMIN_BYPASS.has(r))) return true;

  if (roles.has("posting_executive") || roles.has("product_posting_executive")) {
    if (permKey === "Portfolio") return false;
  }
  if (roles.has("sales_assistant_manager") && permKey === "Target System") return false;

  const allowed = MENU_PERM_ROLES[permKey];
  if (!allowed) return true;
  return Array.from(roles).some((r) => allowed.includes(r));
}
