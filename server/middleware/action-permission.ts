import type { Request, Response, NextFunction } from "express";
import { normalizeRole } from "../utils/role-utils";
import { sendError, forbidden, unauthorized } from "../utils/api-error";

/**
 * Resolve the caller's effective (active) role from the auth payload, mirroring
 * the convention used across the route handlers (activeRoleId → roleId → role).
 */
function callerRole(req: Request): string {
    const u = req.user as any;
    return (u?.activeRoleId ?? u?.roleId ?? u?.role ?? "") as string;
}

export interface ActionPermissionOptions {
    /**
     * Roles allowed to perform the action. Compared after normalizeRole() on
     * BOTH sides, so "super_admin"/"administrator" collapse to "admin", etc.
     * If omitted, any authenticated user passes the role check (use `predicate`
     * or `allowRole` for custom logic).
     */
    roles?: string[];
    /**
     * Optional custom predicate on the normalized caller role. Receives the
     * already-normalized role string and returns whether it is permitted.
     * Evaluated as an alternative to `roles` (either passing grants access).
     */
    allowRole?: (normalizedRole: string) => boolean;
    /** Human-readable message returned on a 403 (defaults to a generic deny). */
    message?: string;
}

/**
 * Reusable backend action-permission guard.
 *
 * Fails CLOSED: an unauthenticated request → 401, and a request whose
 * (normalized) role is not in the allowed set → 403 with a sanitized envelope.
 * This is intended as a thin, declarative authorization layer in front of
 * sensitive write actions (user management, approvals, etc.). It does NOT
 * replace handler-level segregation-of-duties checks (e.g. "cannot approve your
 * own request"); those remain authoritative inside the handlers.
 *
 * @param actionKey Stable identifier for the protected action (for logging).
 * @param options   Allowed roles and/or a custom predicate.
 */
export function requireActionPermission(
    actionKey: string,
    options: ActionPermissionOptions = {},
) {
    const allowed = (options.roles ?? []).map((r) => normalizeRole(r));

    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return sendError(res, unauthorized());
        }

        const role = normalizeRole(callerRole(req));

        const passesList = allowed.length > 0 && allowed.includes(role);
        const passesPredicate = options.allowRole ? options.allowRole(role) : false;

        if (allowed.length === 0 && !options.allowRole) {
            // No role constraint configured: only require authentication.
            return next();
        }

        if (passesList || passesPredicate) {
            return next();
        }

        console.warn(
            `[ACTION_PERMISSION] Denied action "${actionKey}" for role "${role}"`,
        );
        return sendError(
            res,
            forbidden(
                options.message ||
                    "You are not authorized to perform this action.",
            ),
        );
    };
}
