/**
 * Persists in-app notifications (bell dropdown) to drm.notifications.
 */
import { db, pool } from "../db";
import { notifications } from "@shared/schema";
import { eq } from "drizzle-orm";

export type NotificationInput = {
  userId: string;
  message: string;
  type?: string;
  targetUrl?: string;
  link?: string;
  module?: string;
  entityType?: string;
  entityId?: string;
  priority?: string;
};

async function insertNotification(input: NotificationInput): Promise<void> {
  const userId = String(input.userId || "").trim();
  const message = String(input.message || "").trim();
  if (!userId || !message) return;

  const targetUrl = input.targetUrl ?? input.link ?? null;
  await db.insert(notifications).values({
    userId,
    message,
    type: (input.type ?? "INFO").toUpperCase(),
    readStatus: "UNREAD",
    targetUrl,
    link: input.link ?? targetUrl,
    module: input.module ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    priority: input.priority ?? "normal",
  });
}

export const NotificationService = {
  async notify(input: NotificationInput): Promise<void> {
    await insertNotification(input);
  },

  async createNotification(input: NotificationInput): Promise<void> {
    await insertNotification(input);
  },

  /** Notify every active user whose role_id matches (e.g. hod, account_manager). */
  async notifyRole(
    roleId: string,
    message: string,
    type: string = "INFO",
    opts?: { targetUrl?: string; module?: string; entityType?: string; entityId?: string },
  ): Promise<void> {
    const role = String(roleId || "").trim();
    const msg = String(message || "").trim();
    if (!role || !msg) return;

    const { rows } = await pool.query<{ id: string }>(
      `select id::text as id from drm.users
       where coalesce(is_active, true) = true
         and (
           role_id::text = $1::text
           or lower(coalesce(role_id::text, '')) = lower($1)
           or lower(coalesce(role::text, '')) = lower($1)
         )
       limit 500`,
      [role],
    );

    await Promise.all(
      rows.map((r) =>
        insertNotification({
          userId: r.id,
          message: msg,
          type,
          targetUrl: opts?.targetUrl,
          module: opts?.module,
          entityType: opts?.entityType,
          entityId: opts?.entityId,
        }),
      ),
    );
  },
};
