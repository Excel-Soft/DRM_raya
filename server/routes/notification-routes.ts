import { Router } from "express";
import { NotificationService } from "../services/notification-service";
import { requireRole } from "../auth.middleware";

export const notificationRouter = Router();

// GET /api/notifications
// Gets all notifications for the current user
notificationRouter.get("/", async (req, res) => {
    try {
        const userId = req.user!.userId;
        console.log(`[API] Fetching notifications for userId: ${userId}`);
        const notifications = await NotificationService.getUserNotifications(userId);
        res.json({ success: true, data: notifications });
    } catch (error) {
        console.error("[Notifications GET]", error);
        res.status(500).json({ success: false, error: "Failed to fetch notifications" });
    }
});

// PUT /api/notifications/:id/read
// Marks a specific notification as read
notificationRouter.put("/:id/read", async (req, res) => {
    try {
        await NotificationService.markAsRead(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to mark as read" });
    }
});
