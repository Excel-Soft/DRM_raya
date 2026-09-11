import { Router, Request, Response } from "express";
import { db } from "../db";
import { notifications } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.userId || (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userNotifications = await db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: (n, { desc }) => [desc(n.createdAt)],
      limit: 50,
    });
    return res.json(userNotifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.put("/:id/read", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.userId || (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    await db.update(notifications)
      .set({ readStatus: "READ" })
      .where(eq(notifications.id, id));
    return res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({ error: "Failed to mark as read" });
  }
});

export const notificationRouter = router;
