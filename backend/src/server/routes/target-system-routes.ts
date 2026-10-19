import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { targetSystemTargets, targetSystemDailyTargets, targetSystemKwaRecords, targetSystemKwaHistory, targetSystemUserTargets, users } from "../../shared/schema";
import { eq, desc, and, or, inArray, lte, gte, isNull, ilike } from "drizzle-orm";
import { requireRole } from "../middleware/auth.middleware";

const router = Router();

// Phase 3 — this module previously had no role gate at all (the global
// checkUrlPermission middleware only matches frontend menu paths like
// "target-system/create", not these API paths, so it silently no-op'd here).
// Restrict to the roles already documented for this module in
// ROUTE_PERMISSION_MATRIX.md.
router.use(requireRole("admin", "sales_manager", "hod", "super_hod", "account_manager"));

function sendValidationError(res: import("express").Response, error: unknown) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: error.errors });
  }
  throw error;
}

const numeric = z.union([z.string(), z.number()]);

export const createTargetSchema = z
  .object({
    targetName: z.string().trim().min(1, "targetName is required").max(200),
    category: z.string().trim().max(100).optional(),
    package: z.string().trim().max(200).optional(),
    reward: z.coerce.number().int().nonnegative().optional().default(0),
    bonus: z.string().trim().max(200).optional(),
    price: z.coerce.number().finite().nonnegative().optional().default(0),
    maxPrice: z.coerce.number().finite().nonnegative().optional().default(0),
    penalty: z.coerce.number().finite().nonnegative().optional().default(0),
    amount: z.string().trim().max(200).optional(),
    number: z.coerce.number().int().nonnegative().optional().default(0),
    kwa: z.coerce.number().int().nonnegative().optional().default(0),
    vas: z.coerce.number().int().nonnegative().optional().default(0),
    conversion: z.coerce.number().int().nonnegative().optional().default(0),
  })
  .strict();

export const dailyTargetSchema = z
  .object({
    role: z.string().trim().min(1, "role is required").max(100),
    method: z.string().trim().min(1, "method is required").max(100),
    target: z.coerce.number().int().nonnegative(),
  })
  .strict();

export const kwaRecordSchema = z
  .object({
    company: z.string().trim().min(1, "company is required").max(200),
    employee: z.string().trim().min(1, "employee is required").max(200),
    kwa: z.coerce.number().finite().nonnegative(),
    detail: z.string().trim().max(500).optional(),
    type: z.string().trim().min(1, "type is required").max(100),
    reward: z.coerce.number().finite().nonnegative().optional().default(0),
    status: z.string().trim().max(100).optional(),
    payDate: z.string().optional(),
  })
  .strict();

// MD-17: KWA becomes a real dual-stage ledger — "kwa" is the sold total, "remaining"
// is what hasn't been used yet; a Use/Refund action is the only transition event.
export const kwaUseSchema = z
  .object({
    amount: z.coerce.number().finite().positive("Amount must be greater than 0"),
    action: z.enum(["Used", "Refund"]).default("Used"),
    detail: z.string().trim().max(500).optional(),
    usedBy: z.string().trim().max(200).optional(),
  })
  .strict();

