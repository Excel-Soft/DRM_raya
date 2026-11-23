/**
 * Mac / drm_legacy_stage: partial schema vs greenfield app DDL.
 * When SKIP_SCHEMA_ENSURE=true, dashboard routes may return empty payloads
 * instead of 500 for missing tables/columns or permission errors.
 */

const STAGING_SOFT_FAIL =
  process.env.SKIP_SCHEMA_ENSURE === "true" || process.env.STAGING_SOFT_DASHBOARD_FAIL === "true";

/** PostgreSQL SQLSTATE codes we treat as "schema not ready yet" on staging. */
const SOFT_PG_CODES = new Set([
  "42P01", // undefined_table
  "42703", // undefined_column
  "42883", // undefined_function
  "42501", // insufficient_privilege
  "3F000", // invalid_schema_name
]);

export function isStagingSoftDashboardMode(): boolean {
  return STAGING_SOFT_FAIL;
}

export function isSoftDashboardPgError(err: unknown): boolean {
  if (!STAGING_SOFT_FAIL || !err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  return code != null && SOFT_PG_CODES.has(code);
}

/** Log once server-side; return true if caller should respond with empty fallback. */
export function shouldSoftFailDashboard(err: unknown, context: string): boolean {
  if (!isSoftDashboardPgError(err)) return false;
  console.warn(`[staging-soft-fail] ${context}:`, (err as Error).message ?? err);
  return true;
}
