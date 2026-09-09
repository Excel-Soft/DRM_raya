import { Router } from "express";
import { db } from "./db";
import { targetSystemTargets, targetSystemDailyTargets, targetSystemKwaRecords, targetSystemUserTargets, users } from "../shared/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

// Get all targets
router.get("/targets", async (req, res) => {
  try {
    const targets = await db
      .select()
      .from(targetSystemTargets)
      .orderBy(desc(targetSystemTargets.createdAt));
    res.json(targets);
  } catch (error) {
    console.error("Error fetching target system targets:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch targets" });
  }
});

// Create a new target
router.post("/targets", async (req, res) => {
  try {
    const data = req.body;
    
    const [target] = await db
      .insert(targetSystemTargets)
      .values({
        targetName: data.targetName,
        package: data.package,
        reward: data.reward,
        bonus: data.bonus,
        price: data.price !== undefined ? String(data.price) : "0",
        maxPrice: data.maxPrice !== undefined ? String(data.maxPrice) : "0",
        penalty: data.penalty !== undefined ? String(data.penalty) : "0",
        amount: data.amount,
        number: 0,
        kwa: 0,
        vas: 0
      })
      .returning();
      
    res.status(201).json(target);
  } catch (error) {
    console.error("Error creating target system target:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create target" });
  }
});


// Get all daily targets
router.get("/daily-targets", async (req, res) => {
  try {
    const targets = await db
      .select()
      .from(targetSystemDailyTargets)
      .orderBy(desc(targetSystemDailyTargets.createdAt));
    res.json(targets);
  } catch (error) {
    console.error("Error fetching daily targets:", error);
    res.status(500).json({ error: "Failed to fetch daily targets" });
  }
});

// Create a daily target
router.post("/daily-targets", async (req, res) => {
  try {
    const { role, method, target } = req.body;
    
    if (!role || !method || target === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = await db
      .select()
      .from(targetSystemDailyTargets)
      .where(and(
        eq(targetSystemDailyTargets.role, role), 
        eq(targetSystemDailyTargets.method, method)
      ))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: "A target already exists for this Role and Contact Method." });
    }

    const [newTarget] = await db
      .insert(targetSystemDailyTargets)
      .values({
        role,
        method,
        target: parseInt(target) || 0
      })
      .returning();

    res.status(201).json(newTarget);
  } catch (error) {
    console.error("Error creating daily target:", error);
    res.status(500).json({ error: "Failed to create daily target" });
  }
});

// Delete a daily target
router.delete("/daily-targets/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    await db
      .delete(targetSystemDailyTargets)
      .where(eq(targetSystemDailyTargets.id, parseInt(id)));

    res.json({ message: "Daily target deleted successfully" });
  } catch (error) {
    console.error("Error deleting daily target:", error);
    res.status(500).json({ error: "Failed to delete daily target" });
  }
});

// Update a daily target
router.put("/daily-targets/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { role, method, target } = req.body;
    
    if (!role || !method || target === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if updating to a duplicate (another row with same role/method)
    const existing = await db
      .select()
      .from(targetSystemDailyTargets)
      .where(and(
        eq(targetSystemDailyTargets.role, role), 
        eq(targetSystemDailyTargets.method, method)
      ));

    // Allow if the existing row is the one we are updating, but reject if it's a different row
    const isDuplicate = existing.some(e => e.id !== parseInt(id));
    if (isDuplicate) {
      return res.status(400).json({ error: "A target already exists for this Role and Contact Method." });
    }

    const [updatedTarget] = await db
      .update(targetSystemDailyTargets)
      .set({
        role,
        method,
        target: parseInt(target) || 0
      })
      .where(eq(targetSystemDailyTargets.id, parseInt(id)))
      .returning();

    res.json(updatedTarget);
  } catch (error) {
    console.error("Error updating daily target:", error);
    res.status(500).json({ error: "Failed to update daily target" });
  }
});

// Get all KWA records
router.get("/kwa-records", async (req, res) => {
  try {
    const records = await db
      .select()
      .from(targetSystemKwaRecords)
      .orderBy(desc(targetSystemKwaRecords.createdAt));
    res.json(records);
  } catch (error) {
    console.error("Error fetching KWA records:", error);
    res.status(500).json({ error: "Failed to fetch KWA records" });
  }
});

