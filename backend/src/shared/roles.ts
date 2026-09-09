/**
 * Authoritative role constants — single source of truth, safe for shared/,
 * server/, and client/ code to import (zero internal imports; `shared/` never
 * imports from `server/` or `client/`, per the enforced dependency direction:
 * client -> shared, server -> shared, shared -> nothing).
 *
 * This is the registry docs/completion/TRACEABILITY_MATRIX.md (P00-001)
 * identified as the one actually enforced by permission-checking code, of the
 * four disagreeing role registries found in that audit — that ambiguity
 * itself remains open pending MD-7
 * (docs/completion/MANAGEMENT_DECISIONS_REQUIRED.md).
 *
 * `server/utils/role-utils.ts` re-exports `ROLES`/`RoleKey` from here instead
 * of defining its own copy, so there is exactly one definition and every
 * existing consumer of `server/utils/role-utils.ts` keeps working unchanged.
 */
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
