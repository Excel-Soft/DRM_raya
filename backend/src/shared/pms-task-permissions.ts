import { ROLES } from "./roles";

/** Department executives who may start/stop timers and submit work on PMS Task System. */
export const PMS_TASK_EXECUTION_ROLES: readonly string[] = [
  ROLES.PRODUCT_POSTING_EXECUTIVE,
  ROLES.POSTING_EXECUTIVE,
  ROLES.DD_EXECUTIVE,
  ROLES.IT_EXECUTIVE,
  ROLES.SEO_SMM_EXECUTIVE,
  ROLES.SOFTWARE_EXECUTIVE,
  ROLES.SERVICE_EXECUTIVE,
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

/** Managers who may assign/create tasks (not sales-facing read-only roles). */
export function roleCanAssignPmsTasks(role: string | null | undefined): boolean {
  if (!role) return false;
  if (roleCanExecutePmsTasks(role)) return false;
  const n = normRoleKey(role);
  if (n === ROLES.SALES_EXECUTIVE || n === ROLES.SALES_ASSISTANT_MANAGER) return false;
  if (n.includes("sales") && n.includes("executive")) return false;
  if (n === ROLES.ADMIN || n === ROLES.HOD || n === ROLES.SUPER_HOD) return true;
  if (n.includes("manager") && !n.includes("account")) return true;
  return false;
}