import { Router } from "express";
import { z } from "zod";
import { db, pool } from "../db";
import { targetSystemTargets, targetSystemDailyTargets, targetSystemKwaRecords, targetSystemKwaHistory, targetSystemUserTargets, users } from "../../shared/schema";
import { eq, desc, and, or, inArray, lte, gte, isNull, ilike, sql, getTableColumns } from "drizzle-orm";
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
    companyId: z.string().uuid().optional(),
    comId: z.string().trim().max(100).optional(),
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

// Update a target definition (Create Target page "Edit"). Partial: only the
// fields sent are changed. Existing per-user assignments keep their own
// snapshotted values (same as legacy, which only updated webxl_terget).
router.patch("/targets/:id", async (req, res) => {
  try {
    const data = createTargetSchema.partial().parse(req.body);
    const values: Record<string, unknown> = {};
    if (data.targetName !== undefined) values.targetName = data.targetName;
    if (data.category !== undefined) values.category = data.category || null;
    if (data.package !== undefined) values.package = data.package;
    if (data.reward !== undefined) values.reward = data.reward;
    if (data.bonus !== undefined) values.bonus = data.bonus;
    if (data.price !== undefined) values.price = String(data.price);
    if (data.maxPrice !== undefined) values.maxPrice = String(data.maxPrice);
    if (data.penalty !== undefined) values.penalty = String(data.penalty);
    if (data.amount !== undefined) values.amount = data.amount;
    if (data.number !== undefined) values.number = data.number;
    if (data.kwa !== undefined) values.kwa = data.kwa;
    if (data.vas !== undefined) values.vas = data.vas;
    if (data.conversion !== undefined) values.conversion = data.conversion;
    if (Object.keys(values).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const [target] = await db
      .update(targetSystemTargets)
      .set(values)
      .where(eq(targetSystemTargets.id, String(req.params.id)))
      .returning();
    if (!target) return res.status(404).json({ error: "Target not found" });
    res.json(target);
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
    console.error("Error updating target system target:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update target" });
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

// Get all KWA records (Com Id = legacy com_id / customer drm_id, not KWA row id).
router.get("/kwa-records", async (req, res) => {
  try {
    // (No per-request ALTER TABLE here any more: com_id/customer_id are created
    // by scripts/migration/ensure-target-system-schema.sql, and ALTER takes an
    // ACCESS EXCLUSIVE lock on every call even when the column already exists.)
    const { rows } = await pool.query(`
      SELECT
        k.id,
        k.company,
        k.employee,
        k.kwa,
        k.detail,
        k.remaining,
        k.type,
        k.used_by AS "usedBy",
        k.reward,
        k.status,
        k.pay_date AS "payDate",
        k.created_at AS "createdAt",
        k.customer_id AS "customerId",
        COALESCE(NULLIF(btrim(k.com_id), ''), c_ref.drm_id, c_name.drm_id, '') AS "comId"
      FROM drm.target_system_kwa_records k
      LEFT JOIN drm.customers c_ref ON c_ref.id = k.customer_id
      -- Name-match fallback only for rows with no customer link and no com_id.
      -- The guard must sit INSIDE the subquery: as a join ON-condition Postgres
      -- still ran the lookup for every row (218 x ~250 ms seq scans = 54 s).
      -- Uses idx_customers_company_name_lower_trim when it does run.
      LEFT JOIN LATERAL (
        SELECT drm_id FROM drm.customers
        WHERE k.customer_id IS NULL
          AND NULLIF(btrim(k.com_id), '') IS NULL
          AND lower(trim(company_name)) = lower(trim(k.company))
        LIMIT 1
      ) c_name ON true
      ORDER BY k.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching KWA records:", error);
    res.status(500).json({ error: "Failed to fetch KWA records" });
  }
});

// GET /kwa-usage?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD — BV report "KWA" table, as old
// func.php built it: webxl_kwa_history rows with DATE(pay_date) in the range (newest first),
// each joined to its KWA. Reward = tier of the KWA amount, halved for "Used" rows.
router.get("/kwa-usage", async (req, res) => {
  try {
    const startDate = String(req.query.startDate ?? "");
    const endDate = String(req.query.endDate ?? "");
    const isDate = (v: string) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v);
    if (!isDate(startDate) || !isDate(endDate)) {
      return res.status(400).json({ error: "startDate and endDate (YYYY-MM-DD) are required" });
    }
    const { rows } = await pool.query(
      `SELECT h.id, r.company, r.employee AS "sellBy", h.employee AS "usedBy", r.kwa, r.type, r.detail,
              r.remaining, h.amount AS used, h.action_type AS status, r.created_at AS "createdAt", h.pay_date AS "payDate",
              (CASE WHEN r.kwa <= 200 THEN 2400 WHEN r.kwa <= 500 THEN 6000 WHEN r.kwa <= 1000 THEN 12000
                    WHEN r.kwa <= 1500 THEN 18000 WHEN r.kwa <= 2000 THEN 24000 ELSE 0 END)
                / (CASE WHEN h.action_type = 'Used' THEN 2 ELSE 1 END) AS reward
         FROM drm.target_system_kwa_history h
         JOIN drm.target_system_kwa_records r ON r.id = h.kwa_record_id
        WHERE h.pay_date::date BETWEEN $1::date AND $2::date
        ORDER BY h.id DESC`,
      [startDate, endDate],
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching KWA usage:", error);
    res.status(500).json({ error: "Failed to fetch KWA usage" });
  }
});

// Create a new KWA record
router.post("/kwa-records", async (req, res) => {
  try {
    const { company, companyId, comId, employee, kwa, detail, type, reward, status, payDate } =
      kwaRecordSchema.parse(req.body);

    let resolvedCustomerId: string | null = companyId ?? null;
    let resolvedComId: string | null = comId?.trim() || null;
    if (resolvedCustomerId) {
      const cust = await pool.query(
        `SELECT id, drm_id FROM drm.customers WHERE id = $1 LIMIT 1`,
        [resolvedCustomerId],
      );
      if (cust.rows[0]) {
        resolvedComId = resolvedComId || cust.rows[0].drm_id || null;
      } else {
        resolvedCustomerId = null;
      }
    }
    if (!resolvedComId) {
      const byName = await pool.query(
        `SELECT id, drm_id FROM drm.customers WHERE lower(trim(company_name)) = lower(trim($1)) LIMIT 1`,
        [company],
      );
      if (byName.rows[0]) {
        resolvedCustomerId = resolvedCustomerId || byName.rows[0].id;
        resolvedComId = byName.rows[0].drm_id || null;
      }
    }

    const [newRecord] = await db
      .insert(targetSystemKwaRecords)
      .values({
        company,
        customerId: resolvedCustomerId,
        comId: resolvedComId,
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
    // userName: the assigned user's name (legacy target-set shows it above the
    // target name). user_id is text, users.id is uuid -> compare as text.
    const columns = { ...getTableColumns(targetSystemUserTargets), userName: users.name };
    const userJoin = sql`${users.id}::text = ${targetSystemUserTargets.userId}`;
    const targets = onlyCurrent
      ? await db
          .select(columns)
          .from(targetSystemUserTargets)
          .leftJoin(users, userJoin)
          .where(
            and(
              or(isNull(targetSystemUserTargets.startDate), lte(targetSystemUserTargets.startDate, now)),
              or(isNull(targetSystemUserTargets.endDate), gte(targetSystemUserTargets.endDate, now)),
            ),
          )
          .orderBy(desc(targetSystemUserTargets.createdAt), desc(targetSystemUserTargets.id))
      : await db
          .select(columns)
          .from(targetSystemUserTargets)
          .leftJoin(users, userJoin)
          .orderBy(desc(targetSystemUserTargets.createdAt), desc(targetSystemUserTargets.id));
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
// Old-DRM assignment history (read-only) for View Target's "All History".
// Legacy target-view listed ALL of a user's webxl_setterget rows (func.php
// user_id_terget_view: "WHERE user_id = ... ORDER BY id DESC"); only the
// current ones were copied into target_system_user_targets, so the rest is
// read straight from legacy_archive. Rows already copied are excluded.
const LEGACY_TARGET_CATEGORY: Record<string, string> = {
  "1": "AB New Terget", "2": "Renewal Terget", "3": "VAS", "4": "Other",
  "5": "Team", "6": "Project Target", "7": "PP Link",
};

async function legacyTargetHistory(userIds: string[]): Promise<any[]> {
  if (userIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT mu.modern_id AS user_id, s.id, s.target_num, s.terget_cat, s.start_date, s.end_date,
            s."singDate" AS sign_date,
            t.terget_name, t.bonus, t.price, t.max_amount, t.conversion, t.vas, t.kwa, t.reward
     FROM migration_meta.migration_legacy_ids mu
     JOIN legacy_archive.webxl_setterget s ON s.user_id = mu.legacy_id
     LEFT JOIN legacy_archive.webxl_terget t ON t.terget_id = s.terget_id
     WHERE mu.entity_type = 'user' AND mu.legacy_table = 'webxl_user' AND mu.modern_id = ANY($1::text[])
       AND NOT EXISTS (
         SELECT 1 FROM migration_meta.migration_legacy_ids x
         JOIN drm.target_system_user_targets ut ON ut.id::text = x.modern_id
         WHERE x.entity_type = 'target_system_user_target' AND x.legacy_table = 'webxl_setterget'
           AND x.legacy_id = s.id
       )
     ORDER BY s.id::int DESC`,
    [userIds],
  );
  const num = (v: unknown) => {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  };
  const dateOrNull = (v: unknown) => {
    const t = String(v ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}/.test(t) && !t.startsWith("0000") ? t.replace(" ", "T") : null;
  };
  return rows.map((r) => {
    const conversion = num(r.conversion), vas = num(r.vas), kwa = num(r.kwa), reward = num(r.reward);
    return {
      id: `legacy-${r.id}`,
      userId: r.user_id,
      targetName: r.terget_name || "(deleted target)",
      category: LEGACY_TARGET_CATEGORY[String(r.terget_cat)] ?? "Other",
      target: String(r.target_num ?? "0") || "0",
      price: num(r.price),
      maxPrice: num(r.max_amount),
      bonus: String(r.bonus).trim() === "1" ? "Percentage %" : "Amount",
      conversion, vas, kwa, reward,
      total: conversion + vas + kwa + reward,
      startDate: dateOrNull(r.start_date),
      endDate: dateOrNull(r.end_date),
      signDate: dateOrNull(r.sign_date),
      isLegacy: true,
    };
  });
}

router.get("/user-targets/legacy-history", async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "").trim();
    if (!userId) return res.status(400).json({ error: "userId is required" });
    res.json(await legacyTargetHistory([userId]));
  } catch (error) {
    console.error("Error fetching legacy user target history:", error);
    res.status(500).json({ error: "Failed to fetch legacy target history" });
  }
});

// "Team Target" for View Target — legacy func.php user_id_terget_view: after
// the user's own targets, one "Team Terget" table per direct report
// (webxl_user.underWork = the viewed user), each with that member's targets.
// Team = legacy underWork (mapped to new user ids) UNION drm.users.under_works.
// ?all=true -> every assignment (+ old-DRM history); otherwise current quarter.
router.get("/user-targets/team", async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "").trim();
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const all = req.query.all === "true";

    const { rows: members } = await pool.query(
      `WITH me AS (
         SELECT legacy_id FROM migration_meta.migration_legacy_ids
         WHERE entity_type = 'user' AND legacy_table = 'webxl_user' AND modern_id = $1
       ),
       team AS (
         SELECT m.modern_id AS id
         FROM legacy_archive.webxl_user lu
         JOIN me ON lu."underWork" = me.legacy_id
         JOIN migration_meta.migration_legacy_ids m
           ON m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.legacy_id = lu.user_id
         UNION
         SELECT u.id::text FROM drm.users u WHERE u.under_works = $1
       )
       SELECT u.id::text AS id, COALESCE(u.name, u.full_name, u.email) AS name
       FROM team JOIN drm.users u ON u.id::text = team.id
       WHERE u.id::text <> $1
       ORDER BY 2`,
      [userId],
    );
    const memberIds = members.map((m) => m.id as string);
    if (memberIds.length === 0) return res.json([]);

    const now = new Date();
    const conditions = [inArray(targetSystemUserTargets.userId, memberIds)];
    if (!all) {
      conditions.push(
        or(isNull(targetSystemUserTargets.startDate), lte(targetSystemUserTargets.startDate, now))!,
        or(isNull(targetSystemUserTargets.endDate), gte(targetSystemUserTargets.endDate, now))!,
      );
    }
    const current = await db
      .select()
      .from(targetSystemUserTargets)
      .where(and(...conditions))
      .orderBy(desc(targetSystemUserTargets.createdAt), desc(targetSystemUserTargets.id));
    const history = all ? await legacyTargetHistory(memberIds) : [];

    // Same shape as legacy: only members that actually have targets get a section.
    const sections = members
      .map((m) => ({
        userId: m.id,
        userName: m.name,
        targets: [
          ...current.filter((t) => t.userId === m.id).map((t) => ({ ...t, isLegacy: false })),
          ...history.filter((t) => t.userId === m.id),
        ],
      }))
      .filter((sec) => sec.targets.length > 0);
    res.json(sections);
  } catch (error) {
    console.error("Error fetching team targets:", error);
    res.status(500).json({ error: "Failed to fetch team targets" });
  }
});

