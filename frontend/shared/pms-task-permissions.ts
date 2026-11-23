/** Department executives who may start/stop timers and submit work on PMS Task System. */
export const PMS_TASK_EXECUTION_ROLES: readonly string[] = [
  "product_posting_executive",
  "posting_executive",
  "dd_executive",
  "it_executive",
  "seo_smm_executive",
  "software_executive",
  "service_executive",
];

function normRoleKey(role: string): string {
  return role
    .toLowerCase()
    .trim()
    .replace(/d\s*&\s*d/g, "dd")
    .replace(/&/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

const EXECUTION_SET = new Set(PMS_TASK_EXECUTION_ROLES.map(normRoleKey));

export function roleCanExecutePmsTasks(role: string | null | undefined): boolean {
  if (!role) return false;
  return EXECUTION_SET.has(normRoleKey(role));
}

export function anyRoleCanExecutePmsTasks(roles: Iterable<string | null | undefined>): boolean {
  for (const r of roles) {
    if (roleCanExecutePmsTasks(r)) return true;
  }
  return false;
}

export function roleCanAssignPmsTasks(role: string | null | undefined): boolean {
  if (!role) return false;
  if (roleCanExecutePmsTasks(role)) return false;
  const n = normRoleKey(role);
  if (n === "sales_executive" || n === "sales_assistant_manager") return false;
  if (n.includes("sales") && n.includes("executive")) return false;
  if (n === "admin" || n === "hod" || n === "super_hod") return true;
  if (n.includes("manager") && !n.includes("account")) return true;
  return false;
}