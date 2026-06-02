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
}
