/** Normalize `GET /api/users` and similar list payloads for React Query. */
export function parseUsersList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.users)) return o.users;
    if (Array.isArray(o.data)) return o.data;
    if (o.data && typeof o.data === "object") {
      const inner = o.data as Record<string, unknown>;
      if (Array.isArray(inner.users)) return inner.users;
    }
  }
  return [];
}

export function parseRolesList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.roles)) return o.roles;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}
