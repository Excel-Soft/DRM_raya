// Shared role grouping for employee / user pickers.
//
// GET /api/users returns, per user, `roleTitles` ([{ id, title }] — every role
// the user holds, e.g. 14 "admin" + 25 "Sales Executive") and `isDeactive`
// (holds role 54 "Deactive" = disabled profile). Pickers should:
//   - show one section per role TITLE (not the raw joined id list "1425…"),
//   - list a user under EACH of their roles,
//   - leave out disabled (role 54) profiles.
// Sections are ordered by role id; users by name within a section.

export interface RoleGroup<T> {
  roleId: string;
  role: string; // role title shown as the section heading
  users: T[];
}

type UserLike = {
  id?: string;
  fullName?: string | null;
  username?: string | null;
  name?: string | null;
  full_name?: string | null;
  role?: string | null;
  roleTitles?: { id: string; title: string }[];
  isDeactive?: boolean;
};

const displayName = (u: UserLike) => String(u.fullName || u.full_name || u.name || u.username || "");

/** True for users that should appear in employee pickers (not role 54 "Deactive"). */
export function isActiveEmployee(u: UserLike): boolean {
  return !u.isDeactive;
}

export function groupUsersByRoleTitle<T extends UserLike>(users: T[] | null | undefined): RoleGroup<T>[] {
  const groups = new Map<string, RoleGroup<T>>();
  for (const u of users ?? []) {
    if (!isActiveEmployee(u)) continue;
    const titles =
      u.roleTitles && u.roleTitles.length > 0
        ? u.roleTitles
        : [{ id: "~", title: u.role ? String(u.role).replace(/_/g, " ") : "Unassigned Role" }];
    for (const t of titles) {
      const key = `${t.id}|${t.title}`;
      let g = groups.get(key);
      if (!g) {
        g = { roleId: t.id, role: t.title, users: [] };
        groups.set(key, g);
      }
      if (!g.users.includes(u)) g.users.push(u);
    }
  }
  const order = (id: string) => (/^\d+$/.test(id) ? Number(id) : Number.MAX_SAFE_INTEGER);
  return Array.from(groups.values())
    .sort((a, b) => order(a.roleId) - order(b.roleId) || a.role.localeCompare(b.role))
    .map((g) => ({ ...g, users: [...g.users].sort((a, b) => displayName(a).localeCompare(displayName(b))) }));
}
