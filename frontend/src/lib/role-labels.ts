const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sales_manager: "Sales Manager",
  sales_assistant_manager: "Sales Assistant Manager",
  sales_executive: "Sales Executive",
  account_manager: "Account Manager",
  developer: "Developer",
  hod: "HOD",
  super_hod: "Super HOD",
  service_manager: "Service Manager",
  service_assistant_manager: "Service Assistant Manager",
  service_executive: "Service Executive",
  product_posting_executive: "Product Posting Executive",
  product_posting_manager: "Product Posting Manager",
  qa_manager: "QA Manager",
  verification_manager: "Verification Manager",
  posting_executive: "Product Posting Executive",
  dd_manager: "D&D Manager",
  dd_executive: "D&D Executive",
  it_manager: "IT Manager",
  reception_manager: "Reception Manager",
  seo_smm_manager: "SEO/SMM Manager",
  software_manager: "Software Manager",
  software_executive: "Software Executive",
  lead_manager: "Lead Manager",
  lead_executive: "Lead Executive",
  marketing_manager: "Marketing Manager",
  complaint_manager: "Complaint Manager",
};

function normalizeRoleKey(role: string): string {
  return role
    .toLowerCase()
    .trim()
    .replace(/d\s*&\s*d/g, "dd")
    .replace(/&/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

export function formatRoleLabel(role: string | undefined | null): string {
  if (!role) return "Sales Executive";
  if (/^\d+(\s*,\s*\d+)+$/.test(role.trim())) return "Admin";
  const key = normalizeRoleKey(role);
  if (ROLE_LABELS[key]) return ROLE_LABELS[key];
  return key
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function normalizeRoleForCompare(role: string): string {
  if (/^\d+(\s*,\s*\d+)+$/.test(role.trim())) return "admin";
  return normalizeRoleKey(role);
}
