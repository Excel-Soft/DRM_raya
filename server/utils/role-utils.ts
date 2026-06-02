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
  SERVICE_MANAGER: "service_manager",
  SERVICE_ASSISTANT_MANAGER: "service_assistant_manager",
  SERVICE_EXECUTIVE: "service_executive",
  PRODUCT_POSTING_EXECUTIVE: "product_posting_executive",
  PRODUCT_POSTING_MANAGER: "product_posting_manager",
  QA_MANAGER: "qa_manager",
  VERIFICATION_MANAGER: "verification_manager",
  POSTING_EXECUTIVE: "posting_executive",
  DD_MANAGER: "dd_manager",
  DD_EXECUTIVE: "dd_executive",
  IT_MANAGER: "it_manager",
  RECEPTION_MANAGER: "reception_manager",
  SEO_SMM_MANAGER: "seo_smm_manager",
  SOFTWARE_MANAGER: "software_manager",
  SOFTWARE_EXECUTIVE: "software_executive",
  LEAD_MANAGER: "lead_manager",
  LEAD_EXECUTIVE: "lead_executive",
  MARKETING_MANAGER: "marketing_manager",
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES] | string;

export function normalizeRole(role: string): RoleKey {
  if (!role) return ROLES.SALES_EXECUTIVE;

  // Replace common special characters that shouldn't lead to underscores
  let normalized = role.toLowerCase().trim()
    .replace(/d\s*&\s*d/g, 'dd') // Map 'd & d' or 'd&d' to 'dd'
    .replace(/&/g, '')
    .replace(/\s+/g, '_');

  if (normalized === "admin" || normalized === "administrator" || normalized === "adm" || normalized === "super_admin") return ROLES.ADMIN;
  if (normalized === "super_hod" || normalized.includes("super_hod")) return ROLES.SUPER_HOD;
  if (normalized === "hod" || normalized.includes("head")) return ROLES.HOD;
  if (normalized === "service_executive") return ROLES.SERVICE_EXECUTIVE;
  if (normalized === "service_manager" || normalized === "service") return ROLES.SERVICE_MANAGER;
  if (normalized === "service_executive" || normalized.includes("service") && normalized.includes("exec")) return ROLES.SERVICE_EXECUTIVE;
  if (normalized.includes("seo") || normalized.includes("smm")) return ROLES.SEO_SMM_MANAGER;

  if (normalized.includes("sales") && normalized.includes("manager") && !normalized.includes("assistant")) return ROLES.SALES_MANAGER;
  if (normalized === "manager") return ROLES.SALES_MANAGER; // Map generic manager to sales manager

  if (normalized.includes("assistant")) return ROLES.SALES_ASSISTANT_MANAGER;
  if (normalized.includes("dd")) {
    if (normalized.includes("exec")) return ROLES.DD_EXECUTIVE;
    if (normalized.includes("manager")) return ROLES.DD_MANAGER;
    return ROLES.DD_MANAGER; // Default for dd if neither found
  }
  if (normalized.includes("account")) return ROLES.ACCOUNT_MANAGER;
  if (normalized.includes("developer") || normalized.includes("dev")) return ROLES.DEVELOPER;
  if (normalized.includes("product") && normalized.includes("exec")) return ROLES.PRODUCT_POSTING_EXECUTIVE;
  if (normalized.includes("product") && (normalized.includes("manage") || normalized.includes("manager"))) return ROLES.PRODUCT_POSTING_MANAGER;
  if (normalized.includes("software") && normalized.includes("manager")) return ROLES.SOFTWARE_MANAGER;
  if (normalized.includes("software") && (normalized.includes("exec") || normalized.includes("exce"))) return ROLES.SOFTWARE_EXECUTIVE;
  if (normalized.includes("posting") && normalized.includes("exec")) return ROLES.POSTING_EXECUTIVE;
  if (normalized.includes("posting") && normalized.includes("manager")) return ROLES.PRODUCT_POSTING_MANAGER;
  if (normalized.includes("marketing") && normalized.includes("manager")) return ROLES.MARKETING_MANAGER;

  // Clean up and collapse underscores
  normalized = normalized.replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').replace(/^_+|_+$/g, '');

  return (normalized || ROLES.SALES_EXECUTIVE) as RoleKey;
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

export const HOD_ALLOWED_ROLES = ["super_hod", "hod", "admin", "manager", "seo_smm_manager"];

export function isManagerialRole(role?: string | null): boolean {
  if (!role) return false;
  const n = normalizeRole(role);
  const managerTerms = ["manager", "admin", "hod", "head", "supervisor"];

  const isManager = [
    ROLES.ADMIN,
    ROLES.SALES_MANAGER,
    ROLES.SALES_ASSISTANT_MANAGER,
    ROLES.HOD,
    ROLES.SERVICE_MANAGER,
    ROLES.SERVICE_ASSISTANT_MANAGER,
    ROLES.SUPER_HOD,
    ROLES.QA_MANAGER,
    ROLES.VERIFICATION_MANAGER,
    ROLES.PRODUCT_POSTING_MANAGER,
    ROLES.DD_MANAGER,
    ROLES.IT_MANAGER,
    ROLES.RECEPTION_MANAGER,
    ROLES.SEO_SMM_MANAGER,
    ROLES.SOFTWARE_MANAGER,
    ROLES.LEAD_MANAGER,
    ROLES.MARKETING_MANAGER,
  ].includes(n as any);

  if (isManager) return true;

  // Additional check for manager terms, but EXCLUDE executives
  if (n.toLowerCase().includes("exec")) return false;
  
  return managerTerms.some(term => n.toLowerCase().includes(term));
}