const targetItemSchema = z
  .object({
    targetName: z.string().trim().max(200).optional(),
    name: z.string().trim().max(200).optional(),
    category: z.string().trim().max(100).optional(),
    target: numeric.optional(),
    number: numeric.optional(),
    price: numeric.optional(),
    maxPrice: numeric.optional(),
    bonus: z.string().trim().max(200).optional(),
    vas: numeric.optional(),
    kwa: numeric.optional(),
    reward: numeric.optional(),
    conversion: numeric.optional(),
    total: numeric.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .strict();

export const assignRoleSchema = z
  .object({
    role: z.string().trim().min(1, "role is required").max(100),
    targets: z.array(targetItemSchema).min(1, "No targets provided"),
  })
  .strict();

const bulkDatesSchema = z
  .object({
    targetIds: z.array(z.coerce.number().int()).min(1, "No targets provided to update"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  })
  .strict();

const userTargetItemSchema = z
  .object({
    userId: z.string().trim().min(1, "userId is required").max(200),
    targetName: z.string().trim().min(1, "targetName is required").max(200),
    category: z.string().trim().max(100).optional(),
    target: numeric.optional(),
    price: numeric.optional(),
    maxPrice: numeric.optional(),
    bonus: z.string().trim().max(200).optional(),
    vas: numeric.optional(),
    kwa: numeric.optional(),
    reward: numeric.optional(),
    conversion: numeric.optional(),
    total: numeric.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    signDate: z.string().optional(),
  })
  .strict();

const bulkCreateSchema = z
  .object({
    targets: z.array(userTargetItemSchema).min(1, "No targets provided"),
  })
  .strict();

const userTargetUpdateSchema = z
  .object({
    targetName: z.string().trim().min(1).max(200).optional(),
    category: z.string().trim().max(100).optional(),
    target: numeric.optional(),
    price: numeric.optional(),
    maxPrice: numeric.optional(),
    bonus: z.string().trim().max(200).optional(),
    vas: numeric.optional(),
    kwa: numeric.optional(),
    reward: numeric.optional(),
    conversion: numeric.optional(),
    total: numeric.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    signDate: z.string().optional(),
  })
  .strict();

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
    const data = createTargetSchema.parse(req.body);

    const [target] = await db
      .insert(targetSystemTargets)
      .values({
        targetName: data.targetName,
        category: data.category,
        package: data.package,
        reward: data.reward,
        bonus: data.bonus,
        price: String(data.price),
        maxPrice: String(data.maxPrice),
        penalty: String(data.penalty),
        amount: data.amount,
        number: data.number,
        kwa: data.kwa,
        vas: data.vas,
        conversion: data.conversion,
      })
      .returning();

    res.status(201).json(target);
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
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
    const { role, method, target } = dailyTargetSchema.parse(req.body);

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
      .values({ role, method, target })
      .returning();

    res.status(201).json(newTarget);
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
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
    const { role, method, target } = dailyTargetSchema.parse(req.body);

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
      .set({ role, method, target })
      .where(eq(targetSystemDailyTargets.id, parseInt(id)))
      .returning();

    res.json(updatedTarget);
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
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
    const { company, employee, kwa, detail, type, reward, status, payDate } = kwaRecordSchema.parse(req.body);

    const [newRecord] = await db
      .insert(targetSystemKwaRecords)
      .values({
        company,
        employee,
        kwa: String(kwa),
        detail: detail || "",
        remaining: String(kwa), // Initially remaining is equal to total KWA
        type,
        reward: String(reward ?? 0),
        status: status || "Sell",
        payDate: payDate ? new Date(payDate) : null,
      })
      .returning();

    // Legacy also writes a webxl_kwa_history row the moment a KWA is sold —
    // the grant itself is transaction #1 in that KWA's history.
    await db.insert(targetSystemKwaHistory).values({
      kwaRecordId: newRecord.id,
      company,
      employee,
      amount: String(kwa),
      actionType: "Sell",
      detail: detail || "",
      payDate: payDate ? new Date(payDate) : new Date(),
    });

    res.status(201).json(newRecord);
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
    console.error("Error creating KWA record:", error);
    res.status(500).json({ error: "Failed to create KWA record" });
  }
});

// Use (or refund) part of a KWA record's remaining balance
router.patch("/kwa-records/:id/use", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, action, detail, usedBy } = kwaUseSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(targetSystemKwaRecords)
      .where(eq(targetSystemKwaRecords.id, parseInt(id)));
    if (!existing) return res.status(404).json({ error: "KWA record not found" });

    const remaining = Number(existing.remaining);
    const total = Number(existing.kwa);
    const newRemaining = action === "Refund" ? remaining + amount : remaining - amount;

    if (newRemaining < 0) {
      return res.status(400).json({ error: `Only ${remaining} KWA remaining — cannot use ${amount}` });
    }
    if (newRemaining > total) {
      return res.status(400).json({ error: `Cannot refund more than the total ${total} KWA` });
    }

    const logLine = `${action} ${amount}${detail ? `: ${detail}` : ""}`;
    const newDetail = existing.detail ? `${existing.detail}\n${logLine}` : logLine;

    const updates: Record<string, unknown> = { remaining: String(newRemaining), detail: newDetail };
    if (usedBy) updates.usedBy = usedBy;

    const [updated] = await db
      .update(targetSystemKwaRecords)
      .set(updates)
      .where(eq(targetSystemKwaRecords.id, parseInt(id)))
      .returning();

    // Record this specific transaction in the ledger — the balance-only update
    // above can't answer "what happened over time" once overwritten.
    await db.insert(targetSystemKwaHistory).values({
      kwaRecordId: existing.id,
      company: existing.company,
      employee: usedBy || existing.employee,
      amount: String(amount),
      actionType: action,
      detail: detail || "",
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
    console.error("Error using KWA record:", error);
    res.status(500).json({ error: "Failed to use KWA record" });
  }
});

