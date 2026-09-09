/**
 * Business Rules & Decision Configuration (Phase 1 — Business Rules and Decision
 * Configuration).
 *
 * Centralizes the business rules that require an explicit, management-approved
 * decision before any code may compute a real value or enforce real behaviour.
 * See BUSINESS_RULES_CONFIG.md for the full usage guide and
 * docs/completion/MANAGEMENT_DECISIONS_REQUIRED.md for the decisions that
 * unlock each PENDING_APPROVAL entry below.
 *
 * Four of the eight business-rule areas in scope already have an approved-or-
 * safe-default config home and are intentionally NOT duplicated here (see
 * BUSINESS_RULES_REGISTRY below for the full map of all eight):
 *   - GM eligibility         -> gm-sales-constants.ts (*AllowedInitiatorRoles, loanGmCreationEnabled)
 *   - Payment thresholds     -> gm-sales-constants.ts (minimumPaymentThresholds)
 *   - Invoice trigger        -> gm-sales-constants.ts (gmInvoiceGenerationTiming, projectGenerationMode)
 *   - Listing QA requirement -> gm-sales-constants.ts (requireProductPostingWaitForListingQa, verificationManagerRequiredAfterQa)
 *
 * The four rules modeled in this file (Wallet negative-balance policy,
 * Profit/Loss formula version, AB Force-Close policy, Reopen policy) have NO
 * existing implementation anywhere in the codebase (confirmed by repo-wide
 * search — see P00-005/P00-006 in docs/completion/TRACEABILITY_MATRIX.md) and
 * are gated on MD-1/MD-2/MD-3 in MANAGEMENT_DECISIONS_REQUIRED.md, all
 * currently Pending. Every decision below therefore defaults to
 * PENDING_APPROVAL, and every accessor in
 * server/services/business-rules-policy.service.ts returns a structured
 * failure for a pending decision — matching this codebase's existing
 * `{ ok: false, ... }` convention (see gm-sales-constants.ts's
 * mapProjectInitialStatusToDb) — instead of inventing a formula, threshold, or
 * policy. Nothing here changes any current runtime behaviour: none of these
 * four features exist yet, so there is no current behaviour to preserve, and
 * nothing in this file is wired into any route yet.
 */
import { z } from "zod";
import { ROLES } from "./roles";
import { isoDate } from "./validators";

/* -------------------------------------------------------------------------- */
/* Pending/Approved decision wrapper                                          */
/* -------------------------------------------------------------------------- */

/** A business rule with no management-approved value yet. The only safe state
 *  for a financial rule with an open MD-* decision. */
export const pendingDecisionSchema = z.object({ status: z.literal("PENDING_APPROVAL") });
export type PendingDecision = z.infer<typeof pendingDecisionSchema>;

export const PENDING_APPROVAL: PendingDecision = { status: "PENDING_APPROVAL" };

/** Metadata every approved decision must carry, so an approval is always
 *  traceable to who decided it, when, and where it's recorded. */
export const decisionMetaSchema = z.object({
  decidedBy: z.string().min(1),
  /** ISO-8601 date or datetime, reusing the project's shared `isoDate`
   *  validator (shared/validators.ts — also re-exported from
   *  server/validators/common.validators.ts for existing server callers)
   *  rather than a bespoke format. */
  decidedAt: isoDate,
  decisionRef: z.string().min(1), // e.g. "DECISION_LOG.md D-006"
});

/**
 * Authoritative role names for `allowedRoles` fields below. Sourced from
 * shared/roles.ts's `ROLES` const (also re-exported from
 * server/utils/role-utils.ts for existing server callers), which the Phase 00
 * audit identified as the registry actually enforced by permission-checking
 * code (see docs/completion/TRACEABILITY_MATRIX.md P00-001) — the most
 * authoritative of the four disagreeing role registries found, though that
 * ambiguity itself remains open pending MD-7. Both shared/roles.ts and
 * shared/validators.ts are dependency-free aside from `zod`, so importing
 * them here keeps shared/ free of any server or client import, per the
 * enforced dependency direction (client -> shared, server -> shared,
 * shared -> nothing).
 */
const ROLE_VALUES = Object.values(ROLES) as [string, ...string[]];
export const roleNameSchema = z.enum(ROLE_VALUES);

/** A non-empty, duplicate-free list of authoritative role names. Used for
 *  every `allowedRoles` field on an APPROVED decision below. */
