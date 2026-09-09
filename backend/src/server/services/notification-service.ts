import { db, pool } from "../db";
import { notifications } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import * as fs from "fs";

export class NotificationService {
    /**
     * Create a new notification for a specific user.
     */
    static async notify(data: {
        userId: string;
        message: string;
        type?: "INFO" | "WARNING" | "SUCCESS" | "ERROR";
        link?: string;
        targetUrl?: string;
    }) {
        try {
            // If no userId, we can't notify a specific user
            if (!data.userId) {
                console.warn("[NotificationService] Attempted to notify with no userId");
                return;
            }

            // FILE LOG FOR DEBUGGING
            try {
                fs.appendFileSync('notification_debug_log.txt', `[${new Date().toISOString()}] USER: ${data.userId} MESSAGE: ${data.message}\n`);
            } catch (e) {}

            // If the userId doesn't look like a UUID, we check if it's a role
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.userId)) {
                console.log(`[NotificationService] userId '${data.userId}' is not a UUID, treated as role notification`);
                await this.notifyRole(data.userId, data.message, data.type, { link: data.link, targetUrl: data.targetUrl });
                return;
            }

            // Use raw SQL to avoid Drizzle schema validation issues
            await pool.query(
                `INSERT INTO drm.notifications (id, user_id, message, type, read_status, link, target_url, created_at, updated_at)
                 VALUES (gen_random_uuid(), $1, $2, $3, 'UNREAD', $4, $5, NOW(), NOW())`,
                [
                    data.userId,
                    data.message,
                    data.type || "INFO",
                    data.link || null,
                    data.targetUrl || null,
                ]
            );
            console.log(`[NotificationService] Notification created for user ${data.userId}`);
        } catch (error) {
            console.error("[NotificationService] Failed to create notification:", error);
        }
    }


    /**
     * Notify all users with a specific role.
     */
    static async notifyRole(role: string, message: string, type?: "INFO" | "WARNING" | "SUCCESS" | "ERROR", urls?: { link?: string, targetUrl?: string }) {
        try {
            const { users } = await import("../../shared/schema");
            const { eq, sql, or } = await import("drizzle-orm");

            // Check both roleId (string) and roles (array)
            const roleUsers = await db.select().from(users).where(
                or(
                    eq(users.roleId, role as any),
                    sql`${role} = ANY(${users.roles})`
                )
            );

            for (const user of roleUsers) {
                await this.notify({ userId: user.id, message, type, link: urls?.link, targetUrl: urls?.targetUrl });
            }
        } catch (error) {
            console.error("[NotificationService] Role-based notify failed:", error);
        }
    }

    static async getUserNotifications(userId: string) {
        return await db
            .select()
            .from(notifications)
            .where(eq(notifications.userId, userId))
            .orderBy(desc(notifications.createdAt));
    }

    static async markAsRead(notificationId: string) {
        await db
            .update(notifications)
            .set({ readStatus: "READ" })
            .where(eq(notifications.id, notificationId));
    }

    // ===================================================================
    // Stage 2 explicit API — never treats a role string as a user id.
    // Prefer these over the legacy `notify`/`notifyRole` for new code.
    // ===================================================================

    private static readonly UUID_RE =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    /**
     * Create a notification for ONE concrete user. Unlike the legacy `notify`,
     * this REQUIRES a real UUID user id and will never silently fall back to a
     * role broadcast — passing a role string is a programming error and is
     * rejected (logged + skipped) so role strings can never become user ids.
     */
    static async createNotification(data: {
        userId: string;
        message: string;
        type?: "INFO" | "WARNING" | "SUCCESS" | "ERROR";
        link?: string;
        targetUrl?: string;
        module?: string;
        entityType?: string;
        entityId?: string;
        priority?: "low" | "normal" | "high";
    }): Promise<boolean> {
        if (!data.userId || !this.UUID_RE.test(data.userId)) {
            console.error(
                `[NotificationService] createNotification rejected: '${data.userId}' is not a valid user UUID (role strings are not allowed here)`,
            );
            return false;
        }
        try {
            await pool.query(
                `INSERT INTO drm.notifications (id, user_id, message, type, read_status, link, target_url, module, entity_type, entity_id, priority, created_at, updated_at)
                 VALUES (gen_random_uuid(), $1, $2, $3, 'UNREAD', $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
                [
                    data.userId,
                    data.message,
                    data.type || "INFO",
                    data.link || data.targetUrl || null,
                    data.targetUrl || null,
                    data.module || null,
                    data.entityType || null,
                    data.entityId || null,
                    data.priority || "normal",
                ],
            );
            return true;
        } catch (error) {
            console.error("[NotificationService] createNotification failed:", error);
            return false;
        }
    }

    /**
     * Create the same notification for many users (deduplicated). Each id is
     * validated as a UUID; non-UUID entries are skipped, never broadcast.
     * Returns the number of notifications actually created.
     */
    static async createNotificationsForUsers(
        userIds: string[],
        payload: {
            message: string;
            type?: "INFO" | "WARNING" | "SUCCESS" | "ERROR";
            link?: string;
            targetUrl?: string;
            module?: string;
            entityType?: string;
            entityId?: string;
            priority?: "low" | "normal" | "high";
        },
    ): Promise<number> {
        const unique = Array.from(new Set((userIds || []).filter(Boolean)));
        let created = 0;
        for (const userId of unique) {
            if (await this.createNotification({ userId, ...payload })) created += 1;
        }
        return created;
    }

    /**
     * Resolve a role string to the list of ACTIVE user ids holding that role.
     * Checks both the legacy `roleId`/`role` columns and the `roles` array.
     * Returns user ids only — the caller decides what to do with them.
     */
    static async resolveUsersByRole(role: string): Promise<string[]> {
        if (!role) return [];
        try {
            const { rows } = await pool.query(
                `SELECT id FROM drm.users
                 WHERE (role_id = $1 OR role = $1 OR $1 = ANY(roles))
                   AND (is_active IS NULL OR is_active = true)`,
                [role],
            );
            return rows.map((r: { id: string }) => r.id);
        } catch (error) {
            console.error("[NotificationService] resolveUsersByRole failed:", error);
            return [];
        }
    }

    /**
     * Resolve users who hold `role` AND belong to `department`. Used to scope
     * managerial notifications to a single department instead of company-wide.
     */
    static async resolveUsersByDepartmentRole(
        department: string,
        role: string,
    ): Promise<string[]> {
        if (!department || !role) return [];
        try {
            const { rows } = await pool.query(
                `SELECT id FROM drm.users
                 WHERE department = $1
                   AND (role_id = $2 OR role = $2 OR $2 = ANY(roles))
                   AND (is_active IS NULL OR is_active = true)`,
                [department, role],
            );
            return rows.map((r: { id: string }) => r.id);
        } catch (error) {
            console.error("[NotificationService] resolveUsersByDepartmentRole failed:", error);
            return [];
        }
    }

    /**
     * Notify the relevant recipients of a workflow status transition. Recipients
     * may be given as concrete user ids and/or roles (each role is resolved to
     * real user ids first — never used as a user id). Returns count created.
     */
    static async notifyWorkflowTransition(data: {
        message: string;
        type?: "INFO" | "WARNING" | "SUCCESS" | "ERROR";
        recipientUserIds?: string[];
        recipientRoles?: string[];
        department?: string;
        module?: string;
        entityType?: string;
        entityId?: string;
        targetUrl?: string;
        priority?: "low" | "normal" | "high";
    }): Promise<number> {
        const ids = new Set<string>((data.recipientUserIds || []).filter(Boolean));
        for (const role of data.recipientRoles || []) {
            const resolved = data.department
                ? await this.resolveUsersByDepartmentRole(data.department, role)
                : await this.resolveUsersByRole(role);
            resolved.forEach((id) => ids.add(id));
        }
        return this.createNotificationsForUsers(Array.from(ids), {
            message: data.message,
            type: data.type,
            targetUrl: data.targetUrl,
            link: data.targetUrl,
            module: data.module,
            entityType: data.entityType,
            entityId: data.entityId,
            priority: data.priority,
        });
    }
}