// GET /kwa-history — the KWA History page's data source: the transaction
// ledger, joined with each record's CURRENT balance (legacy's own equivalent
// query reused one arbitrary row's balance for every result row — a real bug,
// fixed here by joining the correct record per transaction).
// ?employee=<name>&startDate=&endDate= filters to one person's history in a
// date range (the page's main filtered table); called with no params it
// returns everything (the page's "View All Data" modal).
router.get("/kwa-history", async (req, res) => {
  try {
    const { employee, startDate, endDate } = req.query as Record<string, string | undefined>;
    const conditions = [];
    if (employee && employee.trim()) {
      conditions.push(ilike(targetSystemKwaHistory.employee, employee.trim()));
    }
    if (startDate) conditions.push(gte(targetSystemKwaHistory.payDate, new Date(startDate)));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(targetSystemKwaHistory.payDate, end));
    }

    const rows = await db
      .select({
        id: targetSystemKwaHistory.id,
        kwaRecordId: targetSystemKwaHistory.kwaRecordId,
        company: targetSystemKwaHistory.company,
        employee: targetSystemKwaHistory.employee,
        amount: targetSystemKwaHistory.amount,
        actionType: targetSystemKwaHistory.actionType,
        detail: targetSystemKwaHistory.detail,
        payDate: targetSystemKwaHistory.payDate,
        createdAt: targetSystemKwaHistory.createdAt,
        remaining: targetSystemKwaRecords.remaining,
        kwaType: targetSystemKwaRecords.type,
      })
      .from(targetSystemKwaHistory)
      .leftJoin(targetSystemKwaRecords, eq(targetSystemKwaHistory.kwaRecordId, targetSystemKwaRecords.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(targetSystemKwaHistory.payDate));

    res.json(rows);
  } catch (error) {
    console.error("Error fetching KWA history:", error);
    res.status(500).json({ error: "Failed to fetch KWA history" });
  }
});

