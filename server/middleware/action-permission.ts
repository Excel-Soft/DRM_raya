import type { Request, Response, NextFunction } from "express";
import { normalizeRole, ROLES } from "../utils/role-utils";
import { sendError, forbidden, unauthorized } from "../utils/api-error";
import { AuditLogService } from "../services/audit-log.service";
import { ACTION_PERMISSIONS } from "../config/action-permissions";

/**
 * Resolve the caller's effective (active) role from the auth payload, mirroring
 * the convention used across the route handlers (activeRoleId → roleId → role).
 */
function callerRole(req: Request): string {
    const u = req.user as any;
    return (u?.activeRoleId ?? u?.roleId ?? u?.role ?? "") as string;
}

function callerUserId(req: Request): string | undefined {
    const u = req.user as any;
    return (u?.userId ?? u?.id ?? u?.user_id) as string | undefined;
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
    /**
     * When true, a caller whose NORMALIZED role is ADMIN bypasses the ROLE gate
     * (the `roles`/`allowRole` check) — but NEVER the `predicate` /
     * segregation-of-duties gate, which still runs. Defaults to FALSE, so admin
     * is granted access only where a policy (registry entry or call site)
     * explicitly opts in. This keeps least-privilege the default.
     */
    adminOverride?: boolean;
    /**
     * When true, DENIED attempts (401/403) are recorded best-effort to the audit
     * log so unauthorized attempts on sensitive actions leave a trail. Never
     * throws (audit logging is best-effort).
     */
    auditDenied?: boolean;
    /** Entity type recorded on a denied-attempt audit row (defaults to "Action"). */
    auditEntityType?: string;
    /** Module recorded on a denied-attempt audit row. */
    module?: string;
}

/**
 * Reusable backend action-permission guard.
 *
 * Fails CLOSED: an unauthenticated request → 401, a request whose (normalized)
 * role is not in the allowed set → 403, and a `predicate` that returns false or
 * throws → 403. This is intended as a thin, declarative authorization layer in
 * front of sensitive write actions (user management, HR/loan approvals, etc.).
 *
 * Config-driven: when `actionKey` is present in `ACTION_PERMISSIONS`
 * (server/config/action-permissions.ts), its policy supplies defaults for
 * roles / allowRole / adminOverride / audit / entityType / module / message.
 * Anything passed explicitly in `options` overrides the registry. Call sites
 * that pass their own `roles`/`allowRole` (e.g. financial-permission,
 * report-permission) are therefore unaffected by the registry.
 *
 * It does NOT remove handler-level segregation-of-duties checks (e.g. "cannot
 * approve your own request") — those remain authoritative inside the handlers
 * and continue to run after this guard.
 *
 * @param actionKey Stable identifier for the protected action (logging + registry lookup).
 * @param options   Allowed roles, custom role predicate, and/or context predicate.
 */
export function requireActionPermission(
    actionKey: string,
    options: ActionPermissionOptions = {},
) {
    const policy = ACTION_PERMISSIONS[actionKey];

    // Merge explicit options over the registry policy (options win).
    const roles = options.roles ?? policy?.roles;
    const allowRole = options.allowRole ?? policy?.allowRole;
    const predicate = options.predicate; // predicates are code-only; never from registry
    const adminOverride = options.adminOverride ?? policy?.adminOverride ?? false;
    const auditDenied = options.auditDenied ?? policy?.audit ?? false;
    const auditEntityType = options.auditEntityType ?? policy?.entityType ?? "Action";
    const moduleName = options.module ?? policy?.module;
    const message =
        options.message ??
        policy?.message ??
        "You are not authorized to perform this action.";

    const allowed = (roles ?? []).map((r) => normalizeRole(r));

    const recordDenied = (req: Request, reason: string) => {
        if (!auditDenied) return;
        // Best-effort, never throws (AuditLogService swallows errors).
        void AuditLogService.record({
            actorUserId: callerUserId(req),
            action: `${actionKey}.denied`,
            module: moduleName,
            entityType: auditEntityType,
            entityId: String((req.params as any)?.id ?? (req.params as any)?.category ?? ""),
            reason,
            req,
        });
    };

    return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            recordDenied(req, "unauthenticated");
            return sendError(res, unauthorized());
        }

        const role = normalizeRole(callerRole(req));

        const hasRoleConstraint = allowed.length > 0 || Boolean(allowRole);
        const passesList = allowed.length > 0 && allowed.includes(role);
        const passesAllowRole = allowRole ? allowRole(role) : false;
        // adminOverride bypasses ONLY the role gate, never the predicate below.
        const passesAdmin = adminOverride && role === ROLES.ADMIN;

        // Role gate: when a role constraint is configured the caller must satisfy it.
        if (hasRoleConstraint && !(passesList || passesAllowRole || passesAdmin)) {
            console.warn(
                `[ACTION_PERMISSION] Denied action "${actionKey}" for role "${role}"`,
            );
            recordDenied(req, `role_not_permitted:${role}`);
            return sendError(res, forbidden(message));
        }

        // Context predicate gate: ownership / stage-status / department-team.
        // Fails CLOSED — a predicate that returns false or throws is a denial.
        // adminOverride does NOT bypass this gate.
        if (predicate) {
            let ok = false;
            try {
                ok = await predicate({ req, role, user: req.user });
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
                recordDenied(req, "predicate_denied");
                return sendError(res, forbidden(message));
            }
        }

        // No constraint configured at all → authentication-only (unchanged).
        return next();
    };
}
