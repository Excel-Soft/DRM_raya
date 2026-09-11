import { type Request, type Response, type NextFunction } from "express";
import type { PoolClient } from "pg";
import { allowedIpsRepository } from "../repositories/allowed-ips.repository";
import { pool, isDbAvailable, ensureDbAvailable } from "../db";
import { normalizeRole, ROLES } from "../utils/role-utils";

// Configuration flag for IP restriction enforcement
export const IP_RESTRICTION_ENABLED = process.env.IP_RESTRICTION_ENABLED === "true";

/**
 * Middleware to check if user's role has permission to access the current path
 * Returns 403 if user role is not in allowedRoleIds for the current path
 */
export async function checkUrlPermission(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.method === "OPTIONS") {
    return next();
  }

  if (!isDbAvailable() && !(await ensureDbAvailable())) {
    return res.status(503).json({
      error: "ServiceUnavailable",
      message: "Database unavailable. Please try again shortly.",
    });
  }

  let client: PoolClient | null = null;
  try {
    // Get the full path including /api prefix
    // req.originalUrl includes /api, req.path does not
    const fullPath = req.originalUrl.split('?')[0].replace(/\/$/, ''); // Remove query params and trailing slash

    // Only apply permission checks to /api/* routes
    // Skip for frontend routes, static files, etc.
    if (!fullPath.startsWith('/api/')) {
      return next();
    }

    // Auth endpoints are public by design.
    // Also bypass /api/account/invoices because it's a legacy endpoint used by sales executives
    // and is protected by its own strong RBAC middleware (requireManualInvoiceCreator, etc).
    if (fullPath.startsWith("/api/auth") || fullPath.startsWith("/api/account/invoices")) {
      return next();
    }

    const user = req.user;

    // Fail closed: Deny access if user is not authenticated for API routes
    if (!user || !user.roleId) {
      console.warn(
        `Permission denied: Unauthenticated request to ${fullPath} method=${req.method} header=${Boolean(req.headers.authorization)} cookie=${Boolean(req.headers.cookie)}`
      );
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required to access this resource.",
      });
    }

    // Normalized active role for this request (collapses aliases like
    // "Super HOD" / "super-hod" -> "super_hod" and "admin" / "super_admin"
    // -> ROLES.ADMIN) so comparisons are consistent.
    const userRoleId = normalizeRole(String(user.roleId));

    // ADMIN BYPASS: ONLY true platform admins (admin / super_admin, both of
    // which normalize to ROLES.ADMIN) skip the URL-permission DB checks. The
    // former broad bypass list (managers, executives, posting roles, etc.) has
    // been removed so that ordinary roles are subject to the same permission
    // rules as everyone else, instead of silently bypassing them.
    if (userRoleId === ROLES.ADMIN) {
      return next();
    }


    const method = (req.method || "GET").toUpperCase();

    client = await pool.connect();
    await client.query("SET statement_timeout = 5000");

    const permissionsResult = await client.query(
      "select id, path, allowed_role_ids from drm.url_permissions",
    );

    type UrlPermissionRow = {
      id: string;
      path: string;
      allowed_role_ids: string[];
    };

    const allPermissions: UrlPermissionRow[] = permissionsResult.rows;

    const matchingEntries = allPermissions.filter((p) => {
      const segment = (p.path || "").trim();
      if (!segment) return false;

      // Check if path matches exactly or as a prefix/segment
      return fullPath === `/api/${segment}` || 
             fullPath.includes(`/${segment}/`) || 
             fullPath.endsWith(`/${segment}`);
    });

    if (matchingEntries.length === 0) {
      // No matching rule for this path -> ALLOW (intentional, see below).
      // The drm.url_permissions table only models menu segments and is
      // currently unpopulated; the authoritative access control for API routes
      // is the per-route role guards. Flipping this to a hard default-deny here
      // would lock every non-admin role out of the entire API. Converting this
      // to a true default-deny requires first populating url_permissions for
      // every API route/role (tracked as a follow-up; see STAGE_1B changelog).
      return next();
    }

    // Check if ANY of the matching entries allow the user's role.
    // An entry allows if its allowed_role_ids is empty OR if the user's
    // (normalized) role matches an entry in the (normalized) allow list.
    const hasAnyPermission = matchingEntries.some((entry) => {
      if (!entry.allowed_role_ids || entry.allowed_role_ids.length === 0) {
        return true;
      }
      return entry.allowed_role_ids.some((role: any) => {
        const roleName = typeof role === 'string' ? role : (role.name || role.id);
        const candidate = String(roleName).toLowerCase();
        // Match the raw stored value (e.g. numeric role-id strings like "14")
        // or its normalized role alias against the caller's normalized role.
        return candidate === userRoleId || normalizeRole(candidate) === userRoleId;
      });
    });

    if (hasAnyPermission) {
      return next();
    }

    // Permission denied
    console.warn(
      `Permission denied: User ${user.userId} (role: ${userRoleId}) attempted to access ${fullPath}.`
    );
    return res.status(403).json({
      error: "Access denied",
      message: "You do not have permission to access this resource.",
    });
  } catch (error: any) {
    console.error("Error checking URL permission:", error);
    return res.status(503).json({
      error: "ServiceUnavailable",
      message: "Unable to verify permissions (database unavailable).",
    });
  } finally {
    try {
      if (client) {
        await client.query("SET statement_timeout = DEFAULT");
        client.release();
      }
    } catch (err) {
      console.error("Error cleaning up permission DB client:", err);
    }
  }
}

