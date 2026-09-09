/**
 * Patch 5 Stage 2 — GM creation policy helpers.
 *
 * Pure, side-effect-free helpers that the two existing GM-create paths use to:
 *   - resolve the canonical GM type (FULL / PARTIAL / LOAN) from whatever the
 *     legacy payload already sends (explicit canonical value, the sales
 *     `loanMode` enum, or the account `is_loan` / `is_partial_payment` flags),
 *   - gate LOAN creation behind a config flag,
 *   - enforce the optional minimum-payment threshold,
 *   - derive the initial DB write-state WITHOUT changing the values the routes
 *     already write (status='Pending', approval_status='pending_hod').
 *
 * Behaviour-preserving: with the safe defaults (loanGmCreationEnabled=true,
 * minimumPaymentThresholds={}) every helper is a no-op gate, so wiring them in
 * does not change any current GM behaviour.
 */
import {
  GM_TYPES,
  gmTypeSchema,
  mapDbFlagsToGmType,
  type GmType,
  type GmSalesConfig,
} from "../../shared/gm-sales-constants";
import {
  validateMinimumPaymentThreshold,
  type ValidationResult,
} from "./gm-sales-validation.service";

export interface ResolveGmTypeResult {
  ok: boolean;
  value: GmType | null;
  source: "explicit" | "loanMode" | "flags" | "none";
  warnings: string[];
  code?: string;
  message?: string;
}

/**
 * Resolve the canonical GM type. Precedence:
 *   1. an explicit canonical value (`canonicalGmType` / `gmType` on /api/gm),
 *   2. the sales `loanMode` enum (loan|installment|none),
 *   3. the account `is_loan` / `is_partial_payment` flags.
 * Returns ok:false (never throws) when the type is missing or invalid.
 */
export function resolveCanonicalGmType(input: {
  explicit?: unknown;
  loanMode?: unknown;
  isLoan?: unknown;
  isPartialPayment?: unknown;
}): ResolveGmTypeResult {
  const explicitRaw = input.explicit;
  if (explicitRaw !== undefined && explicitRaw !== null && String(explicitRaw).trim() !== "") {
    const norm = String(explicitRaw).trim().toUpperCase();
    const parsed = gmTypeSchema.safeParse(norm);
    if (!parsed.success) {
      return {
        ok: false,
        value: null,
        source: "explicit",
        warnings: [],
        code: "GM_TYPE_INVALID",
        message: `Invalid GM type "${String(explicitRaw)}". Expected FULL, PARTIAL or LOAN.`,
      };
    }
    return { ok: true, value: parsed.data as GmType, source: "explicit", warnings: [] };
  }

  const loanModeRaw = input.loanMode;
  if (loanModeRaw !== undefined && loanModeRaw !== null && String(loanModeRaw).trim() !== "") {
    const lm = String(loanModeRaw).trim().toLowerCase();
    if (lm === "loan") return { ok: true, value: GM_TYPES.LOAN, source: "loanMode", warnings: [] };
    if (lm === "installment") return { ok: true, value: GM_TYPES.PARTIAL, source: "loanMode", warnings: [] };
    if (lm === "none") return { ok: true, value: GM_TYPES.FULL, source: "loanMode", warnings: [] };
    return {
      ok: false,
      value: null,
      source: "loanMode",
      warnings: [],
      code: "GM_TYPE_INVALID",
      message: `Invalid loan mode "${String(loanModeRaw)}".`,
    };
  }

  const hasFlags = input.isLoan !== undefined || input.isPartialPayment !== undefined;
  if (hasFlags) {
    const truthy = (v: unknown) => v === true || v === 1 || v === "1" || v === "true";
    if (truthy(input.isLoan) && truthy(input.isPartialPayment)) {
      return {
        ok: false,
        value: null,
        source: "flags",
        warnings: [],
        code: "GM_TYPE_INVALID",
        message: "Ambiguous GM type: a GM cannot be both LOAN and PARTIAL.",
      };
    }
    const m = mapDbFlagsToGmType(
      input.isLoan as number | boolean | null | undefined,
      input.isPartialPayment as number | boolean | null | undefined,
    );
    if (m.ok && m.value) {
      return { ok: true, value: m.value, source: "flags", warnings: m.warnings };
    }
  }

  return {
    ok: false,
    value: null,
    source: "none",
    warnings: [],
    code: "GM_TYPE_REQUIRED",
    message: "GM type is required (FULL, PARTIAL or LOAN).",
  };
}

/** LOAN creation is gated behind a config flag (default enabled => current behaviour). */
export function checkLoanGmEnabled(config: GmSalesConfig, gmType: GmType): ValidationResult {
  if (gmType === GM_TYPES.LOAN && !config.loanGmCreationEnabled) {
    return {
      ok: false,
      code: "LOAN_GM_DISABLED",
      message: "Loan GM terms workflow not enabled yet.",
    };
  }
  return { ok: true };
}

/** True when at least one minimum-payment threshold is configured. */
export function thresholdsConfigured(config: GmSalesConfig): boolean {
  const t = config.minimumPaymentThresholds;
  return !!t && Object.keys(t).length > 0;
}

/**
 * Enforce the optional minimum-payment threshold for (gmType, package). With the
 * default empty map this always passes (no behaviour change).
 */
export function checkGmCreationThreshold(args: {
  config: GmSalesConfig;
  gmType: GmType;
  packageKey: string;
  amountUsd: number;
}): ValidationResult {
  return validateMinimumPaymentThreshold({
    gmType: args.gmType,
    packageType: args.packageKey,
    amount: args.amountUsd,
    thresholds: args.config.minimumPaymentThresholds,
  });
}

export interface InitialGmDbState {
  /** DB `status` enum value actually written — unchanged from current behaviour. */
  status: string;
  /** `approval_status` text actually written — unchanged from current behaviour. */
  approvalStatus: string;
  /** Canonical workflow stage, recorded for audit/forward-compat ONLY (not written). */
  canonicalStage: string;
}

/**
 * Initial DB write-state by GM type. Behaviour-preserving: every type keeps the
 * current writes (status='Pending', approval_status='pending_hod'). The richer
 * canonical stage is exposed for audit only — the partial/loan workflow stages
 * land in a later, management-confirmed stage and are NOT written here.
 */
export function getInitialGmDbState(gmType: GmType): InitialGmDbState {
  let canonicalStage = "SUBMITTED";
  if (gmType === GM_TYPES.PARTIAL) canonicalStage = "PARTIAL_PAYMENT_PENDING";
  else if (gmType === GM_TYPES.LOAN) canonicalStage = "PENDING_HOD";
  return { status: "Pending", approvalStatus: "pending_hod", canonicalStage };
}

/**
 * Re-validate a GM's payment amount against the configured threshold at an
 * approval transition. Derives the canonical type from the stored DB flags. With
 * the default empty thresholds map the underlying check is a no-op; callers
 * should still short-circuit via `thresholdsConfigured` to avoid an extra query.
 */
export function recheckGmThresholdAtApproval(args: {
  config: GmSalesConfig;
  isLoan: unknown;
  isPartialPayment: unknown;
  packageType: string;
  amountUsd: number;
}): ValidationResult {
  const typeRes = mapDbFlagsToGmType(
    args.isLoan as number | boolean | null | undefined,
    args.isPartialPayment as number | boolean | null | undefined,
  );
  const gmType = (typeRes.value ?? GM_TYPES.FULL) as GmType;
  return validateMinimumPaymentThreshold({
    gmType,
    packageType: args.packageType,
    amount: args.amountUsd,
    thresholds: args.config.minimumPaymentThresholds,
  });
}
