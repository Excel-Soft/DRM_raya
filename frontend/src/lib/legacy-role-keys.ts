// Old-DRM roles were migrated into drm.roles as labels like "Sales Executive [L25]"
// (L<id> = old webxl role id). Users, the sidebar and every permission check use the
// new role KEYS ("sales_executive"), so a label saved as an allowed role never matched.
// Keys below are the ones the migration gave users with that old role id.
// Copy of backend/src/shared/legacy-role-keys.ts — keep in sync.
export const LEGACY_ROLE_KEYS: Record<string, string> = {
  "2": "sales_manager",
  "14": "admin",
  "25": "sales_executive",
  "26": "sales_assistant_manager",
  "27": "service_manager",
  "28": "service_assistant_manager",
  "29": "service_executive",
  "30": "reception_manager",
  "31": "project_manager",
  "32": "account_manager",
  "34": "seo_smm_manager",
  "35": "product_posting_manager",
  "36": "posting_assistant_manager",
  "37": "product_posting_executive",
  "38": "seo_smm_executive",
  "39": "dd_manager",
  "40": "dd_assistant_manager",
  "41": "dd_executive",
  "42": "internship_executive",
  "43": "trainee_executive",
  "44": "accounts_assistant_manager",
  "45": "it_manager",
  "46": "it_executive",
  "48": "hod",
  "49": "office_boy",
  "50": "rnd",
  "51": "wecl_manager",
  "52": "wecl_assistant_manager",
  "53": "wecl_reception",
  "54": "deactive",
  "55": "lead_manager",
  "57": "qa_manager",
  "58": "verification_manager",
  "59": "complaint_manager",
  "60": "marketing_manager",
  "61": "media_manager",
  "62": "media_executive",
  "63": "software_manager",
  "64": "software_executive",
  "65": "full_salary",
  "66": "ta_manager",
  "67": "ta_assistant_manager",
  "68": "ta_executive",
  "69": "lead_executive",
  "70": "account_auditor",
  "71": "junior_admin",
  "73": "super_hod",
  "74": "developer",
};

/** "Sales Executive [L25]" -> "sales_executive"; anything else is returned trimmed. */
export function canonicalRoleKey(value: string): string {
  const v = String(value ?? "").trim();
  const m = /\[L(\d+)\]\s*$/.exec(v);
  if (m && LEGACY_ROLE_KEYS[m[1]]) return LEGACY_ROLE_KEYS[m[1]];
  if (m) return v.replace(/\s*\[L\d+\]\s*$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return v;
}

export function canonicalRoleKeys(values: string[] | null | undefined): string[] {
  return Array.from(new Set((values ?? []).map(canonicalRoleKey).filter(Boolean)));
}
