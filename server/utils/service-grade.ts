/**
 * Centralized Service Department grade classification.
 *
 * Customer grade is stored as free text on `drm.customers.grade` (e.g. "A",
 * "A+", "A-", "B", "B+", "B-"). The service department groups customers into a
 * fixed set of grade buckets. This module is the single source of truth for that
 * mapping so every grade page / report / dashboard count classifies identically.
 */

export type ServiceGradeKey =
  | "A"
  | "B_PLUS"
  | "B"
  | "B_MINUS";

export const SERVICE_GRADE_KEYS: ServiceGradeKey[] = ["A", "B_PLUS", "B", "B_MINUS"];

export const SERVICE_GRADE_LABELS: Record<ServiceGradeKey, string> = {
  A: "A",
  B_PLUS: "B+",
  B: "B",
  B_MINUS: "B-",
};

/**
 * Normalize a raw customer grade string into one of the service grade buckets.
 * Returns null when the grade does not map to a tracked bucket.
 */
export function normalizeServiceGrade(raw: string | null | undefined): ServiceGradeKey | null {
  if (!raw) return null;
  const g = raw.trim().toUpperCase();
  if (g.startsWith("A")) return "A";
  if (g === "B+" || g.startsWith("B+")) return "B_PLUS";
  if (g === "B-" || g.startsWith("B-")) return "B_MINUS";
  if (g === "B" || g.startsWith("B")) return "B";
  return null;
}

export function isServiceGradeKey(value: string | null | undefined): value is ServiceGradeKey {
  return !!value && (SERVICE_GRADE_KEYS as string[]).includes(value);
}

/**
 * Build a parameterized SQL predicate (against `customers.grade`, aliased `c`)
 * for a given grade bucket. Returns the SQL fragment plus the bound params.
 * `paramStart` is the next positional placeholder index ($N) to use.
 */
export function gradeSqlPredicate(
  grade: ServiceGradeKey,
  column: string,
  paramStart: number,
): { sql: string; params: string[]; nextParam: number } {
  switch (grade) {
    case "A":
      return { sql: `upper(trim(${column})) LIKE $${paramStart}`, params: ["A%"], nextParam: paramStart + 1 };
    case "B_PLUS":
      return { sql: `upper(trim(${column})) LIKE $${paramStart}`, params: ["B+%"], nextParam: paramStart + 1 };
    case "B_MINUS":
      return { sql: `upper(trim(${column})) LIKE $${paramStart}`, params: ["B-%"], nextParam: paramStart + 1 };
    case "B":
      // Plain "B" must not match "B+" / "B-".
      return {
        sql: `(upper(trim(${column})) = $${paramStart} OR (upper(trim(${column})) LIKE $${paramStart + 1} AND upper(trim(${column})) NOT LIKE $${paramStart + 2} AND upper(trim(${column})) NOT LIKE $${paramStart + 3}))`,
        params: ["B", "B%", "B+%", "B-%"],
        nextParam: paramStart + 4,
      };
    default:
      return { sql: "1=1", params: [], nextParam: paramStart };
  }
}
