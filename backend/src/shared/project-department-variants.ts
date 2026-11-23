/**
 * Canonical department_type spellings across legacy DRM, attributes (LEGACY-N),
 * and modern codes — used in SQL filters and manager queues.
 */

export type ProjectDeptFamily =
  | "product_posting"
  | "dnd"
  | "it"
  | "seo_smm"
  | "software"
  | "service";

const FAMILY_VARIANTS: Record<ProjectDeptFamily, readonly string[]> = {
  product_posting: [
    "PRODUCT_POSTING",
    "Product Posting",
    "9",
    "LEGACY-9",
    "POSTING",
    "product_posting",
  ],
  dnd: [
    "DND",
    "DESIGN_DEVELOPMENT",
    "Design Development",
    "D&D",
    "DD",
    "10",
    "LEGACY-10",
  ],
  it: ["IT", "13", "LEGACY-13"],
  seo_smm: ["SEO_SMM", "SEO/SMM", "SEO SMM", "8", "LEGACY-8"],
  software: ["SOFTWARE", "27", "LEGACY-27"],
  service: ["SERVICE", "5", "LEGACY-5"],
};

export function normalizeDepartmentTypeKey(dept: string): string {
  return dept
    .trim()
    .toUpperCase()
    .replace(/^DEP:/, "")
    .replace(/[\s/]+/g, "_");
}

export function departmentTypeMatchesFamily(
  dept: string | null | undefined,
  family: ProjectDeptFamily,
): boolean {
  if (!dept) return false;
  const norm = normalizeDepartmentTypeKey(dept);
  return FAMILY_VARIANTS[family].some((v) => normalizeDepartmentTypeKey(v) === norm);
}

/** Safe SQL fragment: `column IN ('…', …)` for one department family. */
export function sqlDepartmentFamilyIn(column: string, family: ProjectDeptFamily): string {
  const vals = FAMILY_VARIANTS[family]
    .map((v) => `'${String(v).replace(/'/g, "''")}'`)
    .join(", ");
  return `${column} IN (${vals})`;
}

/** Role prefix → department families (matches pms-routes / manager dashboards). */
export const ROLE_DEPT_FAMILIES: Record<string, ProjectDeptFamily[]> = {
  product_posting: ["product_posting"],
  posting: ["product_posting"],
  dd: ["dnd"],
  dnd: ["dnd"],
  design: ["dnd"],
  it: ["it"],
  seo_smm: ["seo_smm"],
  software: ["software"],
  service: ["service"],
  qa_manager: ["product_posting", "seo_smm", "dnd"],
};

export function sqlDepartmentFamiliesIn(column: string, families: ProjectDeptFamily[]): string {
  const all = new Set<string>();
  for (const f of families) {
    for (const v of FAMILY_VARIANTS[f]) all.add(v);
  }
  const vals = [...all].map((v) => `'${String(v).replace(/'/g, "''")}'`).join(", ");
  return `${column} IN (${vals})`;
}

/** Product Posting, SEO/SMM, and D&D — departments with QA → Verification pipeline. */
export const QA_PIPELINE_FAMILIES: ProjectDeptFamily[] = [
  "product_posting",
  "seo_smm",
  "dnd",
];

export function qaPipelineDepartmentValues(): string[] {
  return [...new Set(QA_PIPELINE_FAMILIES.flatMap((f) => [...FAMILY_VARIANTS[f]]))];
}

export function departmentTypeMatchesAnyFamily(
  dept: string | null | undefined,
  families: ProjectDeptFamily[],
): boolean {
  return families.some((f) => departmentTypeMatchesFamily(dept, f));
}

export function departmentTypeInQaPipeline(dept: string | null | undefined): boolean {
  return departmentTypeMatchesAnyFamily(dept, QA_PIPELINE_FAMILIES);
}

export function sqlQaPipelineDepartmentIn(column: string): string {
  return sqlDepartmentFamiliesIn(column, QA_PIPELINE_FAMILIES);
}

/** Expanded spellings for role-based `department_type IN (...)` filters. */
export const ROLE_DEPARTMENT_VARIANTS: Record<string, readonly string[]> = {
  seo_smm: FAMILY_VARIANTS.seo_smm,
  it: FAMILY_VARIANTS.it,
  dd: FAMILY_VARIANTS.dnd,
  dnd: FAMILY_VARIANTS.dnd,
  design: FAMILY_VARIANTS.dnd,
  product_posting: FAMILY_VARIANTS.product_posting,
  posting: FAMILY_VARIANTS.product_posting,
  software: FAMILY_VARIANTS.software,
  service: FAMILY_VARIANTS.service,
  qa_manager: qaPipelineDepartmentValues(),
  verification_manager: qaPipelineDepartmentValues(),
};

/** Longest role-prefix match (e.g. product_posting before posting). */
export function departmentFamiliesForRole(role: string): ProjectDeptFamily[] | null {
  const roleLower = String(role || "").toLowerCase();
  if (roleLower === "admin" || roleLower === "super_hod" || roleLower === "hod") {
    return null;
  }
  const prefixes = Object.keys(ROLE_DEPT_FAMILIES).sort((a, b) => b.length - a.length);
  const prefix = prefixes.find((p) => roleLower.startsWith(p));
  if (prefix) return ROLE_DEPT_FAMILIES[prefix];
  if (roleLower.includes("verification") || roleLower === "qa_manager") {
    return [...QA_PIPELINE_FAMILIES];
  }
  return [];
}

export function sqlDepartmentFilterForRole(column: string, role: string): string | null {
  const families = departmentFamiliesForRole(role);
  if (families === null) return null;
  if (families.length === 0) return `${column} IN ('')`;
  return sqlDepartmentFamiliesIn(column, families);
}

export function departmentCandidatesForRole(
  userRole: string,
  userDept?: string | null,
): string[] {
  const roleLower = String(userRole || "").toLowerCase();
  const rolePrefix = Object.keys(ROLE_DEPARTMENT_VARIANTS).find((p) => roleLower.startsWith(p));
  const isVerificationRole = roleLower.includes("verification");
  return Array.from(
    new Set([
      ...(userDept ? [userDept] : []),
      ...(rolePrefix ? [...ROLE_DEPARTMENT_VARIANTS[rolePrefix]] : []),
      ...(isVerificationRole && !rolePrefix ? qaPipelineDepartmentValues() : []),
    ]),
  );
}