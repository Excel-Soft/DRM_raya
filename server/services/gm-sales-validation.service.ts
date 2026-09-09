/**
 * Patch 5 — GM/Sales validation service.
 *
 * Pure, side-effect-free validation functions. Each returns a structured
 * { ok, code?, message?, details? } result and NEVER throws for user-input
 * problems. These are foundation helpers — they are intentionally NOT wired into
 * the existing GM/invoice routes in Stage 1 (that would change business
 * behaviour before management confirmation).
 */
import { ZodError, type ZodSchema } from "zod";
import {
  gmTypeSchema,
  type GmType,
} from "../../shared/gm-sales-constants";
import {
  gmCreatePayloadSchema,
  partialReceiptPayloadSchema,
  loanGmTermsSchema,
} from "../validators/gm.validators";
import {
  manualInvoicePayloadSchema,
  invoiceApprovalReadinessSchema,
  invoicePaymentReadinessSchema,
} from "../validators/invoice.validators";
import { invoiceToProjectPayloadSchema, productPostingDependencySchema } from "../validators/project-routing.validators";

export interface ValidationResult {
  ok: boolean;
  code?: string;
  message?: string;
  details?: unknown;
}

const OK: ValidationResult = { ok: true };

function zodDetails(err: ZodError) {
  return err.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
    code: i.code,
  }));
}

function runSchema(
  schema: ZodSchema,
  payload: unknown,
  code: string,
  message: string,
): ValidationResult {
  const parsed = schema.safeParse(payload);
  if (parsed.success) return OK;
  return { ok: false, code, message, details: zodDetails(parsed.error) };
}

/** 1. Validate the payload used to create a GM. */
export function validateGmCreatePayload(payload: unknown): ValidationResult {
  return runSchema(gmCreatePayloadSchema, payload, "GM_CREATE_INVALID", "Invalid GM create payload");
}

/** 2. Validate a GM type value against the canonical set. */
export function validateGmType(gmType: unknown): ValidationResult {
  return runSchema(gmTypeSchema, gmType, "GM_TYPE_INVALID", "Invalid GM type");
}

/**
 * 3. Validate a payment amount against the configured minimum threshold.
 * Presence-based enforcement: if no threshold is configured for the
 * (gmType, package) pair the check passes (preserves current behaviour).
 */
export function validateMinimumPaymentThreshold(args: {
  gmType: string;
  packageType: string;
  amount: number;
  thresholds?: Record<string, Record<string, number>>;
}): ValidationResult {
  const { gmType, packageType, amount, thresholds } = args;
  const threshold = thresholds?.[gmType]?.[packageType];
  if (threshold === undefined || threshold === null) {
    return OK; // not configured => not enforced
  }
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return { ok: false, code: "AMOUNT_INVALID", message: "amount must be a number" };
  }
  if (amount < threshold) {
    return {
      ok: false,
      code: "MINIMUM_PAYMENT_NOT_MET",
      message: `Amount ${amount} is below the configured minimum ${threshold} for ${gmType}/${packageType}`,
      details: { gmType, packageType, amount, threshold },
    };
  }
  return OK;
}

/** 4. Validate a partial-receipt payload. */
export function validatePartialReceiptPayload(payload: unknown): ValidationResult {
  return runSchema(
    partialReceiptPayloadSchema,
    payload,
    "PARTIAL_RECEIPT_INVALID",
    "Invalid partial receipt payload",
  );
}

/** 5. Validate loan GM terms. */
export function validateLoanGmTerms(payload: unknown): ValidationResult {
  return runSchema(loanGmTermsSchema, payload, "LOAN_TERMS_INVALID", "Invalid loan GM terms");
}

/** 6. Validate a manual invoice creation payload. */
export function validateManualInvoicePayload(payload: unknown): ValidationResult {
  return runSchema(
    manualInvoicePayloadSchema,
    payload,
    "MANUAL_INVOICE_INVALID",
    "Invalid manual invoice payload",
  );
}

const INVOICE_APPROVABLE_STATUSES = new Set(["PENDING_HOD", "PENDING_ACCOUNT"]);

/** 7. Validate that an invoice is in a state where it can be approved. */
export function validateInvoiceApprovalReadiness(payload: unknown): ValidationResult {
  const shape = runSchema(
    invoiceApprovalReadinessSchema,
    payload,
    "INVOICE_APPROVAL_INVALID",
    "Invalid invoice approval payload",
  );
  if (!shape.ok) return shape;
  const status = String((payload as { status: string }).status).toUpperCase();
  if (!INVOICE_APPROVABLE_STATUSES.has(status)) {
    return {
      ok: false,
      code: "INVOICE_NOT_APPROVABLE",
      message: `Invoice in status "${status}" cannot be approved`,
      details: { status, approvable: Array.from(INVOICE_APPROVABLE_STATUSES) },
    };
  }
  return OK;
}

const INVOICE_PAYABLE_STATUSES = new Set(["APPROVED"]);

/** 8. Validate that an invoice is in a state where it can be marked paid. */
export function validateInvoicePaymentReadiness(payload: unknown): ValidationResult {
  const shape = runSchema(
    invoicePaymentReadinessSchema,
    payload,
    "INVOICE_PAYMENT_INVALID",
    "Invalid invoice payment payload",
  );
  if (!shape.ok) return shape;
  const status = String((payload as { status: string }).status).toUpperCase();
  if (!INVOICE_PAYABLE_STATUSES.has(status)) {
    return {
      ok: false,
      code: "INVOICE_NOT_PAYABLE",
      message: `Invoice in status "${status}" cannot be marked paid`,
      details: { status, payable: Array.from(INVOICE_PAYABLE_STATUSES) },
    };
  }
  return OK;
}

/** 9. Validate the payload used to generate a project from an invoice. */
export function validateInvoiceToProjectPayload(payload: unknown): ValidationResult {
  return runSchema(
    invoiceToProjectPayloadSchema,
    payload,
    "INVOICE_TO_PROJECT_INVALID",
    "Invalid invoice-to-project payload",
  );
}

/**
 * 10. Validate the product-posting dependency rule. When
 * `requireWaitForListingQa` is true and Listing-Page QA is not complete, the
 * dependency is locked.
 */
export function validateProductPostingDependency(args: {
  invoiceType?: string;
  listingQaComplete?: boolean;
  requireWaitForListingQa?: boolean;
}): ValidationResult {
  const shape = runSchema(
    productPostingDependencySchema,
    args,
    "PRODUCT_POSTING_DEP_INVALID",
    "Invalid product posting dependency payload",
  );
  if (!shape.ok) return shape;
  if (args.requireWaitForListingQa && !args.listingQaComplete) {
    return {
      ok: false,
      code: "DEPENDENCY_LOCKED",
      message: "Product posting is blocked until Listing-Page QA is complete",
      details: { requireWaitForListingQa: true, listingQaComplete: !!args.listingQaComplete },
    };
  }
  return OK;
}

export type { GmType };
