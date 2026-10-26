/**
 * Maps Next App Router paths under `/dashboard/*` to legacy prefix keys in `ROUTE_PERMISSIONS`.
 */
export function toLegacyGuardPath(location: string): string {
  const path = location.split("?")[0] || "/";
  if (path === "/dashboard" || path === "/dashboard/") return "/";
  if (!path.startsWith("/dashboard/")) return path;
  const sub = path.slice("/dashboard".length);
  if (sub === "/audit-logs" || sub.startsWith("/audit-logs/")) return "/admin/audit-logs";
  return sub;
}
