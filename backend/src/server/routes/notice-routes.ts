import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { notices, insertNoticeSchema, users, noticeAssignments } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.middleware";
import { isManagerialRole } from "../utils/role-utils";
import { ActivityLogService } from "./services/activity-service";
import { ValidationService } from "./services/validation.service";
import { sendError, unauthorized, forbidden, notFound } from "../utils/api-error";

const router = Router();

function getUserRole(req: any): string | undefined {
  return req.user?.roleId ?? req.user?.activeRoleId ?? req.user?.role;
}

function canManage(req: any): boolean {
  return isManagerialRole(getUserRole(req));
}

// Allow-listed fields for a notice update. Unknown keys are stripped (default
// z.object behaviour) so a client can never mass-assign protected columns such
// as assignedByUserId/createdAt. `null` is permitted for the optional
// assignment columns so the UI can clear an assignment (existing behaviour).
const noticeUpdateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500).optional(),
  description: z.string().trim().min(1, "Description is required").max(8000).optional(),
  status: z.enum(["Active", "Inactive", "Archived"]).optional(),
  assignedToRole: z.string().trim().max(120).nullable().optional(),
  assignedToDepartment: z.string().trim().max(120).nullable().optional(),
}).strict();

const noticeAssignSchema = z.object({
  noticeId: z.string().min(1, "noticeId required"),
  userId: z.string().min(1, "userId required"),
}).strict();

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
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!canManage(req)) return res.status(403).json({ error: "Insufficient permissions" });
    const userId = (req.user as any).userId;
    const { title, description, status, assignedToRole, assignedToDepartment } = req.body ?? {};
    const validatedData = insertNoticeSchema.parse({
      title,
      description,
      status,
      assignedToRole,
      assignedToDepartment,
      assignedByUserId: userId,
    });

    const [newNotice] = await db.insert(notices).values(validatedData).returning();
    await ActivityLogService.log({
      userId,
      action: "create",
      resourceType: "notice",
      resourceId: newNotice.id,
      details: newNotice.title,
    });
    res.status(201).json(newNotice);
  } catch (error: any) {
    console.error("Error creating notice:", error);
    res.status(400).json({ error: error.message || "Failed to create notice" });
  }
});

// Update a notice
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    if (!req.user) throw unauthorized();
    if (!canManage(req)) throw forbidden("Insufficient permissions");
    const { id } = req.params;
    const updates = ValidationService.parse(noticeUpdateSchema, req.body);
    const [updatedNotice] = await db
      .update(notices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notices.id, id))
      .returning();

    if (!updatedNotice) {
      throw notFound("Notice not found");
    }
    await ActivityLogService.log({
      userId: (req.user as any).userId,
      action: "update",
      resourceType: "notice",
      resourceId: updatedNotice.id,
      details: updatedNotice.title,
    });
    res.json(updatedNotice);
  } catch (error: any) {
    console.error("Error updating notice:", error);
    sendError(res, error);
  }
});

// Delete a notice
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!canManage(req)) return res.status(403).json({ error: "Insufficient permissions" });
    const { id } = req.params;
    await db.delete(notices).where(eq(notices.id, id));
    await ActivityLogService.log({
      userId: (req.user as any).userId,
      action: "delete",
      resourceType: "notice",
      resourceId: id,
    });
    res.status(204).end();
  } catch (error: any) {
    console.error("Error deleting notice:", error);
    res.status(500).json({ error: "Failed to delete notice" });
  }
});

// Assign a notice to a user
router.post("/assign", authMiddleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!canManage(req)) return res.status(403).json({ error: "Insufficient permissions" });
    const _assign = noticeAssignSchema.safeParse(req.body);
    if (!_assign.success) return res.status(400).json({ error: "Invalid payload", issues: _assign.error.issues });
    const { noticeId, userId } = _assign.data;
    const assignedByUserId = (req.user as any).userId;
    
    await db.insert(noticeAssignments).values({
      noticeId,
      userId,
      assignedByUserId,
    });
    await ActivityLogService.log({
      userId: assignedByUserId,
      action: "assign",
      resourceType: "notice",
      resourceId: noticeId,
      details: `assigned to ${userId}`,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error assigning notice:", error);
    res.status(400).json({ error: "Failed to assign notice" });
  }
});

export default router;
