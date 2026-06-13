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

/**
 * Context passed to an action-permission `predicate`. Lets callers express
 * ownership / stage-status / department-team checks declaratively through the
 * same guard, without baking resource-specific logic into the middleware.
 */
export interface ActionPermissionContext {
    req: Request;
    /** The caller's normalized active role. */
    role: string;
    /** The authenticated auth payload (req.user). */
    user: any;
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
    /**
     * Optional async context predicate for ownership / stage-status /
     * department-team checks that need the request (params/body), the resolved
     * record, etc. When provided it MUST return true for the action to proceed;
     * returning false (or throwing) yields a 403. This runs AFTER the role gate,
     * so role + ownership/stage can be combined. Resource-specific ownership and
     * stage checks may still also live inside handlers (which remain
     * authoritative); the predicate simply makes them expressible through this
     * guard as well.
     */
    predicate?: (ctx: ActionPermissionContext) => boolean | Promise<boolean>;
    /** Human-readable message returned on a 403 (defaults to a generic deny). */
    message?: string;
}

/**
 * Reusable backend action-permission guard.
 *
 * Fails CLOSED: an unauthenticated request → 401, a request whose (normalized)
 * role is not in the allowed set → 403, and a `predicate` that returns false or
 * throws → 403. This is intended as a thin, declarative authorization layer in
 * front of sensitive write actions (user management, HR/loan approvals, etc.).
 *
 * It does NOT remove handler-level segregation-of-duties checks (e.g. "cannot
 * approve your own request") — those remain authoritative inside the handlers
 * and continue to run after this guard.
 *
 * @param actionKey Stable identifier for the protected action (for logging).
 * @param options   Allowed roles, custom role predicate, and/or context predicate.
 */
export function requireActionPermission(
    actionKey: string,
    options: ActionPermissionOptions = {},
) {
    const allowed = (options.roles ?? []).map((r) => normalizeRole(r));

    return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return sendError(res, unauthorized());
        }

        const role = normalizeRole(callerRole(req));

        const hasRoleConstraint = allowed.length > 0 || Boolean(options.allowRole);
        const passesList = allowed.length > 0 && allowed.includes(role);
        const passesAllowRole = options.allowRole ? options.allowRole(role) : false;

        // Role gate: when a role constraint is configured the caller must satisfy it.
        if (hasRoleConstraint && !(passesList || passesAllowRole)) {
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
        }

        // Context predicate gate: ownership / stage-status / department-team.
        // Fails CLOSED — a predicate that returns false or throws is a denial.
        if (options.predicate) {
            let ok = false;
            try {
                ok = await options.predicate({ req, role, user: req.user });
            } catch (err) {
                console.error(
                    `[ACTION_PERMISSION] Predicate error for action "${actionKey}":`,
                    err,
                );
                ok = false;
            }
            if (!ok) {
                console.warn(
                    `[ACTION_PERMISSION] Denied action "${actionKey}" by predicate for role "${role}"`,
                );
                return sendError(
                    res,
                    forbidden(
                        options.message ||
                            "You are not authorized to perform this action.",
                    ),
                );
            }
        }

        // No constraint configured at all → authentication-only (unchanged).
        return next();
    };
}
