/**
 * Patch 5 — GM/Sales canonical constants, enums and mapping helpers.
 *
 * STAGE 1 FOUNDATION ONLY. These are TypeScript-level canonical values used by
 * validation, config and (in later stages) workflow code. They DO NOT replace or
 * mutate the existing Postgres enum types in `shared/schema.ts`. Where a canonical
 * value differs from what the database currently stores, use the mapping helpers
 * below — they are fallback-safe and never throw, returning `{ ok, value, warnings }`.
 *
 * This file must not import server-only modules (it is shared client/server).
 */
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Canonical Patch 5 values                                                   */
/* -------------------------------------------------------------------------- */

/** Canonical GM type. NOTE: in the DB this is represented by the integer flags
 *  `is_loan` / `is_partial_payment` on `drm.gm_entries`, NOT by `gm_entry_type`
 *  (which is GM/TempGM/RefundGM). */
export const GM_TYPES = {
  FULL: "FULL",
  PARTIAL: "PARTIAL",
  LOAN: "LOAN",
} as const;
export type GmType = (typeof GM_TYPES)[keyof typeof GM_TYPES];
export const GM_TYPE_VALUES = Object.values(GM_TYPES) as GmType[];

/** Canonical invoice "type" (today stored as the free-text project name on
 *  `drm.product_posting_invoices`). */
export const INVOICE_TYPES = {
  LISTING_PAGE: "LISTING_PAGE",
  MINIWEBSITE: "MINIWEBSITE",
  PRODUCT_POSTING: "PRODUCT_POSTING",
} as const;
export type InvoiceType = (typeof INVOICE_TYPES)[keyof typeof INVOICE_TYPES];
export const INVOICE_TYPE_VALUES = Object.values(INVOICE_TYPES) as InvoiceType[];

/** Canonical GM workflow stages (superset of the current DB statuses). */
export const GM_WORKFLOW_STAGES = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  PENDING_HOD: "PENDING_HOD",
  PENDING_ACCOUNTS: "PENDING_ACCOUNTS",
  PENDING_ADMIN: "PENDING_ADMIN",
  PARTIAL_PAYMENT_PENDING: "PARTIAL_PAYMENT_PENDING",
  PARTIAL_FULLY_PAID: "PARTIAL_FULLY_PAID",
  LOAN_RETURN_PENDING: "LOAN_RETURN_PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  PROJECT_CREATED: "PROJECT_CREATED",
} as const;
export type GmWorkflowStage = (typeof GM_WORKFLOW_STAGES)[keyof typeof GM_WORKFLOW_STAGES];
export const GM_WORKFLOW_STAGE_VALUES = Object.values(GM_WORKFLOW_STAGES) as GmWorkflowStage[];

/** Canonical invoice workflow statuses. */
export const INVOICE_WORKFLOW_STATUSES = {
  DRAFT: "DRAFT",
  PENDING_HOD: "PENDING_HOD",
  PENDING_ACCOUNT: "PENDING_ACCOUNT",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
} as const;
export type InvoiceWorkflowStatus =
  (typeof INVOICE_WORKFLOW_STATUSES)[keyof typeof INVOICE_WORKFLOW_STATUSES];
export const INVOICE_WORKFLOW_STATUS_VALUES = Object.values(
  INVOICE_WORKFLOW_STATUSES,
) as InvoiceWorkflowStatus[];

/** Canonical project initial-status options. */
export const PROJECT_INITIAL_STATUSES = {
  ACTIVE: "ACTIVE",
  DOCUMENTS_PENDING: "DOCUMENTS_PENDING",
  PENDING_PROJECT: "PENDING_PROJECT",
  IN_EXECUTION: "IN_EXECUTION",
} as const;
export type ProjectInitialStatus =
  (typeof PROJECT_INITIAL_STATUSES)[keyof typeof PROJECT_INITIAL_STATUSES];
export const PROJECT_INITIAL_STATUS_VALUES = Object.values(
  PROJECT_INITIAL_STATUSES,
) as ProjectInitialStatus[];

