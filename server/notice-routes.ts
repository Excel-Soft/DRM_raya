import { Router } from "express";
import { db } from "./db";
import { notices, insertNoticeSchema, users, noticeAssignments } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "./auth.middleware";

const router = Router();

// Get all notices
router.get("/", authMiddleware, async (req, res) => {
  try {
    const allNotices = await db
      .select({
        id: notices.id,
        title: notices.title,
        description: notices.description,
        status: notices.status,
        assignedByUserId: notices.assignedByUserId,
        assignedToRole: notices.assignedToRole,
        assignedToDepartment: notices.assignedToDepartment,
        assignedDate: notices.assignedDate,
        createdAt: notices.createdAt,
        updatedAt: notices.updatedAt,
        assignedBy: {
          name: users.name,
        },
      })
      .from(notices)
      .leftJoin(users, eq(notices.assignedByUserId, users.id))
      .orderBy(desc(notices.createdAt));
    res.json(allNotices);
  } catch (error: any) {
    console.error("Error fetching notices:", error);
    res.status(500).json({ error: "Failed to fetch notices" });
  }
});

// Create a new notice
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = (req.user as any).userId;
    const validatedData = insertNoticeSchema.parse({
      ...req.body,
      assignedByUserId: userId,
    });

    const [newNotice] = await db.insert(notices).values(validatedData).returning();
    res.status(201).json(newNotice);
  } catch (error: any) {
    console.error("Error creating notice:", error);
    res.status(400).json({ error: error.message || "Failed to create notice" });
  }
});

// Update a notice
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const [updatedNotice] = await db
      .update(notices)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(notices.id, id))
      .returning();

    if (!updatedNotice) {
      return res.status(404).json({ error: "Notice not found" });
    }
    res.json(updatedNotice);
  } catch (error: any) {
    console.error("Error updating notice:", error);
    res.status(400).json({ error: "Failed to update notice" });
  }
});

// Delete a notice
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(notices).where(eq(notices.id, id));
    res.status(204).end();
  } catch (error: any) {
    console.error("Error deleting notice:", error);
    res.status(500).json({ error: "Failed to delete notice" });
  }
});

// Assign a notice to a user
router.post("/assign", authMiddleware, async (req, res) => {
  try {
    const { noticeId, userId } = req.body;
    const assignedByUserId = (req.user as any).userId;
    
    await db.insert(noticeAssignments).values({
      noticeId,
      userId,
      assignedByUserId,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error assigning notice:", error);
    res.status(400).json({ error: "Failed to assign notice" });
  }
});

export default router;