export const allowedRolesSchema = z
  .array(roleNameSchema)
  .min(1, "At least one role is required for an approved policy")
  .refine((roles) => new Set(roles).size === roles.length, {
    message: "allowedRoles must not contain duplicate role entries",
  });

/* -------------------------------------------------------------------------- */
/* 1. Wallet negative-balance policy (MD-3)                                   */
/* -------------------------------------------------------------------------- */

export const walletNegativeBalanceApprovedSchema = decisionMetaSchema
  .extend({
    status: z.literal("APPROVED"),
    allowNegative: z.boolean(),
    overdraftLimitUsd: z.number().nonnegative().nullable(),
  })
  .refine((v) => v.allowNegative || v.overdraftLimitUsd === null, {
    message: "overdraftLimitUsd must be null when allowNegative is false (contradictory wallet policy)",
    path: ["overdraftLimitUsd"],
  });
export const walletNegativeBalancePolicySchema = z.union([
  pendingDecisionSchema,
  walletNegativeBalanceApprovedSchema,
]);
export type WalletNegativeBalancePolicy = z.infer<typeof walletNegativeBalancePolicySchema>;

/* -------------------------------------------------------------------------- */
/* 2. Profit/Loss formula version (MD-1)                                     */
/* -------------------------------------------------------------------------- */

export const profitLossFormulaApprovedSchema = decisionMetaSchema.extend({
  status: z.literal("APPROVED"),
  version: z.string().min(1),
});
export const profitLossFormulaVersionSchema = z.union([
  pendingDecisionSchema,
  profitLossFormulaApprovedSchema,
]);
export type ProfitLossFormulaVersion = z.infer<typeof profitLossFormulaVersionSchema>;

/* -------------------------------------------------------------------------- */
/* 3. AB Force-Close policy (MD-2)                                           */
/* -------------------------------------------------------------------------- */

export const abForceCloseApprovedSchema = decisionMetaSchema.extend({
  status: z.literal("APPROVED"),
  allowedRoles: allowedRolesSchema,
  requireReason: z.boolean(),
});
export const abForceClosePolicySchema = z.union([
  pendingDecisionSchema,
  abForceCloseApprovedSchema,
]);
export type AbForceClosePolicy = z.infer<typeof abForceClosePolicySchema>;

/* -------------------------------------------------------------------------- */
/* 4. Reopen policy (MD-2 — reverse operation of Force-Close, same decision)  */
/* -------------------------------------------------------------------------- */

export const reopenApprovedSchema = decisionMetaSchema.extend({
  status: z.literal("APPROVED"),
  allowedRoles: allowedRolesSchema,
  requireReason: z.boolean(),
  maxReopensPerPeriod: z.number().int().positive().nullable(),
});
export const reopenPolicySchema = z.union([pendingDecisionSchema, reopenApprovedSchema]);
export type ReopenPolicy = z.infer<typeof reopenPolicySchema>;

/* -------------------------------------------------------------------------- */
/* Aggregate config                                                           */
/* -------------------------------------------------------------------------- */

export const businessRulesConfigSchema = z
  .object({
    walletNegativeBalancePolicy: walletNegativeBalancePolicySchema,
    profitLossFormulaVersion: profitLossFormulaVersionSchema,
    abForceClosePolicy: abForceClosePolicySchema,
    reopenPolicy: reopenPolicySchema,
  })
  .strict();
export type BusinessRulesConfig = z.infer<typeof businessRulesConfigSchema>;
export type BusinessRulesConfigKey = keyof BusinessRulesConfig;

/** SAFE DEFAULTS — every entry PENDING_APPROVAL. There is no "current
 *  behaviour" to preserve for any of these four (none are implemented), so
 *  unlike gm-sales-constants.ts's defaults, these are not a no-op stand-in for
 *  existing behaviour — they are a hard stop until MD-1/MD-2/MD-3 are
 *  Approved. */
export const BUSINESS_RULES_CONFIG_DEFAULTS: BusinessRulesConfig = {
  walletNegativeBalancePolicy: PENDING_APPROVAL,
  profitLossFormulaVersion: PENDING_APPROVAL,
  abForceClosePolicy: PENDING_APPROVAL,
  reopenPolicy: PENDING_APPROVAL,
};

