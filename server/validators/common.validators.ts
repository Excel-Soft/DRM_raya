import { z } from "zod";

/**
 * Common, reusable Zod validators shared across the DRM backend.
 *
 * These are building blocks — domain validator files (invoice, workflow,
 * approval, financial, service, hr) compose these primitives. Keep them generic
 * and side-effect free. Never embed secrets or environment-specific values here.
 */

// --- Identifiers -------------------------------------------------------------

/** RFC-4122 UUID (the type used by drm.users.id and most primary keys). */
export const uuid = z.string().uuid("Must be a valid UUID");

/**
 * Generic id: many legacy tables use varchar ids (gm_pool_entries, etc.), so an
 * id is "a non-empty, reasonably bounded string". Use `uuid` when the column is
 * strictly a UUID.
 */
export const id = z
  .string()
  .trim()
  .min(1, "Id is required")
  .max(128, "Id is too long");

// --- Dates -------------------------------------------------------------------

/** ISO-8601 date or datetime string that parses to a real Date. */
export const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Must be a valid ISO date");

/** Accepts a Date instance or an ISO string and coerces to Date. */
export const dateLike = z.coerce.date({
  errorMap: () => ({ message: "Must be a valid date" }),
});

/**
 * Inclusive date range where `from` must be <= `to`.
 * Returns coerced Date objects.
 */
export const dateRange = z
  .object({
    from: dateLike,
    to: dateLike,
  })
  .refine((r) => r.from.getTime() <= r.to.getTime(), {
    message: "`from` must be on or before `to`",
    path: ["from"],
  });

// --- Pagination --------------------------------------------------------------

/**
 * Pagination query params. Coerces strings (query strings are always strings)
 * and clamps to safe bounds.
 */
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

// --- Money / currency / percentage ------------------------------------------

/**
 * A monetary amount. Accepts numbers or numeric strings (decimal columns come
 * back as strings from pg). Non-negative by default; allows up to 2 decimals.
 */
export const moneyAmount = z.coerce
  .number({ invalid_type_error: "Amount must be a number" })
  .finite("Amount must be a finite number")
  .nonnegative("Amount cannot be negative")
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9, "Amount supports at most 2 decimals");

/** Signed money amount (e.g. ledger debit/credit deltas, refunds). */
export const signedMoneyAmount = z.coerce
  .number({ invalid_type_error: "Amount must be a number" })
  .finite("Amount must be a finite number");

/** ISO-4217-style 3-letter currency code (e.g. USD, PKR). */
export const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code (e.g. USD)");

/** Percentage 0–100 inclusive. */
export const percentage = z.coerce
  .number()
  .min(0, "Percentage cannot be below 0")
  .max(100, "Percentage cannot exceed 100");

// --- Contact / web -----------------------------------------------------------

export const email = z.string().trim().toLowerCase().email("Must be a valid email");

export const url = z.string().trim().url("Must be a valid URL");

/**
 * Loose international phone validator: optional leading +, 7–20 digits, allows
 * spaces / dashes / parentheses which are stripped for the length check.
 */
export const phone = z
  .string()
  .trim()
  .refine((v) => {
    const digits = v.replace(/[^\d]/g, "");
    return digits.length >= 7 && digits.length <= 20;
  }, "Must be a valid phone number");

// --- Free text ---------------------------------------------------------------

/** Optional remarks / notes. Bounded to avoid abuse; trimmed. */
export const remarks = z.string().trim().max(2000, "Too long (max 2000 chars)");

/** A required reason (e.g. edit reason). Non-empty, bounded. */
export const reason = z
  .string()
  .trim()
  .min(1, "Reason is required")
  .max(2000, "Reason is too long (max 2000 chars)");

/** A required rejection reason — same constraints, named for clarity at call sites. */
export const rejectionReason = z
  .string()
  .trim()
  .min(1, "Rejection reason is required")
  .max(2000, "Rejection reason is too long (max 2000 chars)");

// --- Approvals / status ------------------------------------------------------

/** Approval decision verbs accepted across workflows (case-insensitive). */
export const approvalDecision = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .pipe(z.enum(["approve", "reject", "approved", "rejected"]));

/**
 * Build a status validator constrained to an explicit allow-list. Keeps each
 * module honest about which statuses it accepts rather than free-text.
 *
 *   const invoiceStatus = statusEnum(["Draft","Pending","Sent","Paid"] as const)
 */
export function statusEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values);
}

// --- Files -------------------------------------------------------------------

/**
 * Safe file metadata (NOT the file bytes). Validates a declared upload's shape;
 * actual storage/scan is handled elsewhere.
 */
export const fileMetadata = z.object({
  fileName: z.string().trim().min(1, "File name is required").max(255),
  mimeType: z
    .string()
    .trim()
    .regex(/^[\w.+-]+\/[\w.+-]+$/, "Invalid MIME type"),
  sizeBytes: z.coerce
    .number()
    .int()
    .nonnegative()
    .max(50 * 1024 * 1024, "File exceeds 50MB limit"),
  url: url.optional(),
});

export type Pagination = z.infer<typeof pagination>;
export type DateRange = z.infer<typeof dateRange>;
export type FileMetadata = z.infer<typeof fileMetadata>;