// "Assign Same Target" — legacy func.php (start_date_same_target): take every
// assignment that ran inside the PREVIOUS calendar quarter and INSERT a copy
// for the new start/end dates (quarter rollover). Existing rows are never
// modified, unlike PUT /user-targets/bulk-dates which overwrites dates.
const copyLastQuarterSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
  })
  .strict();

function lastQuarterRange(today: Date): { start: string; end: string } {
  const q = Math.floor(today.getMonth() / 3); // 0..3, current quarter
  const year = q === 0 ? today.getFullYear() - 1 : today.getFullYear();
  const lq = q === 0 ? 3 : q - 1;
  const startMonth = lq * 3; // 0-based
  const lastDay = new Date(year, startMonth + 3, 0).getDate();
  const mm = (m: number) => String(m + 1).padStart(2, "0");
  return {
    start: `${year}-${mm(startMonth)}-01`,
    end: `${year}-${mm(startMonth + 2)}-${String(lastDay).padStart(2, "0")}`,
  };
}

router.post("/user-targets/copy-last-quarter", async (req, res) => {
  try {
    const { startDate, endDate } = copyLastQuarterSchema.parse(req.body);
    if (startDate > endDate) return res.status(400).json({ error: "startDate must be before endDate" });
    const range = lastQuarterRange(new Date());
    const { rowCount } = await pool.query(
      `INSERT INTO drm.target_system_user_targets
         (user_id, target_name, category, target, price, max_price, bonus, vas, kwa, reward,
          conversion, total, start_date, end_date, sign_date, created_at)
       SELECT user_id, target_name, category, target, price, max_price, bonus, vas, kwa, reward,
              conversion, total, $3::timestamp, $4::timestamp, now()::timestamp(0), now()
       FROM drm.target_system_user_targets
       WHERE start_date >= $1::timestamp AND end_date <= $2::timestamp
       ORDER BY id`,
      [range.start, range.end, startDate, endDate],
    );
    res.json({ copied: rowCount ?? 0, from: range });
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
    console.error("Error copying last quarter user targets:", error);
    res.status(500).json({ error: "Failed to assign same targets" });
  }
});

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
