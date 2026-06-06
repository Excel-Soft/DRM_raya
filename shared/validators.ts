import { z } from "zod";

/**
 * Reusable Zod schemas + helpers shared between the active server and client.
 *
 * This module is intentionally dependency-free (only `zod`) so that `shared/`
 * never imports from `server/`. The `parseOrThrow` helper throws a `ZodError`
 * on failure; the server's error layer (`server/utils/api-error.ts`) maps any
 * ZodError to a 400 VALIDATION_ERROR envelope.
 */

// --- Primitive / scalar schemas ---------------------------------------------

/** Numeric (or numeric-string) id, must be a positive integer. */
export const id = z.coerce.number().int().positive();

/** RFC 4122 UUID. */
export const uuid = z.string().uuid();

/** Email address. */
export const email = z.string().email();

/**
 * Loose international phone number. Allows digits, spaces, dashes, parentheses
 * and an optional leading `+`. Length 6..20 (after allowing formatting chars).
 */
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9()\-\s]{6,20}$/, "Invalid phone number");

/** Non-negative monetary amount (accepts numeric strings). */
export const amount = z.coerce.number().min(0);

/** HTTP/HTTPS URL only (rejects javascript:, data:, file:, etc.). */
export const url = z
  .string()
  .trim()
  .url()
  .refine((v) => /^https?:\/\//i.test(v), "URL must use http or https");

/**
 * Approval decision enum. The active app uses lowercase decisions in its
 * approval flows; `pending` is included for status-style usage.
 */
export const approvalDecision = z.enum(["approve", "reject", "pending"]);

/**
 * Generic status-enum factory. Pass the allowed status values for a given
 * module and get back a Zod enum, e.g. `statusEnum(["active", "inactive"])`.
 * Use this instead of re-declaring ad-hoc `z.enum([...])` for status fields so
 * status validation stays consistent across modified APIs.
 */
export const statusEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values);

/** Common active/inactive status used by user/admin records. */
export const activeStatus = z.enum(["active", "inactive"]);

// --- Composite schemas -------------------------------------------------------

/**
 * Date range. Both bounds optional; accept ISO date or date-time strings.
 * Field names match the `{dateFrom?, dateTo?}` convention.
 */
export const dateRange = z
  .object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .refine(
    (v) => !(v.dateFrom && v.dateTo) || v.dateFrom <= v.dateTo,
    { message: "dateFrom must be before or equal to dateTo", path: ["dateFrom"] },
  );

/**
 * Pagination. `page` >= 1 (default 1), `pageSize` 1..200 (default 25).
 * Coerces from query-string values.
 */
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

/** File metadata (URL/string based uploads in the active app). */
export const fileMetadata = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.coerce.number().int().min(0),
});

// --- Inferred types ----------------------------------------------------------

export type DateRange = z.infer<typeof dateRange>;
export type Pagination = z.infer<typeof pagination>;
export type FileMetadata = z.infer<typeof fileMetadata>;
export type ApprovalDecision = z.infer<typeof approvalDecision>;

// --- Helpers -----------------------------------------------------------------

/**
 * Parse `data` with `schema`, returning the typed value. On failure this throws
 * the underlying `ZodError`, which the server error layer converts to a 400
 * VALIDATION_ERROR envelope. Kept dependency-free so `shared/` has no server
 * imports.
 */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}
