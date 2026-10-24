/** Aligns with registry `ADMIN_ONLY` and Next `ADMIN_ONLY_ROUTE_ROLES`. */
export const ADMIN_ONLY_ROLES = ["admin", "super_admin", "administrator", "super_hod"] as const;

export function isAdminOnlyRole(activeRoleId: string | null, roles: string[]): boolean {
  const set = new Set<string>();
  if (activeRoleId) set.add(activeRoleId.toLowerCase());
  roles.forEach((r) => set.add(String(r).toLowerCase()));
  return ADMIN_ONLY_ROLES.some((r) => set.has(r));
}
