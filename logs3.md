// Role Definitions
export const ROLES = {
  ADMIN: "admin",
  SALES_MANAGER: "sales_manager",
  SALES_ASSISTANT_MANAGER: "sales_assistant_manager",
  SALES_EXECUTIVE: "sales_executive",
  ACCOUNT_MANAGER: "account_manager",
  DEVELOPER: "developer",
  // Legacy roles (kept for backward compatibility)
  HOD: "hod",
  SUPER_HOD: "super_hod",
  JUNIOR_ADMIN: "junior_admin",
  PRODUCT_POSTING_EXECUTIVE: "product_posting_executive",
  PRODUCT_POSTING_MANAGER: "product_posting_manager",
  QA_MANAGER: "qa_manager",
  VERIFICATION_MANAGER: "verification_manager",
<<<<<<< HEAD
  POSTING_EXECUTIVE: "posting_executive",
=======
>>>>>>> bilal
  DD_MANAGER: "dd_manager",
  DD_EXECUTIVE: "dd_executive",
  IT_MANAGER: "it_manager",
  RECEPTION_MANAGER: "reception_manager",
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES] | string;

export function normalizeRole(role: string): RoleKey {
  if (!role) return ROLES.SALES_EXECUTIVE;

  const normalized = role.toLowerCase().trim();

  if (normalized === "admin" || normalized === "administrator" || normalized === "adm" || normalized === "super_admin") return ROLES.ADMIN;
  if (normalized === "super_hod" || normalized.includes("super_hod")) return ROLES.SUPER_HOD;
  if (normalized === "hod" || normalized.includes("head")) return ROLES.HOD;
  if (normalized === "junior_admin") return ROLES.JUNIOR_ADMIN;

  if (normalized.includes("sales") && normalized.includes("manager") && !normalized.includes("assistant")) return ROLES.SALES_MANAGER;
  if (normalized === "manager") return ROLES.SALES_MANAGER; // Map generic manager to sales manager

  if (normalized.includes("assistant")) return ROLES.SALES_ASSISTANT_MANAGER;
  if (normalized.includes("account")) return ROLES.ACCOUNT_MANAGER;
  if (normalized.includes("developer") || normalized.includes("dev")) return ROLES.DEVELOPER;
  if (normalized.includes("product") && normalized.includes("exec")) return ROLES.PRODUCT_POSTING_EXECUTIVE;
  if (normalized.includes("product") && normalized.includes("manage")) return ROLES.PRODUCT_POSTING_MANAGER;
  if (normalized.includes("reception")) return ROLES.RECEPTION_MANAGER;

  // Let any other custom role pass through in snake_case format
  return normalized.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export function isHodAllowed(role?: string | null): boolean {
  if (!role) return false;
  const n = normalizeRole(role);
  return (
    n === ROLES.SUPER_HOD ||
    n === ROLES.HOD ||
    n === ROLES.ADMIN ||
    n === ROLES.SALES_MANAGER
  );
}

export const HOD_ALLOWED_ROLES = ["super_hod", "hod", "admin", "manager"];
