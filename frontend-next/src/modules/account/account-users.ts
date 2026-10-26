export type AccountListUser = {
  id: string;
  full_name: string;
  email?: string;
  role?: string;
};

/** Dedupe by id (API can return duplicates). */
export function uniqueAccountUsers(users: AccountListUser[]): AccountListUser[] {
  const map = new Map<string, AccountListUser>();
  for (const u of users) {
    if (u?.id && !map.has(u.id)) map.set(u.id, u);
  }
  return [...map.values()];
}

export function accountUserLabel(u: AccountListUser): string {
  const role = u.role?.trim();
  return role ? `${u.full_name} (${role})` : u.full_name;
}