/** GM invoice generation timing (config-controlled). */
export const GM_INVOICE_GENERATION_TIMING = {
  ON_GM_CREATION: "ON_GM_CREATION",
  AFTER_FINAL_GM_APPROVAL: "AFTER_FINAL_GM_APPROVAL",
} as const;
export type GmInvoiceGenerationTiming =
  (typeof GM_INVOICE_GENERATION_TIMING)[keyof typeof GM_INVOICE_GENERATION_TIMING];

/** How an approved invoice becomes a project (config-controlled, Stage 5 P9).
 *  MANUAL (default) preserves today's PMS pending-invoices queue: account
 *  approval only *enables* creation. AUTOMATIC creates/links exactly one root
 *  project on final account approval. The manual generate endpoint works in
 *  either mode (explicit invocation). */
export const PROJECT_GENERATION_MODE = {
  MANUAL: "MANUAL",
  AUTOMATIC: "AUTOMATIC",
} as const;
export type ProjectGenerationMode =
  (typeof PROJECT_GENERATION_MODE)[keyof typeof PROJECT_GENERATION_MODE];

/** Project-to-project dependency kinds (Stage 5 P10). LISTING_PAGE_QA_APPROVAL:
 *  a Product Posting project may not start until the same GM's Listing Page
 *  project has passed QA. */
export const PROJECT_DEPENDENCY_TYPES = {
  LISTING_PAGE_QA_APPROVAL: "LISTING_PAGE_QA_APPROVAL",
} as const;
export type ProjectDependencyType =
  (typeof PROJECT_DEPENDENCY_TYPES)[keyof typeof PROJECT_DEPENDENCY_TYPES];

/** Project routing "kind" stored on drm.projects.project_type (Stage 5).
 *  INVOICE_ROOT = the single project generated/linked for an approved invoice;
 *  SUBPROJECT = a child created by the assign-task flow. */
export const PROJECT_TYPES = {
  INVOICE_ROOT: "INVOICE_ROOT",
  SUBPROJECT: "SUBPROJECT",
} as const;
export type ProjectType = (typeof PROJECT_TYPES)[keyof typeof PROJECT_TYPES];

/* -------------------------------------------------------------------------- */
/* Existing DB enum values (source of truth lives in shared/schema.ts)        */
/* -------------------------------------------------------------------------- */

