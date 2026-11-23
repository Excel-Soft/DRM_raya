import { pool } from "../db";
import { normalizeRole } from "./role-utils";

// Role titles for user lists. drm.roles names carry the legacy role id as a
// suffix, e.g. "Sales Executive [L25]", "Deactive [L54]". users.role_id is the
// legacy comma-separated id list ("14,65,"), so each user can be put under
// every one of their roles by title. Cached briefly; roles rarely change.
export const DEACTIVE_ROLE_ID = "54";
let roleTitleCache: { at: number; byId: Map<string, string>; byKey: Map<string, string> } | null = null;

export async function loadRoleTitles() {
  if (roleTitleCache && Date.now() - roleTitleCache.at < 5 * 60 * 1000) return roleTitleCache;
  const byId = new Map<string, string>();
  const byKey = new Map<string, string>(); // normalized role key -> legacy id
  const { rows } = await pool.query(`select name from drm.roles`);
  const parsed = rows
    .map((r) => /^(.*?)\s*\[L(\d+)\]\s*$/.exec(String(r.name ?? "")))
    .filter((m): m is RegExpExecArray => !!m)
    .sort((a, b) => Number(a[2]) - Number(b[2])); // deterministic key -> id
  for (const m of parsed) {
    const title = m[1].trim();
    byId.set(m[2], title);
    const key = normalizeRole(title);
    if (key && !byKey.has(key)) byKey.set(key, m[2]);
  }
  roleTitleCache = { at: Date.now(), byId, byKey };
  return roleTitleCache;
}

export function userRoleInfo(
  u: any,
  titles: { byId: Map<string, string>; byKey: Map<string, string> },
): { roleIds: string[]; roleTitles: { id: string; title: string }[]; isDeactive: boolean } {
  const raw = String(u.role_id ?? "");
  let ids = /^[\d,\s]+$/.test(raw) ? raw.split(",").map((x) => x.trim()).filter(Boolean) : [];
  if (ids.length === 0) {
    // Non-legacy users store role keys (role_id "sales_manager", roles[]).
    const keys = [u.role_id, u.role, ...(Array.isArray(u.roles) ? u.roles : [])].filter(Boolean);
    ids = keys.map((k: string) => titles.byKey.get(normalizeRole(String(k)))).filter(Boolean) as string[];
  }
  ids = [...new Set(ids)];
  return {
    roleIds: ids,
    roleTitles: ids.map((id) => ({ id, title: titles.byId.get(id) ?? `Role ${id}` })),
    isDeactive: ids.includes(DEACTIVE_ROLE_ID),
  };
}
