/** Map legacy webxl_role.name → app role key (mirrors server/utils/role-utils.ts). */

export function legacyRoleNameToAppRole(name) {
  if (!name) return "sales_executive";
  let normalized = String(name)
    .toLowerCase()
    .trim()
    .replace(/d\s*&\s*d/g, "dd")
    .replace(/&/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/(^|_)d_?n_?d(?=_|$)/g, "$1dd")
    .replace(/(^|_)d_d(?=_|$)/g, "$1dd");

  if (["admin", "administrator", "adm", "super_admin", "junior_admin"].includes(normalized)) return "admin";
  if (normalized === "super_hod" || normalized.includes("super_hod")) return "super_hod";
  if (normalized === "hod" || normalized === "h.o.d" || normalized.includes("head") && normalized.includes("hod"))
    return "hod";
  if (normalized.includes("lead") && normalized.includes("manager")) return "lead_manager";
  if (normalized.includes("lead") && normalized.includes("exec")) return "lead_executive";
  if (normalized.includes("verification") && normalized.includes("manager")) return "verification_manager";
  if (normalized.includes("complaint") && normalized.includes("manager")) return "complaint_manager";
  if (normalized.includes("marketing") && normalized.includes("manager")) return "marketing_manager";
  if (normalized.includes("qa") && normalized.includes("manager")) return "qa_manager";
  if (normalized.includes("software") && normalized.includes("manager")) return "software_manager";
  if (normalized.includes("software") && (normalized.includes("exec") || normalized.includes("exce")))
    return "software_executive";
  if (normalized.includes("it") && normalized.includes("manager")) return "it_manager";
  if (normalized.includes("it") && normalized.includes("exec")) return "it_executive";
  if (normalized.includes("product") && normalized.includes("exec")) return "product_posting_executive";
  if (normalized.includes("product") && (normalized.includes("manage") || normalized.includes("manager")))
    return "product_posting_manager";
  if (normalized.includes("posting") && normalized.includes("exec")) return "product_posting_executive";
  if (normalized.includes("posting") && normalized.includes("assistant")) return "sales_assistant_manager";
  if (normalized.includes("posting") && normalized.includes("manager")) return "product_posting_manager";
  if (normalized.includes("seo") || normalized.includes("smm")) {
    if (normalized.includes("exec")) return "seo_smm_executive";
    return "seo_smm_manager";
  }
  if (normalized.includes("service") && normalized.includes("manager") && !normalized.includes("assistant"))
    return "service_manager";
  if (normalized.includes("service") && normalized.includes("assistant")) return "service_assistant_manager";
  if (normalized.includes("service") && normalized.includes("exec")) return "service_executive";
  if (normalized.includes("sales") && normalized.includes("manager") && !normalized.includes("assistant"))
    return "sales_manager";
  if (normalized.includes("assistant")) return "sales_assistant_manager";
  if (normalized.includes("sales") && normalized.includes("exec")) return "sales_executive";
  if (normalized.includes("account") && !normalized.includes("assistant")) return "account_manager";
  if (normalized.includes("dd") && normalized.includes("exec")) return "dd_executive";
  if (normalized.includes("dd") && (normalized.includes("manager") || normalized.includes("assistant")))
    return "dd_manager";
  if (normalized.includes("developer") || normalized === "developer") return "developer";
  if (normalized.includes("reception")) return "reception_manager";
  if (normalized === "deactive") return "sales_executive";

  normalized = normalized.replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "sales_executive";
}

const PRIMARY_PRIORITY = [
  "admin",
  "super_hod",
  "hod",
  "sales_manager",
  "service_manager",
  "account_manager",
  "lead_manager",
  "developer",
  "sales_executive",
];

export function pickPrimaryRole(roleKeys) {
  const uniq = [...new Set(roleKeys.filter(Boolean))];
  for (const p of PRIMARY_PRIORITY) {
    if (uniq.includes(p)) return p;
  }
  return uniq[0] || "sales_executive";
}

/** @param {string|null|undefined} csv e.g. "25,29,35" @param {Map<string,string>} idToName legacy role id → name */
export function parseLegacyRoleCsv(csv, idToName) {
  const raw = String(csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const keys = [];
  for (const id of raw) {
    const name = idToName.get(id) ?? idToName.get(String(Number(id)));
    if (name) keys.push(legacyRoleNameToAppRole(name));
    else keys.push(legacyRoleNameToAppRole(`role_${id}`));
  }
  const roles = [...new Set(keys)];
  return { roles, primary: pickPrimaryRole(roles) };
}
