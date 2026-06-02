import { Router } from "express";
import { db } from "./db";
import { drmPolicies, insertDrmPolicySchema } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "./auth.middleware";

const router = Router();

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
    const validatedData = insertDrmPolicySchema.parse(req.body);
    if ((req as any).user) {
      validatedData.createdBy = (req as any).user.userId;
    }
    const [newPolicy] = await db.insert(drmPolicies).values(validatedData as any).returning();
    res.status(201).json(newPolicy);
  } catch (error: any) {
    console.error("Error creating policy:", error);
    res.status(400).json({ error: error.message || "Failed to create policy" });
  }
});

// Delete a policy
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(drmPolicies).where(eq(drmPolicies.id, id));
    res.status(204).end();
  } catch (error: any) {
    console.error("Error deleting policy:", error);
    res.status(500).json({ error: "Failed to delete policy" });
  }
});

export default router;
