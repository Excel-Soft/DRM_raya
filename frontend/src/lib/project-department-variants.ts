/** Keep in sync with backend/src/shared/project-department-variants.ts */

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

/** Normalize department_type / legacy labels before family match. */
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

export const QA_PIPELINE_FAMILIES: ProjectDeptFamily[] = [
  "product_posting",
  "seo_smm",
  "dnd",
];

export function departmentTypeMatchesAnyFamily(
  dept: string | null | undefined,
  families: ProjectDeptFamily[],
): boolean {
  return families.some((f) => departmentTypeMatchesFamily(dept, f));
}

export function departmentTypeInQaPipeline(dept: string | null | undefined): boolean {
  return departmentTypeMatchesAnyFamily(dept, QA_PIPELINE_FAMILIES);
}

/** IT / Software / Service — manager "Closed Task" (no Send to QA pipeline). */
export function departmentTypeUsesManagerCloseOnly(dept: string | null | undefined): boolean {
  return !departmentTypeInQaPipeline(dept);
}

const FAMILY_DISPLAY_LABEL: Record<ProjectDeptFamily, string> = {
  product_posting: "P&P",
  dnd: "D&D",
  it: "IT",
  seo_smm: "SEO/SMM",
  software: "Software",
  service: "Service",
};

const EXTRA_DEPARTMENT_LABELS: Record<string, string> = {
  SALES: "Sales",
  ACCOUNTS: "Accounts",
  MARKETING: "Marketing",
  LEAD: "Lead",
  QA: "QA",
  RECEPTION: "Reception",
  VERIFICATION: "Verification",
  COMPLAINT: "Complaint",
  MEDIA: "Media",
  HOD: "HOD",
};

/** Human label for projects.department_type (LEGACY-*, codes, names). */
export function projectDepartmentDisplayLabel(dept: string | null | undefined): string {
  if (!dept || !String(dept).trim()) return "—";
  for (const family of Object.keys(FAMILY_VARIANTS) as ProjectDeptFamily[]) {
    if (departmentTypeMatchesFamily(dept, family)) {
      return FAMILY_DISPLAY_LABEL[family];
    }
  }
  const norm = normalizeDepartmentTypeKey(dept);
  if (EXTRA_DEPARTMENT_LABELS[norm]) return EXTRA_DEPARTMENT_LABELS[norm];
  const stripped = String(dept).replace(/^DEP:/i, "").trim();
  return stripped.replace(/_/g, " ");
}