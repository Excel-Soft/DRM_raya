// Role Definitions — re-exported from shared/roles.ts (the single source of
// truth) so that shared/ modules can depend on ROLES without importing
// server/, while every existing consumer of this module keeps working
// unchanged.
export { ROLES, type RoleKey } from "@shared/roles";
import { ROLES, type RoleKey } from "@shared/roles";

export function normalizeRole(role: string): RoleKey {
  if (!role) return ROLES.SALES_EXECUTIVE;

  // Unify separators (spaces AND hyphens) so hyphenated and spaced variants
  // normalize identically (e.g. "super-hod" -> "super_hod"), and collapse the
  // various "design & development" spellings (d&d / dnd / d_d / d-d) to "dd".
  let normalized = role.toLowerCase().trim()
    .replace(/d\s*&\s*d/g, 'dd') // 'd & d' / 'd&d' -> 'dd'
    .replace(/&/g, '')
    .replace(/[\s-]+/g, '_')      // spaces AND hyphens -> '_'
    .replace(/_+/g, '_')
    .replace(/(^|_)d_?n_?d(?=_|$)/g, '$1dd') // 'dnd' / 'd_n_d' -> 'dd'
    .replace(/(^|_)d_d(?=_|$)/g, '$1dd');    // 'd_d' (incl former 'd-d') -> 'dd'

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

/**
 * P02-002 fix: the authoritative explicit managerial-role list, extracted out
 * of `isManagerialRole` (below) into its own export so any OTHER code that
 * needs a static role array (e.g. `report-permission.ts`'s
 * `REPORT_PERMISSION_MATRIX`) can reference the exact same list instead of
 * hand-maintaining a second, driftable copy. `isManagerialRole` itself is
 * unchanged in behavior — this is a pure extraction, not a logic change —
 * and still additionally treats any role string containing "manager"/
 * "admin"/"hod"/"head"/"supervisor" (and not "exec") as managerial even if
 * it isn't in this explicit list (e.g. the ungoverned literal "hr_manager" —
 * see RBAC_ACTION_MATRIX.md's Table 4 finding on that role). That fallback
 * exists to catch legacy/ungoverned role strings outside the central `ROLES`
 * registry and is intentionally NOT reproduced in this static array, since a
 * static list cannot express a substring match — REPORT_PERMISSION_MATRIX
 * consumers should treat this list as the "known managerial roles" baseline,
 * not a byte-for-byte guarantee against every possible role string.
 *
 * NOTE: `ROLES.ACCOUNT_MANAGER` is included explicitly here even though the
 * original inline array (before this P02-002 extraction) omitted it — that
 * was a latent gap: `isManagerialRole("account_manager")` already returned
 * `true` today, but ONLY via the fallback substring match (the string
 * "account_manager" contains "manager"), not explicit membership. Found by
 * `report-permission-reconciliation.test.ts` comparing this list against the
 * live route gates. Adding it here is output-preserving for
 * `isManagerialRole` (still `true` for every caller, just via a robust path
 * instead of an accidental one) and is what makes `account_manager` correctly
 * appear in `MANAGERIAL_ROLES`-derived static lists like
 * `REPORT_PERMISSION_MATRIX`, which cannot express the substring fallback.
 */
export const MANAGERIAL_ROLES: string[] = [
  ROLES.ADMIN,
  ROLES.ACCOUNT_MANAGER,
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
];

export function isManagerialRole(role?: string | null): boolean {
  if (!role) return false;
  const n = normalizeRole(role);
  const managerTerms = ["manager", "admin", "hod", "head", "supervisor"];

  const isManager = MANAGERIAL_ROLES.includes(n as any);

  if (isManager) return true;

  // Additional check for manager terms, but EXCLUDE executives
  if (n.toLowerCase().includes("exec")) return false;

  return managerTerms.some(term => n.toLowerCase().includes(term));
}