/**
 * Middleware to check if request IP is in the allowed IPs list
 * Only enforced if IP_RESTRICTION_ENABLED is true
 * Returns 403 if IP is not in allowedIps table
 */
export async function checkAllowedIp(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.method === "OPTIONS") {
    return next();
  }

  // Skip if IP restriction is not enabled
  if (!IP_RESTRICTION_ENABLED) {
    return next();
  }

  if (!isDbAvailable() && !(await ensureDbAvailable())) {
    return res.status(503).json({
      error: "ServiceUnavailable",
      message: "Database unavailable. Please try again shortly.",
    });
  }

  try {
    // Get client IP address
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      "unknown";

    // Check if IP is in allowed list
    const isAllowed = await allowedIpsRepository.isIpAllowed(ip);

    if (!isAllowed) {
      console.warn(
        `IP restriction: Access denied from IP ${ip} for path ${req.path}`
      );
      return res.status(403).json({
        error: "Access denied",
        message: "Your IP address is not authorized to access this system.",
      });
    }

    // IP is allowed
    next();
  } catch (error: any) {
    console.error("Error checking allowed IP:", error);
    // On error, deny access (fail-closed for security)
    return res.status(500).json({
      error: "Internal server error",
      message: "Unable to verify IP authorization.",
    });
  }
}

/**
 * Helper function to check if a user has permission for a specific path
 * Used for programmatic permission checks (not middleware)
 */
export async function userHasPermission(
  userId: string,
  userRolesInput: string | string[],
  path: string
): Promise<boolean> {
  try {
    const userRoles = Array.isArray(userRolesInput) ? userRolesInput : [userRolesInput];
    const fullPath = path.split("?")[0].replace(/\/$/, "");
    const permissionsResult = await pool.query(
      "select id, path, allowed_role_ids from drm.url_permissions",
    );

    const candidates = (permissionsResult.rows as Array<{
      path: string;
      allowed_role_ids: string[];
    }>).filter((p) => {
      const normalizedPath = (p.path || "").trim().replace(/\/$/, "");
      if (!normalizedPath) return false;

      if (normalizedPath.endsWith("*")) {
        const base = normalizedPath.slice(0, -1).replace(/\/$/, "");
        return fullPath === base || fullPath.startsWith(base + "/");
      }

      return fullPath === `/api/${normalizedPath}` || fullPath.startsWith(`/api/${normalizedPath}/`);
    });

    const permission = candidates[0];

    if (!permission) return true;
    if (!permission.allowed_role_ids || permission.allowed_role_ids.length === 0) return true;

    // Check if any of the user's roles are in the allowed list
    return userRoles.some(role =>
      permission.allowed_role_ids.some((ar: any) => {
        const arName = typeof ar === 'string' ? ar : (ar.name || ar.id);
        return String(arName).toLowerCase() === role.toLowerCase();
      })
    );

  } catch (error) {
    console.error("Error checking user permission:", error);
    return false;
  }
}

/**
 * Helper function to get client IP from request
 */
export function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
}
