import { LEGACY_ROLE_KEYS } from "@/lib/legacy-role-keys";
import { normalizeRole } from "@/lib/role-utils";

const DD_EXEC_LEGACY_IDS = new Set(
  Object.entries(LEGACY_ROLE_KEYS)
    .filter(([, key]) => key === "dd_executive")
    .map(([id]) => id),
);

function roleKeyIsDdExecutive(value: string): boolean {
  const v = String(value ?? "").trim();
  if (!v) return false;
  if (DD_EXEC_LEGACY_IDS.has(v)) return true;
  const n = normalizeRole(v);
  return n === "dd_executive" || (n.includes("dd") && n.includes("executive"));
}

/** Active users who hold the D&D Executive role (modern key or legacy L41 / multi-role list). */
export function userHasDdExecutiveRole(u: {
  role?: string | null;
  rawRole?: string | null;
  roles?: string[] | null;
  roleIds?: string[] | null;
  roleTitles?: { id: string; title: string }[] | null;
  isActive?: boolean;
  isDeactive?: boolean;
}): boolean {
  if (u.isDeactive || u.isActive === false) return false;

  if (roleKeyIsDdExecutive(String(u.role ?? ""))) return true;
  if (roleKeyIsDdExecutive(String(u.rawRole ?? ""))) return true;

  if (Array.isArray(u.roles) && u.roles.some((r) => roleKeyIsDdExecutive(String(r)))) return true;
  if (Array.isArray(u.roleIds) && u.roleIds.some((id) => DD_EXEC_LEGACY_IDS.has(String(id)))) return true;

  const rawRoleId = String(u.rawRole ?? "");
  if (/^[\d,\s]+$/.test(rawRoleId)) {
    const ids = rawRoleId.split(",").map((x) => x.trim()).filter(Boolean);
    if (ids.some((id) => DD_EXEC_LEGACY_IDS.has(id))) return true;
  }

  if (Array.isArray(u.roleTitles)) {
    for (const t of u.roleTitles) {
      if (DD_EXEC_LEGACY_IDS.has(String(t.id))) return true;
    }
  }

  return false;
}

export function filterDdExecutiveUsers(users: any[] | null | undefined): any[] {
  return (users ?? []).filter(userHasDdExecutiveRole);
}