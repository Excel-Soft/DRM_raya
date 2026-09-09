import { ApiError } from "./api-error";

/**
 * Stage 8 — shared financial validation guards.
 *
 * Reusable, throw-on-failure checks for money-handling endpoints (GM, BV,
 * invoices, ledger, donations, dollar). Each throws ApiError(400) so route
 * handlers can rely on the standard error envelope. These are additive guards;
 * they do not change how valid requests behave.
 */

export const VALID_CURRENCIES = ["USD", "PKR", "Dollar"];

/** Invoice columns a PATCH may modify. Immutable/system fields are excluded. */
export const INVOICE_WRITABLE_FIELDS = [
  "customerId",
  "customerName",
  "customerEmail",
  "customerAddress",
  "subtotal",
  "tax",
  "total",
  "currency",
  "status",
  "issueDate",
  "dueDate",
  "notes",
  "items",
  "paymentMethod",
];

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return NaN;
  const n = typeof value === "number" ? value : Number(value);
  return n;
}

export function assertPositiveAmount(value: unknown, field = "amount"): number {
  const n = toNumber(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be a number greater than 0.`);
  }
  return n;
}

export function assertNonNegativeAmount(value: unknown, field = "amount"): number {
  const n = toNumber(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be a number of 0 or more.`);
  }
  return n;
}

export function assertValidCurrency(value: unknown, field = "currency"): string {
  const c = String(value ?? "").trim();
  if (!VALID_CURRENCIES.includes(c)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `${field} must be one of: ${VALID_CURRENCIES.join(", ")}.`,
    );
  }
  return c;
}

export function assertValidExchangeRate(value: unknown, field = "exchange rate"): number {
  const n = toNumber(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be greater than 0.`);
  }
  return n;
}

export function assertValidDate(value: unknown, field = "date"): Date {
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} is not a valid date.`);
  }
  return d;
}

/** Pick only whitelisted keys from a request body (mass-assignment guard). */
export function pickWritable<T extends Record<string, any>>(
  body: T,
  allowed: string[],
): Partial<T> {
  const out: Partial<T> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) out[k as keyof T] = body[k];
  }
  return out;
}

/**
 * Phase 4 — the legacy `drm.invoices` table (server/account-routes.ts) is a
 * separate, simple billing-document lifecycle, NOT part of the canonical
 * HOD/Account approval chain (see `INVOICE_LEGAL_TRANSITIONS` in
 * shared/gm-sales-constants.ts for that one). It never had its own
 * transition-legality check: any status could jump to any other. This map
 * closes that gap without changing the feature's shape.
 */
export const LEGACY_INVOICE_STATUSES = [
  "Draft",
  "Pending",
  "Sent",
  "Paid",
  "Overdue",
  "Cancelled",
] as const;

export type LegacyInvoiceStatus = (typeof LEGACY_INVOICE_STATUSES)[number];

export const LEGACY_INVOICE_LEGAL_TRANSITIONS: Record<LegacyInvoiceStatus, LegacyInvoiceStatus[]> = {
  Draft: ["Pending", "Sent", "Cancelled"],
  Pending: ["Sent", "Cancelled"],
  Sent: ["Paid", "Overdue", "Cancelled"],
  Overdue: ["Paid", "Cancelled"],
  Paid: [],
  Cancelled: [],
};

/** Throws ApiError(400) unless `from -> to` is a legal legacy-invoice transition. */
export function assertLegalInvoiceStatusTransition(from: unknown, to: unknown): LegacyInvoiceStatus {
  const fromStatus = LEGACY_INVOICE_STATUSES.includes(from as LegacyInvoiceStatus)
    ? (from as LegacyInvoiceStatus)
    : undefined;
  const toStatus = LEGACY_INVOICE_STATUSES.includes(to as LegacyInvoiceStatus)
    ? (to as LegacyInvoiceStatus)
    : undefined;

  if (!toStatus) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `status must be one of: ${LEGACY_INVOICE_STATUSES.join(", ")}.`,
    );
  }
  if (fromStatus === toStatus) return toStatus;
  if (!fromStatus || !LEGACY_INVOICE_LEGAL_TRANSITIONS[fromStatus].includes(toStatus)) {
    throw new ApiError(
      400,
      "ILLEGAL_TRANSITION",
      `Cannot change invoice status from "${from}" to "${to}".`,
    );
  }
  return toStatus;
}

/** When moving a legacy invoice to Paid, a payment method must be present (incoming or existing). */
export function assertPaymentProofForPaid(
  targetStatus: LegacyInvoiceStatus,
  fields: { paymentMethod?: unknown; existingPaymentMethod?: unknown },
): void {
  if (targetStatus !== "Paid") return;
  const method = fields.paymentMethod ?? fields.existingPaymentMethod;
  if (!method || String(method).trim() === "") {
    throw new ApiError(
      400,
      "PAYMENT_PROOF_REQUIRED",
      "A payment method is required to mark an invoice as Paid.",
    );
  }
}
