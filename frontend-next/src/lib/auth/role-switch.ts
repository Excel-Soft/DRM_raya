import { apiRequest } from "@/lib/query/query-client";
import { normalizeRole } from "@/lib/auth/role-utils";
import { persistLoginSession } from "@/lib/auth/session";

export type ManageableRole = { key: string; label: string };

export const DEFAULT_MANAGEABLE_ROLES: ManageableRole[] = [
  { key: "sales_manager", label: "Sales Manager" },
  { key: "sales_assistant_manager", label: "Sales Assistant Manager" },
  { key: "sales_executive", label: "Sales Executive" },
  { key: "service_manager", label: "Service Manager" },
  { key: "service_assistant_manager", label: "Service Assistant Manager" },
  { key: "service_executive", label: "Service Executive" },
  { key: "super_hod", label: "Super HOD" },
  { key: "hod", label: "HOD" },
  { key: "account_manager", label: "Account Manager" },
  { key: "developer", label: "Developer" },
  { key: "qa_manager", label: "QA Manager" },
  { key: "verification_manager", label: "Verification Manager" },
  { key: "product_posting_manager", label: "Product Posting Manager" },
  { key: "product_posting_executive", label: "Product Posting Executive" },
  { key: "posting_executive", label: "Posting Executive" },
  { key: "dd_manager", label: "D&D Manager" },
  { key: "dd_executive", label: "D&D Executive" },
  { key: "it_manager", label: "IT Manager" },
  { key: "reception_manager", label: "Reception Manager" },
  { key: "seo_smm_manager", label: "SEO/SMM Manager" },
  { key: "software_manager", label: "Software Manager" },
  { key: "software_executive", label: "Software Executive" },
  { key: "lead_manager", label: "Lead Manager" },
  { key: "lead_executive", label: "Lead Executive" },
  { key: "marketing_manager", label: "Marketing Manager" },
  { key: "complaint_manager", label: "Complaint Manager" },
  { key: "admin", label: "Admin" },
];

const ROLE_DASHBOARDS: Record<string, string> = {
  sales_manager: "/dashboard/sales-manager",
  sales_assistant_manager: "/dashboard/sales-assistant-manager",
  sales_executive: "/dashboard/sales-executive",
  account_manager: "/dashboard/account-manager",
  service_manager: "/dashboard/service-manager",
  service_assistant_manager: "/dashboard/service-assistant-manager",
  service_executive: "/dashboard/service-executive",
  super_hod: "/dashboard/super-hod",
  hod: "/dashboard/hod",
  dd_manager: "/dashboard/dd-manager",
  dd_executive: "/dashboard/dd-executive",
  qa_manager: "/qa/manager",
  verification_manager: "/verification/manager",
  product_posting_manager: "/product-posting/manager",
  product_posting_executive: "/product-posting/executive",
  posting_executive: "/product-posting/executive",
  developer: "/dashboard/developer",
  it_manager: "/dashboard/it-manager",
  reception_manager: "/dashboard/reception",
  software_manager: "/dashboard/software-manager",
  software_executive: "/dashboard/software-executive",
  lead_manager: "/dashboard/lead-manager",
  lead_executive: "/dashboard/lead-executive",
  seo_smm_manager: "/dashboard/seo-smm",
  marketing_manager: "/dashboard/marketing-manager",
  complaint_manager: "/dashboard/complaint-manager",
  admin: "/dashboard",
};

const ADMIN_ROLE_KEYS = new Set(["admin", "super_admin", "adm"]);

export function isAdminActor(activeRoleId: string, assignedRoles: string[]): boolean {
  const keys = [normalizeRole(activeRoleId), ...assignedRoles.map(normalizeRole)];
  return keys.some((k) => ADMIN_ROLE_KEYS.has(k));
}

export function formatRoleLabel(roleKey: string): string {
  return roleKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function dashboardPathForRole(roleKey: string): string {
  const key = normalizeRole(roleKey);
  return ROLE_DASHBOARDS[key] || "/dashboard";
}

export async function switchActiveRole(params: {
  roleKey: string;
  assignedRoles: string[];
  activeRoleId: string;
}): Promise<void> {
  const { roleKey, assignedRoles, activeRoleId } = params;
  const isAdmin = isAdminActor(activeRoleId, assignedRoles);

  const res = isAdmin
    ? await apiRequest("POST", "/api/admin/impersonate", { roleKey })
    : await apiRequest("POST", "/api/auth/set-active-role", { roleId: roleKey });

  const data = await res.json();
  if (!res.ok || !data?.success || !data?.token) {
    throw new Error(data?.message || data?.error || "Role switch failed");
  }

  const actingRole = (data.actingRole as string) || roleKey;
  persistLoginSession({
    token: data.token,
    user: { role: actingRole, roles: assignedRoles },
  });

  const s = window.sessionStorage;
  s.setItem("userRole", actingRole);
  s.setItem("roleSwitchInProgress", Date.now().toString());
  if (isAdmin) {
    s.setItem("isImpersonating", "true");
  } else {
    s.removeItem("isImpersonating");
  }

  const target = dashboardPathForRole(roleKey);
  if (window.location.pathname === target) {
    window.location.reload();
  } else {
    window.location.href = target;
  }
}

export async function stopRoleImpersonation(): Promise<void> {
  const res = await apiRequest("POST", "/api/admin/impersonate/stop");
  const data = await res.json();
  if (data?.success && data?.token) {
    window.sessionStorage.setItem("token", data.token);
  }
  window.sessionStorage.removeItem("isImpersonating");
  window.sessionStorage.setItem("roleSwitchInProgress", Date.now().toString());
  window.location.reload();
}
