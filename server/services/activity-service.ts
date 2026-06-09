import type { Request } from "express";
import { db } from "../db";
import { activityLogs, insertActivityLogSchema } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

export class ActivityLogService {
    /**
     * Log an activity to the database to preserve a clear audit trail.
     */
    static async log(data: {
        userId?: string;
        action: string;
        resourceType: string;
        resourceId: string;
        details?: string;
    }) {
        try {
            const parsedData = insertActivityLogSchema.parse(data);
            await db.insert(activityLogs).values(parsedData);
        } catch (error) {
            console.error("[ActivityLogService] Failed to log activity:", error);
        }
    }

    static async getLogsForResource(resourceType: string, resourceId: string) {
        return await db
            .select()
            .from(activityLogs)
            .where(
                and(
                    eq(activityLogs.resourceType, resourceType),
                    eq(activityLogs.resourceId, resourceId)
                )
            );
    }
}

/** Best-effort client IP extraction (proxy-aware, no hard dependency on trust-proxy). */
function clientIp(req?: Request): string | undefined {
    if (!req) return undefined;
    const xf = req.headers["x-forwarded-for"];
    if (typeof xf === "string" && xf.length > 0) return xf.split(",")[0].trim();
    return req.ip || (req.socket && req.socket.remoteAddress) || undefined;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined),
    ) as Partial<T>;
}

/**
 * Standard audit-log helper for sensitive admin / financial / HR actions.
 *
 * Reuses the existing `drm.activity_logs` table (no schema change): the richer
 * audit fields the caller supplies — `module`, `before`, `after`, `reason`,
 * plus the request `ip`/`userAgent` — are serialized as JSON into the
 * `details` column. The flat columns map as:
 *   actorUserId -> user_id, action -> action,
 *   entityType  -> resource_type, entityId -> resource_id.
 *
 * SECURITY: callers must pass only safe, non-secret fields in `before`/`after`
 * (never password hashes, tokens or secrets). This helper does not introspect
 * the payload, so it is the caller's responsibility to redact.
 */
export async function recordAuditLog(data: {
    actorUserId?: string;
    action: string;
    module?: string;
    entityType: string;
    entityId: string;
    previousStatus?: string;
    nextStatus?: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
    req?: Request;
}): Promise<void> {
    const context = stripUndefined({
        module: data.module,
        previousStatus: data.previousStatus,
        nextStatus: data.nextStatus,
        before: data.before,
        after: data.after,
        reason: data.reason,
        ip: clientIp(data.req),
        userAgent: data.req?.headers["user-agent"],
    });

    await ActivityLogService.log({
        userId: data.actorUserId,
        action: data.action,
        resourceType: data.entityType,
        resourceId: String(data.entityId),
        details: Object.keys(context).length > 0 ? JSON.stringify(context) : undefined,
    });
}