export const DB_GM_ENTRY_TYPE = ["GM", "TempGM", "RefundGM"] as const;
export const DB_GM_ENTRY_STATUS = ["Pending", "Approved", "Rejected", "Completed"] as const;
export const DB_PRODUCT_INVOICE_STATUS = [
  "PENDING_HOD",
  "PENDING_ACCOUNT",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export const DB_LEGACY_INVOICE_STATUS = [
  "Draft",
  "Pending",
  "Sent",
  "Paid",
  "Overdue",
  "Cancelled",
] as const;
export const DB_PROJECT_STATUS = [
  "Active",
  "Completed",
  "OnHold",
  "READY_FOR_QA",
  "IN_EXECUTION",
] as const;

export type DbProjectStatus = (typeof DB_PROJECT_STATUS)[number];
export type DbProductInvoiceStatus = (typeof DB_PRODUCT_INVOICE_STATUS)[number];
export type DbLegacyInvoiceStatus = (typeof DB_LEGACY_INVOICE_STATUS)[number];

/** Default product-posting "project names" the system creates today. */
export const INVOICE_TYPE_TO_PRODUCT_NAME: Record<InvoiceType, string> = {
  LISTING_PAGE: "Listing Page",
  MINIWEBSITE: "Alibaba Minisite",
  PRODUCT_POSTING: "Alibaba Product Posting",
};

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

export const gmTypeSchema = z.enum([GM_TYPES.FULL, GM_TYPES.PARTIAL, GM_TYPES.LOAN]);
export const invoiceTypeSchema = z.enum([
  INVOICE_TYPES.LISTING_PAGE,
  INVOICE_TYPES.MINIWEBSITE,
  INVOICE_TYPES.PRODUCT_POSTING,
]);
export const invoiceWorkflowStatusSchema = z.enum(
  INVOICE_WORKFLOW_STATUS_VALUES as [string, ...string[]],
);
export const gmWorkflowStageSchema = z.enum(
  GM_WORKFLOW_STAGE_VALUES as [string, ...string[]],
);
export const projectInitialStatusSchema = z.enum([
  PROJECT_INITIAL_STATUSES.ACTIVE,
  PROJECT_INITIAL_STATUSES.DOCUMENTS_PENDING,
  PROJECT_INITIAL_STATUSES.PENDING_PROJECT,
  PROJECT_INITIAL_STATUSES.IN_EXECUTION,
]);
export const gmInvoiceGenerationTimingSchema = z.enum([
  GM_INVOICE_GENERATION_TIMING.ON_GM_CREATION,
  GM_INVOICE_GENERATION_TIMING.AFTER_FINAL_GM_APPROVAL,
]);
export const projectGenerationModeSchema = z.enum([
  PROJECT_GENERATION_MODE.MANUAL,
  PROJECT_GENERATION_MODE.AUTOMATIC,
]);
export const projectDependencyTypeSchema = z.enum([
  PROJECT_DEPENDENCY_TYPES.LISTING_PAGE_QA_APPROVAL,
]);

/* -------------------------------------------------------------------------- */
/* Mapping helpers — fallback-safe, never throw                               */
/* -------------------------------------------------------------------------- */

export interface MapResult<T> {
  ok: boolean;
  value: T | null;
  warnings: string[];
}

/** Canonical GM type -> DB integer flags on `drm.gm_entries`. `gm_entry_type`
 *  is intentionally left unchanged (stays "GM"). */
export function mapGmTypeToDbFlags(
  gmType: string | null | undefined,
): MapResult<{ isLoan: number; isPartialPayment: number }> {
  const norm = String(gmType ?? "").trim().toUpperCase();
  switch (norm) {
    case GM_TYPES.FULL:
      return { ok: true, value: { isLoan: 0, isPartialPayment: 0 }, warnings: [] };
    case GM_TYPES.PARTIAL:
      return { ok: true, value: { isLoan: 0, isPartialPayment: 1 }, warnings: [] };
    case GM_TYPES.LOAN:
      return { ok: true, value: { isLoan: 1, isPartialPayment: 0 }, warnings: [] };
    default:
      return { ok: false, value: null, warnings: [`Unknown GM type "${gmType}"`] };
  }
}

/** DB integer flags -> canonical GM type. */
export function mapDbFlagsToGmType(
  isLoan: number | boolean | null | undefined,
  isPartialPayment: number | boolean | null | undefined,
): MapResult<GmType> {
  const loan = Number(isLoan) === 1 || isLoan === true;
  const partial = Number(isPartialPayment) === 1 || isPartialPayment === true;
  if (loan) {
    return {
      ok: true,
      value: GM_TYPES.LOAN,
      warnings: partial ? ["both is_loan and is_partial_payment set; treated as LOAN"] : [],
    };
  }
  if (partial) return { ok: true, value: GM_TYPES.PARTIAL, warnings: [] };
  return { ok: true, value: GM_TYPES.FULL, warnings: [] };
}

/** Canonical invoice type -> the product-posting project name used today. */
export function mapInvoiceTypeToProductName(
  invoiceType: string | null | undefined,
): MapResult<string> {
  const norm = String(invoiceType ?? "").trim().toUpperCase() as InvoiceType;
  const name = INVOICE_TYPE_TO_PRODUCT_NAME[norm];
  if (!name) return { ok: false, value: null, warnings: [`Unknown invoice type "${invoiceType}"`] };
  return { ok: true, value: name, warnings: [] };
}

/** Canonical invoice workflow status -> `product_invoice_status` DB enum. */
export function mapInvoiceStatusToProductDb(
  status: string | null | undefined,
): MapResult<DbProductInvoiceStatus> {
  const norm = String(status ?? "").trim().toUpperCase();
  const direct: Partial<Record<string, DbProductInvoiceStatus>> = {
    PENDING_HOD: "PENDING_HOD",
    PENDING_ACCOUNT: "PENDING_ACCOUNT",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    CANCELLED: "CANCELLED",
  };
  if (direct[norm]) return { ok: true, value: direct[norm]!, warnings: [] };
  if (norm === INVOICE_WORKFLOW_STATUSES.DRAFT) {
    return { ok: false, value: null, warnings: ["DRAFT has no product_invoice_status equivalent"] };
  }
  if (norm === INVOICE_WORKFLOW_STATUSES.PAID) {
    return { ok: false, value: null, warnings: ["PAID is tracked separately, not in product_invoice_status"] };
  }
  return { ok: false, value: null, warnings: [`Unknown invoice status "${status}"`] };
}

/** Canonical invoice workflow status -> legacy `invoice_status` DB enum. */
export function mapInvoiceStatusToLegacyDb(
  status: string | null | undefined,
): MapResult<DbLegacyInvoiceStatus> {
  const norm = String(status ?? "").trim().toUpperCase();
  const m: Partial<Record<string, DbLegacyInvoiceStatus>> = {
    DRAFT: "Draft",
    PENDING_HOD: "Pending",
    PENDING_ACCOUNT: "Pending",
    APPROVED: "Sent",
    PAID: "Paid",
    CANCELLED: "Cancelled",
    REJECTED: "Cancelled",
  };
  if (m[norm]) {
    const warnings =
      norm === "REJECTED"
        ? ["legacy invoice_status has no REJECTED; mapped to Cancelled"]
        : norm === "APPROVED"
          ? ["APPROVED mapped to legacy 'Sent'"]
          : [];
    return { ok: true, value: m[norm]!, warnings };
  }
  return { ok: false, value: null, warnings: [`Unknown invoice status "${status}"`] };
}

/** Canonical project initial status -> DB `project_status` enum. Values with no
 *  DB equivalent (DOCUMENTS_PENDING, PENDING_PROJECT) return ok:false so callers
 *  decide explicitly (these require a future, management-confirmed DB change). */
export function mapProjectInitialStatusToDb(
  status: string | null | undefined,
): MapResult<DbProjectStatus> {
  const norm = String(status ?? "").trim().toUpperCase();
  if (norm === PROJECT_INITIAL_STATUSES.ACTIVE) return { ok: true, value: "Active", warnings: [] };
  if (norm === PROJECT_INITIAL_STATUSES.IN_EXECUTION)
    return { ok: true, value: "IN_EXECUTION", warnings: [] };
  if (norm === PROJECT_INITIAL_STATUSES.DOCUMENTS_PENDING || norm === PROJECT_INITIAL_STATUSES.PENDING_PROJECT) {
    return {
      ok: false,
      value: null,
      warnings: [`'${norm}' has no project_status DB enum value yet (requires a confirmed schema change)`],
    };
  }
  return { ok: false, value: null, warnings: [`Unknown project initial status "${status}"`] };
}

/* -------------------------------------------------------------------------- */
/* Config schema + safe defaults                                              */
/* -------------------------------------------------------------------------- */

export const roleArraySchema = z.array(z.string().min(1));
/** { [gmType]: { [package]: minAmount } }. Empty => no enforcement. */
export const minimumPaymentThresholdsSchema = z.record(
  z.string(),
  z.record(z.string(), z.number().nonnegative()),
);

export const gmSalesConfigSchema = z
  .object({
    serviceExecutiveCanCreateGM: z.boolean(),
    serviceExecutiveCanCreateManualInvoice: z.boolean(),
    gmInvoiceGenerationTiming: gmInvoiceGenerationTimingSchema,
    projectGenerationMode: projectGenerationModeSchema,
    requireProductPostingWaitForListingQa: z.boolean(),
    verificationManagerRequiredAfterQa: z.boolean(),
    defaultProjectStatusAfterInvoiceApproval: projectInitialStatusSchema,
    minimumPaymentThresholds: minimumPaymentThresholdsSchema,
    fullGmAllowedInitiatorRoles: roleArraySchema,
    partialGmAllowedInitiatorRoles: roleArraySchema,
    loanGmAllowedInitiatorRoles: roleArraySchema,
    accountGmAllowedInitiatorRoles: roleArraySchema,
    gmCreateOverrideRoles: roleArraySchema,
    loanGmCreationEnabled: z.boolean(),
  })
  .strict();

export const gmSalesConfigPatchSchema = gmSalesConfigSchema.partial().strict();

export type GmSalesConfig = z.infer<typeof gmSalesConfigSchema>;
export type GmSalesConfigKey = keyof GmSalesConfig;

/** SAFE DEFAULTS — chosen to preserve current behaviour and to NOT pre-decide
 *  any management-confirmed rule. */
export const GM_SALES_CONFIG_DEFAULTS: GmSalesConfig = {
  serviceExecutiveCanCreateGM: false,
  serviceExecutiveCanCreateManualInvoice: false,
  gmInvoiceGenerationTiming: GM_INVOICE_GENERATION_TIMING.ON_GM_CREATION,
  projectGenerationMode: PROJECT_GENERATION_MODE.MANUAL,
  requireProductPostingWaitForListingQa: false,
  verificationManagerRequiredAfterQa: true,
  defaultProjectStatusAfterInvoiceApproval: PROJECT_INITIAL_STATUSES.ACTIVE,
  minimumPaymentThresholds: {},
  fullGmAllowedInitiatorRoles: ["sales_executive"],
  partialGmAllowedInitiatorRoles: ["sales_executive"],
  loanGmAllowedInitiatorRoles: ["sales_executive"],
  accountGmAllowedInitiatorRoles: ["account_manager", "hod", "super_hod", "sales_manager"],
  gmCreateOverrideRoles: ["admin", "super_hod"],
  loanGmCreationEnabled: true,
};

export const GM_SALES_CONFIG_KEY_DESCRIPTIONS: Record<GmSalesConfigKey, string> = {
  serviceExecutiveCanCreateGM:
    "Whether Service Executives may create GM records (false until management confirms).",
  serviceExecutiveCanCreateManualInvoice:
    "Whether Service Executives may create manual invoices (false until management confirms).",
  gmInvoiceGenerationTiming:
    "When the 3 default invoices are generated: ON_GM_CREATION (current) or AFTER_FINAL_GM_APPROVAL.",
  projectGenerationMode:
    "How an approved invoice becomes a project: MANUAL (current PMS pending-invoices queue) or AUTOMATIC (auto-create one root project on final account approval).",
  requireProductPostingWaitForListingQa:
    "If true, Product Posting cannot start until Listing-Page QA is complete.",
  verificationManagerRequiredAfterQa:
    "If true, Verification Manager stage is required after QA completion (reflects current product-posting behaviour).",
  defaultProjectStatusAfterInvoiceApproval:
    "Initial project status after final invoice approval (ACTIVE preserves current behaviour).",
  minimumPaymentThresholds:
    "Map { gmType: { package: minAmount } }. Empty map = no minimum threshold enforcement.",
  fullGmAllowedInitiatorRoles: "Roles allowed to initiate a FULL GM.",
  partialGmAllowedInitiatorRoles: "Roles allowed to initiate a PARTIAL GM.",
  loanGmAllowedInitiatorRoles: "Roles allowed to initiate a LOAN GM.",
  accountGmAllowedInitiatorRoles:
    "Roles allowed to create a GM entry via the Accounts module endpoint (preserves the account / commission-verification flow).",
  gmCreateOverrideRoles:
    "Elevated roles permitted to create GM records as an override; every override creation is audited.",
  loanGmCreationEnabled:
    "Whether LOAN GM creation is accepted. When false, LOAN GM submissions are rejected until the loan-terms workflow is enabled.",
};

export const GM_SALES_CONFIG_KEYS = Object.keys(
  GM_SALES_CONFIG_DEFAULTS,
) as GmSalesConfigKey[];