// Get user targets. ?current=true restricts to targets whose start/end date
// window covers today — i.e. the quarter a manager most recently, manually set
// (MD-19: quarter-close regeneration is a manual re-set, not an auto-carried-forward value).
router.get("/user-targets", async (req, res) => {
  try {
    const onlyCurrent = req.query.current === "true";
    const now = new Date();
    const targets = onlyCurrent
      ? await db
          .select()
          .from(targetSystemUserTargets)
          .where(
            and(
              or(isNull(targetSystemUserTargets.startDate), lte(targetSystemUserTargets.startDate, now)),
              or(isNull(targetSystemUserTargets.endDate), gte(targetSystemUserTargets.endDate, now)),
            ),
          )
          .orderBy(desc(targetSystemUserTargets.createdAt))
      : await db
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
    const { role, targets } = assignRoleSchema.parse(req.body);

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
        const vas = Number(t.vas ?? 0);
        const kwa = Number(t.kwa ?? 0);
        const reward = Number(t.reward ?? 0);
        const conversion = Number(t.conversion ?? 0);
        assignmentsToInsert.push({
          // Real user id (uuid), NOT fullName/username — the latter can
          // never be joined back against any real id elsewhere (gm_entries
          // etc. all key by uuid). Confirmed live: this was the source of
          // several orphaned name-keyed rows already in the table.
          userId: user.id,
          targetName: t.targetName || t.name || "",
          category: t.category || "none",
          target: String(t.target ?? t.number ?? "0"),
          price: String(t.price ?? "0"),
          maxPrice: String(t.maxPrice ?? "0"),
          bonus: t.bonus || "",
          vas: String(vas),
          kwa: String(kwa),
          reward: String(reward),
          conversion: String(conversion),
          // Computed server-side (legacy's own $total = conversion+vas+kwa+reward),
          // not trusted from the client.
          total: String(conversion + vas + kwa + reward),
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
    if (error instanceof z.ZodError) return sendValidationError(res, error);
    console.error("Error assigning targets by role:", error);
    res.status(500).json({ error: "Failed to assign targets by role" });
  }
});

// Update multiple user targets dates (Assign Same Target)
router.put("/user-targets/bulk-dates", async (req, res) => {
  try {
    const { targetIds, startDate, endDate } = bulkDatesSchema.parse(req.body);

    await db
      .update(targetSystemUserTargets)
      .set({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
      .where(inArray(targetSystemUserTargets.id, targetIds));

    res.json({ message: "Targets updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
    console.error("Error bulk updating user target dates:", error);
    res.status(500).json({ error: "Failed to update user targets" });
  }
});

// Create multiple user targets (bulk assign)
router.post("/user-targets/bulk", async (req, res) => {
  try {
    const { targets } = bulkCreateSchema.parse(req.body);

    const inserted = await db
      .insert(targetSystemUserTargets)
      .values(targets.map((t) => {
        const vas = Number(t.vas ?? 0);
        const kwa = Number(t.kwa ?? 0);
        const reward = Number(t.reward ?? 0);
        const conversion = Number(t.conversion ?? 0);
        return {
          userId: t.userId,
          targetName: t.targetName,
          category: t.category || "none",
          target: String(t.target ?? "0"),
          price: String(t.price ?? "0"),
          maxPrice: String(t.maxPrice ?? "0"),
          bonus: t.bonus || "",
          vas: String(vas),
          kwa: String(kwa),
          reward: String(reward),
          conversion: String(conversion),
          // Computed server-side (legacy's own $total = conversion+vas+kwa+reward),
          // not trusted from the client.
          total: String(conversion + vas + kwa + reward),
          startDate: t.startDate ? new Date(t.startDate) : null,
          endDate: t.endDate ? new Date(t.endDate) : null,
          signDate: t.signDate ? new Date(t.signDate) : null,
        };
      }))
      .returning();

    res.status(201).json(inserted);
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
    console.error("Error bulk creating user targets:", error);
    res.status(500).json({ error: "Failed to bulk create user targets" });
  }
});

// Update a single user target (e.g. correcting a manually re-set quarterly target)
router.patch("/user-targets/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = userTargetUpdateSchema.parse(req.body);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const [existing] = await db
      .select()
      .from(targetSystemUserTargets)
      .where(eq(targetSystemUserTargets.id, parseInt(id)));
    if (!existing) return res.status(404).json({ error: "User target not found" });

    const updates: Record<string, unknown> = {};
    if (data.targetName !== undefined) updates.targetName = data.targetName;
    if (data.category !== undefined) updates.category = data.category;
    if (data.target !== undefined) updates.target = String(data.target);
    if (data.price !== undefined) updates.price = String(data.price);
    if (data.maxPrice !== undefined) updates.maxPrice = String(data.maxPrice);
    if (data.bonus !== undefined) updates.bonus = data.bonus;
    if (data.vas !== undefined) updates.vas = String(data.vas);
    if (data.kwa !== undefined) updates.kwa = String(data.kwa);
    if (data.reward !== undefined) updates.reward = String(data.reward);
    if (data.conversion !== undefined) updates.conversion = String(data.conversion);
    if (data.startDate !== undefined) updates.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updates.endDate = new Date(data.endDate);
    if (data.signDate !== undefined) updates.signDate = new Date(data.signDate);

    // Total is always recomputed from the final (existing + edited) values —
    // never trusted from the client, same as create. Otherwise editing just
    // conversion/vas/kwa/reward silently leaves Total stale (confirmed live).
    const finalVas = Number(data.vas ?? existing.vas);
    const finalKwa = Number(data.kwa ?? existing.kwa);
    const finalReward = Number(data.reward ?? existing.reward);
    const finalConversion = Number(data.conversion ?? existing.conversion);
    updates.total = String(finalConversion + finalVas + finalKwa + finalReward);

    const [updated] = await db
      .update(targetSystemUserTargets)
      .set(updates)
      .where(eq(targetSystemUserTargets.id, parseInt(id)))
      .returning();

    if (!updated) return res.status(404).json({ error: "User target not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
    console.error("Error updating user target:", error);
    res.status(500).json({ error: "Failed to update user target" });
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
