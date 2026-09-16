import { ROLES } from "@shared/roles";

// Human-readable labels for the role switcher UI (frontend/src/components/top-bar.tsx
// falls back to this same {key, label} shape via DEFAULT_MANAGEABLE_ROLES when this
// registry is unavailable, so we match it here).
const ROLE_LABELS: Record<string, string> = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.SALES_MANAGER]: "Sales Manager",
  [ROLES.SALES_ASSISTANT_MANAGER]: "Sales Assistant Manager",
  [ROLES.SALES_EXECUTIVE]: "Sales Executive",
  [ROLES.ACCOUNT_MANAGER]: "Account Manager",
  [ROLES.DEVELOPER]: "Developer",
  [ROLES.HOD]: "HOD",
  [ROLES.SUPER_HOD]: "Super HOD",
  [ROLES.SERVICE_MANAGER]: "Service Manager",
  [ROLES.SERVICE_ASSISTANT_MANAGER]: "Service Assistant Manager",
  [ROLES.SERVICE_EXECUTIVE]: "Service Executive",
  [ROLES.PRODUCT_POSTING_EXECUTIVE]: "Product Posting Executive",
  [ROLES.PRODUCT_POSTING_MANAGER]: "Product Posting Manager",
  [ROLES.QA_MANAGER]: "QA Manager",
  [ROLES.VERIFICATION_MANAGER]: "Verification Manager",
  [ROLES.POSTING_EXECUTIVE]: "Posting Executive",
  [ROLES.DD_MANAGER]: "D&D Manager",
  [ROLES.DD_EXECUTIVE]: "D&D Executive",
  [ROLES.IT_MANAGER]: "IT Manager",
  [ROLES.RECEPTION_MANAGER]: "Reception Manager",
  [ROLES.SEO_SMM_MANAGER]: "SEO/SMM Manager",
  [ROLES.SOFTWARE_MANAGER]: "Software Manager",
  [ROLES.SOFTWARE_EXECUTIVE]: "Software Executive",
  [ROLES.LEAD_MANAGER]: "Lead Manager",
  [ROLES.LEAD_EXECUTIVE]: "Lead Executive",
  [ROLES.MARKETING_MANAGER]: "Marketing Manager",
};

// {key, label}[] — the shape rbac-routes.ts's GET /me/navigation handler expects
// (`ROLE_REGISTRY.filter(r => r.key !== ROLES.ADMIN)`) and passes straight through
// to the frontend's role switcher (frontend/src/components/top-bar.tsx), which reads
// role.key / role.label.
export const ROLE_REGISTRY = Object.values(ROLES).map((key) => ({
  key,
  label: ROLE_LABELS[key] || key,
}));

// The frontend does not currently read the "navigation" field returned by
// GET /me/navigation (grep-confirmed: no consumer of navData.navigation), so a
// real menu-building implementation has nothing to build for yet. Returning a
// plain array synchronously (instead of the previous unawaited stub Promise)
// is what makes JSON.stringify(navigation) round-trip to real JSON instead of
// silently serializing to "{}".
export function getNavigationForRole(_role: string, _isAdmin: boolean): unknown[] {
  return [];
}
