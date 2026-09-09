import { ApiError } from "./api-error";

/**
 * SQL-safety helpers (Patch 6 Stage 2, SQL-001).
 *
 * Centralizes the few places that build dynamic SQL fragments so that:
 *  - identifier lists interpolated into raw SQL are validated as UUIDs,
 *  - pagination (page/limit/offset) is always coerced to safe, bounded integers,
 *  - ORDER BY column + direction come from an explicit allow-list.
 *
 * These never embed received values into error messages, so they are safe to let
 * bubble up to `sendError`.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for an RFC-4122 UUID string. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Validate that every element is a UUID and return them unchanged. Throws a safe
 * 400 ApiError on the first non-UUID. Use before interpolating an id list into
 * raw SQL — it guarantees no attacker-controlled string can reach the query.
 */
export function assertUuidList(ids: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!isUuid(id)) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid identifier in scope filter");
    }
    out.push(id);
  }
  return out;
}

/**
 * Build a comma-separated, single-quoted UUID list (e.g. `'a','b'`) for safe
 * interpolation into `ARRAY[...]::uuid[]` / `IN (...)`. Every id is UUID-checked
 * first, so the result can never carry SQL.
 */
export function quotedUuidList(ids: readonly unknown[]): string {
  return assertUuidList(ids)
    .map((id) => `'${id}'`)
    .join(",");
}

/** Coerce to a safe 1-based page number. Non-integers / <1 fall back. */
export function safePage(value: unknown, fallback = 1): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
}

/** Coerce to a safe page size, clamped to [1, max]. Non-integers fall back. */
export function safePageSize(value: unknown, fallback = 25, max = 200): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/** Compute a non-negative OFFSET from already-safe page/pageSize. */
export function safeOffset(page: number, pageSize: number): number {
  return (Math.max(1, page) - 1) * Math.max(1, pageSize);
}

export interface OrderBySpec {
  /** The real, whitelisted column expression (caller-trusted). */
  column: string;
  direction: "ASC" | "DESC";
}

/**
 * Resolve a user-supplied sort into a safe ORDER BY spec.
 *
 * @param allowed maps an API sort key -> the real column expression to emit.
 * @param fallbackKey a key that MUST exist in `allowed`.
 *
 * Unknown sort keys fall back to `fallbackKey`; only ASC/DESC are ever emitted.
 */
export function makeOrderBy(
  sortBy: unknown,
  sortOrder: unknown,
  allowed: Record<string, string>,
  fallbackKey: string,
): OrderBySpec {
  const key =
    typeof sortBy === "string" && Object.prototype.hasOwnProperty.call(allowed, sortBy)
      ? sortBy
      : fallbackKey;
  const column = allowed[key];
  if (!column) {
    throw new ApiError(500, "INTERNAL_ERROR", "No sortable column configured");
  }
  const direction: "ASC" | "DESC" =
    String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
  return { column, direction };
}
