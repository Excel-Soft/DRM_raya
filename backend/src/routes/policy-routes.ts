import { Router } from "express";
import { db } from "../db";
import { drmPolicies, insertDrmPolicySchema } from "@models/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.middleware";
import { isManagerialRole } from "../utils/role-utils";
import { ActivityLogService } from "../services/activity-service";

const router = Router();

function getUserRole(req: any): string | undefined {
  return req.user?.roleId ?? req.user?.activeRoleId ?? req.user?.role;
}

function canManage(req: any): boolean {
  return isManagerialRole(getUserRole(req));
}

// Get all policies
router.get("/", authMiddleware, async (req, res) => {
  try {
    const allPolicies = await db
      .select()
      .from(drmPolicies)
      .orderBy(desc(drmPolicies.createdAt));
    res.json(allPolicies);
  } catch (error: any) {
    console.error("Error fetching policies:", error);
    res.status(500).json({ error: "Failed to fetch policies" });
  }
});

// Create a new policy
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!canManage(req)) return res.status(403).json({ error: "Insufficient permissions" });
    const validatedData = insertDrmPolicySchema.parse(req.body);
    const userId = (req.user as any).userId;
    validatedData.createdBy = userId;
    const [newPolicy] = await db.insert(drmPolicies).values(validatedData as any).returning();
    await ActivityLogService.log({
      userId,
      action: "create",
      resourceType: "policy",
      resourceId: newPolicy.id,
      details: (newPolicy as any).title ?? (newPolicy as any).name,
    });
    res.status(201).json(newPolicy);
  } catch (error: any) {
    console.error("Error creating policy:", error);
    res.status(400).json({ error: error.message || "Failed to create policy" });
  }
});

// Delete a policy
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!canManage(req)) return res.status(403).json({ error: "Insufficient permissions" });
    const { id } = req.params;
    await db.delete(drmPolicies).where(eq(drmPolicies.id, id));
    await ActivityLogService.log({
      userId: (req.user as any).userId,
      action: "delete",
      resourceType: "policy",
      resourceId: id,
    });
    res.status(204).end();
  } catch (error: any) {
    console.error("Error deleting policy:", error);
    res.status(500).json({ error: "Failed to delete policy" });
  }
});

export default router;