export const BUSINESS_RULES_CONFIG_KEY_DESCRIPTIONS: Record<BusinessRulesConfigKey, string> = {
  walletNegativeBalancePolicy:
    "Whether the Wallet may carry a negative balance and any overdraft limit. Gated on MD-3 — Wallet architecture (first-class table vs. reporting label) must be decided first. PENDING_APPROVAL until then; no code may allow or block a negative balance based on a guessed rule.",
  profitLossFormulaVersion:
    "Which Profit/Loss formula version is in effect. Gated on MD-1 — Profit/Loss has no implementation anywhere in the codebase (confirmed P00-005). PENDING_APPROVAL until MD-1 defines whether it is net-new and what its formula, scope, and data source are.",
  abForceClosePolicy:
    "Which roles may Force-Close an AB Closing period, and whether a reason is required. Gated on MD-2 — Force-Close has no implementation anywhere in the codebase (confirmed P00-006). PENDING_APPROVAL until MD-2 defines scope and authorized roles.",
  reopenPolicy:
    "Which roles may reopen a Force-Closed AB Closing period, whether a reason is required, and any reopen-count limit. Depends on the same MD-2 decision as abForceClosePolicy — reopen is the reverse operation of Force-Close and cannot be decided independently of it.",
};

export const BUSINESS_RULES_CONFIG_KEYS = Object.keys(
  BUSINESS_RULES_CONFIG_DEFAULTS,
) as BusinessRulesConfigKey[];

/* -------------------------------------------------------------------------- */
/* Registry of all 8 Phase-1 business-rule areas (documentation, not values)  */
/* -------------------------------------------------------------------------- */

/** Single lookup for all 8 areas named in the Phase 1 task, so "locate every
 *  hardcoded business rule" has one authoritative index instead of two
 *  competing sources of truth for the 4 areas already configured elsewhere. */
export const BUSINESS_RULES_REGISTRY = {
  gmEligibility: {
    status: "CONFIGURED",
    configuredIn:
      "shared/gm-sales-constants.ts (fullGmAllowedInitiatorRoles, partialGmAllowedInitiatorRoles, loanGmAllowedInitiatorRoles, accountGmAllowedInitiatorRoles, gmCreateOverrideRoles, loanGmCreationEnabled)",
    enforcedIn: "server/services/gm-create-policy.service.ts",
  },
  paymentThresholds: {
    status: "CONFIGURED",
    configuredIn: "shared/gm-sales-constants.ts (minimumPaymentThresholds)",
    enforcedIn:
      "server/services/gm-create-policy.service.ts (checkGmCreationThreshold, recheckGmThresholdAtApproval)",
  },
  invoiceTrigger: {
    status: "CONFIGURED",
    configuredIn: "shared/gm-sales-constants.ts (gmInvoiceGenerationTiming, projectGenerationMode)",
    enforcedIn: "server/services/gm-invoice-generation.service.ts (existing consumer; not modified by this phase)",
  },
  listingQaRequirement: {
    status: "CONFIGURED",
    configuredIn:
      "shared/gm-sales-constants.ts (requireProductPostingWaitForListingQa, verificationManagerRequiredAfterQa)",
    enforcedIn: "product-posting / DND workflow routes (existing; not modified by this phase)",
  },
  walletNegativeBalancePolicy: {
    status: "PENDING_APPROVAL",
    blockedOn: "MD-3 (docs/completion/MANAGEMENT_DECISIONS_REQUIRED.md)",
    configuredIn: "shared/business-rules-config.ts (walletNegativeBalancePolicy)",
    enforcedIn:
      "server/services/business-rules-policy.service.ts (checkWalletNegativeBalanceAllowed) — not yet wired into any route",
  },
  profitLossFormulaVersion: {
    status: "PENDING_APPROVAL",
    blockedOn: "MD-1",
    configuredIn: "shared/business-rules-config.ts (profitLossFormulaVersion)",
    enforcedIn:
      "server/services/business-rules-policy.service.ts (getApprovedProfitLossFormulaVersion) — no Profit/Loss implementation exists to wire into (P00-005)",
  },
  abForceClosePolicy: {
    status: "PENDING_APPROVAL",
    blockedOn: "MD-2",
    configuredIn: "shared/business-rules-config.ts (abForceClosePolicy)",
    enforcedIn:
      "server/services/business-rules-policy.service.ts (checkAbForceCloseAllowed) — no Force-Close implementation exists to wire into (P00-006)",
  },
  reopenPolicy: {
    status: "PENDING_APPROVAL",
    blockedOn: "MD-2",
    configuredIn: "shared/business-rules-config.ts (reopenPolicy)",
    enforcedIn:
      "server/services/business-rules-policy.service.ts (checkReopenAllowed) — no Force-Close/Reopen implementation exists to wire into",
  },
} as const;
