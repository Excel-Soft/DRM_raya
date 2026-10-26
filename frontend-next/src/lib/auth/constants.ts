/** Paths that do not require an authenticated session (client gate only). */
export const PUBLIC_PATHS = ["/auth"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
