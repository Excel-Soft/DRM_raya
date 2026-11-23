// Sidebar visibility = DRM Permission page (drm.menu_permissions), the way old DRM did it
// (func.php accessUrls): a menu row grants a role when the role's DEPARTMENT is in the
// row's departments, or the role itself is in the row's allowed roles. A sub-item shows
// only if a granting row lists its sub-URL slug. No hardcoded role lists.
import { canonicalRoleKeys } from "@/lib/legacy-role-keys";

export interface MenuPermissionRow {
  name: string;
  permissions: { name: string; type?: string }[];
  subUrls: { isRoot?: boolean; items: string[] };
  allowedRoleIds: string[];
  isActive: boolean;
}

/** Role key -> old webxl_role.department (department names as stored on menu rows). */
export const ROLE_DEPARTMENT: Record<string, string> = {
  admin: "Admin", super_admin: "Admin", administrator: "Admin", adm: "Admin",
  junior_admin: "Junior Admin",
  sales_manager: "Sales Department", sales_executive: "Sales Department", sales_assistant_manager: "Sales Department",
  service_manager: "Service Department", service_assistant_manager: "Service Department", service_executive: "Service Department",
  reception_manager: "Reception Department", reception: "Reception Department",
  project_manager: "Project Department",
  account_manager: "Accounts Department", accounts_assistant_manager: "Accounts Department", account_auditor: "Accounts Department",
  seo_smm_manager: "SEO/SMM Department", seo_smm_executive: "SEO/SMM Department",
  product_posting_manager: "Product Posting", posting_manager: "Product Posting", posting_assistant_manager: "Product Posting",
  product_posting_executive: "Product Posting", posting_executive: "Product Posting",
  dd_manager: "D&D Department", dnd_manager: "D&D Department", dd_assistant_manager: "D&D Department", dd_executive: "D&D Department",
  internship_executive: "Internship & Trainee", trainee_executive: "Internship & Trainee",
  it_manager: "IT Department", it_executive: "IT Department",
  hod: "Head of Department", super_hod: "Head of Department",
  office_boy: "Web Excels", rnd: "Web Excels", full_salary: "Web Excels",
  wecl_manager: "WELC", wecl_assistant_manager: "WELC", wecl_reception: "WELC",
  lead_manager: "Lead Department", lead_executive: "Lead Department",
  qa_manager: "QA Department", verification_manager: "Verification Department",
  complaint_manager: "Complaint Department", marketing_manager: "Marketing Department",
  media_manager: "Media Department", media_executive: "Media Department",
  software_manager: "Software Department", software_executive: "Software Department",
  ta_manager: "Trade Assurance", ta_assistant_manager: "Trade Assurance", ta_executive: "Trade Assurance",
  developer: "Development Department",
};

/** Sidebar group name -> menu row name when they differ. */
const MENU_NAME_ALIASES: Record<string, string> = { "user reports": "user report" };

const norm = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const roleKey = (s: string) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, "_");
/** "Reports [L21]" -> "reports" (old DRM had several rows per menu). */
const baseMenuName = (s: string) => norm(String(s ?? "").replace(/\s*\[L\d+\]\s*$/, ""));
/** "Add Penalty → add-penalty" -> "add-penalty". */
export const subUrlSlug = (raw: string) => {
  const s = String(raw ?? "").trim();
  return (s.includes("→") ? s.split("→").pop()! : s).trim().toLowerCase();
};

export function menuRows(rows: MenuPermissionRow[], menuName: string): MenuPermissionRow[] {
  const key = MENU_NAME_ALIASES[norm(menuName)] ?? norm(menuName);
  return rows.filter((r) => baseMenuName(r.name) === key);
}

export function rowGrants(row: MenuPermissionRow, roles: string[]): boolean {
  if (!row.isActive) return false;
  const keys = roles.map(roleKey);
  const allowed = canonicalRoleKeys(row.allowedRoleIds).map(roleKey);
  if (keys.some((k) => allowed.includes(k))) return true;
  const depts = (row.permissions || []).map((d) => norm(d?.name));
  return keys.some((k) => ROLE_DEPARTMENT[k] && depts.includes(norm(ROLE_DEPARTMENT[k])));
}

/** Rows of this menu that grant one of the roles. */
export function grantingRows(rows: MenuPermissionRow[], menuName: string, roles: string[]): MenuPermissionRow[] {
  return menuRows(rows, menuName).filter((r) => rowGrants(r, roles));
}

/**
 * Sub-item visibility. `slug` = the old sub-URL slug. Pages that never existed in old DRM
 * (`newPage`) show with the menu until someone adds their slug as a sub-URL on any row of
 * that menu — from then on the sub-URL list controls them like every other page.
 */
export function subItemVisible(
  rows: MenuPermissionRow[], menuName: string, roles: string[], slug: string, newPage = false,
): boolean {
  const granting = grantingRows(rows, menuName, roles);
  if (granting.length === 0) return false;
  const s = slug.toLowerCase();
  if (granting.some((r) => (r.subUrls?.items || []).some((u) => subUrlSlug(u) === s))) return true;
  if (!newPage) return false;
  // Only the menu's main row counts here — "Reports [L21]"-style rows are narrow
  // grants for the pages they list (e.g. Vas Report for service manager).
  if (!granting.some((r) => !/\[L\d+\]\s*$/.test(String(r.name)))) return false;
  return !menuRows(rows, menuName).some((r) => (r.subUrls?.items || []).some((u) => subUrlSlug(u) === s));
}
