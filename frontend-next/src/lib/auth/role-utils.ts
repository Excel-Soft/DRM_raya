/** Port of legacy `frontend/src/lib/role-utils.ts` — keep in sync for route guards. */
export function normalizeRole(roleId: string | null | undefined): string {
  if (!roleId) return "";
  return roleId
    .toLowerCase()
    .trim()
    .replace(/d\s*&\s*d/g, "dd")
    .replace(/&/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/(^|_)d_?n_?d(?=_|$)/g, "$1dd")
    .replace(/(^|_)d_d(?=_|$)/g, "$1dd");
}

/** Mirrors backend `isManagerialRole` for UI affordances (Express enforces writes). */
const MANAGERIAL_ROLE_IDS = new Set([
  "admin",
  "super_admin",
  "super_hod",
  "hod",
  "account_manager",
  "sales_manager",
  "sales_assistant_manager",
  "service_manager",
  "service_assistant_manager",
  "qa_manager",
  "verification_manager",
  "product_posting_manager",
  "dd_manager",
  "it_manager",
  "reception_manager",
  "seo_smm_manager",
  "software_manager",
  "lead_manager",
  "marketing_manager",
]);

export function isManagerialRole(roleId: string | null | undefined): boolean {
  const n = normalizeRole(roleId);
  if (!n) return false;
  if (MANAGERIAL_ROLE_IDS.has(n)) return true;
  if (n.includes("exec")) return false;
  return ["manager", "admin", "hod", "head", "supervisor"].some((t) => n.includes(t));
}

export function userCanManagePolicies(activeRoleId: string | null | undefined, roles: string[] | undefined): boolean {
  if (isManagerialRole(activeRoleId)) return true;
  return (roles ?? []).some((r) => isManagerialRole(r));
}

/** Whole-company report scope (legacy reports module). */
export function isCompanyWideRole(roleId: string | null | undefined): boolean {
  const normalized = normalizeRole(roleId);
  return ["admin", "super_admin", "super_hod", "hod", "account_manager"].includes(normalized);
}