// Create a new KWA record
router.post("/kwa-records", async (req, res) => {
  try {
    const { company, employee, kwa, detail, type } = req.body;
    
    if (!company || !employee || !kwa || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [newRecord] = await db
      .insert(targetSystemKwaRecords)
      .values({
        company,
        employee,
        kwa: String(kwa),
        detail: detail || "",
        remaining: String(kwa), // Initially remaining is equal to total KWA
        type,
      })
      .returning();

    res.status(201).json(newRecord);
  } catch (error) {
    console.error("Error creating KWA record:", error);
    res.status(500).json({ error: "Failed to create KWA record" });
  }
});

// Get user targets
router.get("/user-targets", async (req, res) => {
  try {
    const targets = await db
      .select()
      .from(targetSystemUserTargets)
      .orderBy(desc(targetSystemUserTargets.createdAt));
    res.json(targets);
  } catch (error) {
    console.error("Error fetching user targets:", error);
    res.status(500).json({ error: "Failed to fetch user targets" });
  }
});

// Assign targets to all users in a specific role
router.post("/assign-role", async (req, res) => {
  try {
    const { role, targets } = req.body;
    
    if (!role) {
      return res.status(400).json({ error: "Role is required" });
    }
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: "No targets provided" });
    }

    // Get all users with the specified role
    const matchingUsers = await db
      .select()
      .from(users)
      .where(eq(users.role, role));

    if (matchingUsers.length === 0) {
      return res.status(404).json({ error: "No users found for the selected role" });
    }

    // Create assignments for every user
    const assignmentsToInsert = [];
    for (const user of matchingUsers) {
      for (const t of targets) {
        assignmentsToInsert.push({
          userId: user.fullName || user.username,
          targetName: t.targetName || t.name,
          category: t.category || "none",
          target: String(t.target || t.number || "0"),
          price: String(t.price || "0"),
          bonus: t.bonus || "",
          vas: String(t.vas || "0"),
          kwa: String(t.kwa || "0"),
          reward: String(t.reward || "0"),
          total: String(t.total || "0"),
          startDate: t.startDate ? new Date(t.startDate) : null,
          endDate: t.endDate ? new Date(t.endDate) : null,
          signDate: new Date()
        });
      }
    }

    const inserted = await db
      .insert(targetSystemUserTargets)
      .values(assignmentsToInsert)
      .returning();

    res.status(201).json({ message: "Targets assigned to role successfully", count: inserted.length });
  } catch (error) {
    console.error("Error assigning targets by role:", error);
    res.status(500).json({ error: "Failed to assign targets by role" });
  }
});

// Update multiple user targets dates (Assign Same Target)
router.put("/user-targets/bulk-dates", async (req, res) => {
  try {
    const { targetIds, startDate, endDate } = req.body;
    
    if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ error: "No targets provided to update" });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start date and end date are required" });
    }

    // Since SQLite/Postgres might not support bulk update of different rows easily,
    // and we are updating them all to the same startDate and endDate,
    // we can use an 'inArray' clause.
    const { inArray } = await import("drizzle-orm");

    await db
      .update(targetSystemUserTargets)
      .set({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
      .where(inArray(targetSystemUserTargets.id, targetIds));

    res.json({ message: "Targets updated successfully" });
  } catch (error) {
    console.error("Error bulk updating user target dates:", error);
    res.status(500).json({ error: "Failed to update user targets" });
  }
});

// Create multiple user targets (bulk assign)
router.post("/user-targets/bulk", async (req, res) => {
  try {
    const { targets } = req.body;
    
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: "No targets provided" });
    }

    const inserted = await db
      .insert(targetSystemUserTargets)
      .values(targets.map((t: any) => ({
        userId: t.userId,
        targetName: t.targetName,
        category: t.category || "none",
        target: String(t.target || "0"),
        price: String(t.price || "0"),
        bonus: t.bonus || "",
        vas: String(t.vas || "0"),
        kwa: String(t.kwa || "0"),
        reward: String(t.reward || "0"),
        total: String(t.total || "0"),
        startDate: t.startDate ? new Date(t.startDate) : null,
        endDate: t.endDate ? new Date(t.endDate) : null,
        signDate: t.signDate ? new Date(t.signDate) : null,
      })))
      .returning();

    res.status(201).json(inserted);
  } catch (error) {
    console.error("Error bulk creating user targets:", error);
    res.status(500).json({ error: "Failed to bulk create user targets" });
  }
});

// Delete a user target
router.delete("/user-targets/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    await db
      .delete(targetSystemUserTargets)
      .where(eq(targetSystemUserTargets.id, parseInt(id)));

    res.json({ message: "User target deleted successfully" });
  } catch (error) {
    console.error("Error deleting user target:", error);
    res.status(500).json({ error: "Failed to delete user target" });
  }
});

export default router;
