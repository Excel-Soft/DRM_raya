// GM/BV commission verification — backs the "Reports" group's BV Report
// (?scope=company) Total row "Final Com / Verify" panel, ported from
// func (1).php's BV commission workflow (there backed by webxl_vas_comm_final,
// a table declared in shared/schema.ts but never created live, keyed by a
// bare legacy integer user_id with no mapping to any real user). This uses a
// fresh table (gm_bv_commission_verifications, real uuid user_id) instead of
// repairing that unrelated, not-yet-live VAS table.
//
// One row per (user, month, year). A privileged role (HOD/Account/Admin)
// creates the row with the already-computed totals — that act IS the HOD
// approval in this scope, there is no separate HOD-dashboard step here — and
// the salesperson it belongs to then confirms it.
import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { gmBvCommissionVerifications, targetSystemUserTargets, users } from "../../shared/schema";
import { and, eq, or, isNull, lte, gte } from "drizzle-orm";
import { normalizeRole } from "../utils/role-utils";

const router = Router();

const PRIVILEGED_ROLES = ["admin", "super_admin", "super_hod", "hod", "account_manager"];

function isPrivileged(roleId: string | undefined): boolean {
  if (!roleId) return false;
  return PRIVILEGED_ROLES.includes(normalizeRole(roleId));
}

router.get("/", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!userId || !Number.isInteger(month) || !Number.isInteger(year)) {
      return res.status(400).json({ error: "userId, month, and year are required" });
    }

    // Row-scope: a non-privileged caller may only ever look up their own record.
    const actingRole = (req.user as any)?.activeRoleId || (req.user as any)?.roleId;
    if (!isPrivileged(actingRole) && req.user.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to view this user's commission record" });
    }

    const [record] = await db
      .select()
      .from(gmBvCommissionVerifications)
      .where(
        and(
          eq(gmBvCommissionVerifications.userId, userId),
          eq(gmBvCommissionVerifications.commMonth, month),
          eq(gmBvCommissionVerifications.commYear, year),
        ),
      );
    return res.json({ record: record ?? null });
  } catch (error) {
    console.error("Error fetching BV commission verification:", error);
    return res.status(500).json({ error: "Failed to fetch commission verification" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const actingRole = (req.user as any)?.activeRoleId || (req.user as any)?.roleId;
    if (!isPrivileged(actingRole)) {
      return res.status(403).json({ error: "Only HOD/Account/Admin roles can create a commission verification" });
    }

    const { userId, month, year, totalComm, totalReward, abReward, rewardComment } = req.body ?? {};
    if (!userId || !Number.isInteger(month) || !Number.isInteger(year)) {
      return res.status(400).json({ error: "userId, month, and year are required" });
    }

    const [targetUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    // Business rule (func.php's own structure): commission is only ever
    // computed for a sale that falls under an assigned target — a
    // salesperson with no target at all shouldn't have a commission
    // verified for them. Mirrors the frontend's Verify-button gating, but
    // enforced here too since this endpoint can be called directly.
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    const [matchingTarget] = await db
      .select({ id: targetSystemUserTargets.id })
      .from(targetSystemUserTargets)
      .where(
        and(
          eq(targetSystemUserTargets.userId, userId),
          or(isNull(targetSystemUserTargets.startDate), lte(targetSystemUserTargets.startDate, monthEnd)),
          or(isNull(targetSystemUserTargets.endDate), gte(targetSystemUserTargets.endDate, monthStart)),
        ),
      );
    if (!matchingTarget) {
      return res.status(400).json({ error: "This salesperson has no target assigned for this period — assign one in Set Target first." });
    }

    const [existing] = await db
      .select()
      .from(gmBvCommissionVerifications)
      .where(
        and(
          eq(gmBvCommissionVerifications.userId, userId),
          eq(gmBvCommissionVerifications.commMonth, month),
          eq(gmBvCommissionVerifications.commYear, year),
        ),
      );
    if (existing) return res.status(409).json({ error: "A commission record for this user/month already exists", record: existing });

    const abRewardNum = typeof abReward === "number" ? abReward : null;
    const totalCommNum = Number(totalComm) || 0;
    const totalRewardNum = Number(totalReward) || 0;
    const [created] = await db
      .insert(gmBvCommissionVerifications)
      .values({
        userId,
        commMonth: month,
        commYear: year,
        totalComm: String(totalCommNum),
        totalReward: String(totalRewardNum),
        abReward: abRewardNum != null ? String(abRewardNum) : null,
        rewardComment: typeof rewardComment === "string" ? rewardComment : null,
        hodStatus: "Approved",
        userStatus: "Pending",
        accountPayStatus: "Pending",
        // Comm + the real per-sale reward + the manually-entered AB bonus —
        // was previously missing totalReward (confirmed from the live BV
        // report's own "Final Com" preview not matching what the HOD typed).
        finalPayAmount: String(totalCommNum + totalRewardNum + (abRewardNum ?? 0)),
        createdBy: req.user.userId,
      })
      .returning();
    return res.status(201).json({ record: created });
  } catch (error) {
    console.error("Error creating BV commission verification:", error);
    return res.status(500).json({ error: "Failed to create commission verification" });
  }
});

router.post("/:id/confirm", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const [record] = await db
      .select()
      .from(gmBvCommissionVerifications)
      .where(eq(gmBvCommissionVerifications.id, req.params.id));
    if (!record) return res.status(404).json({ error: "Not found" });

    // Only the salesperson this record belongs to may confirm it.
    if (record.userId !== req.user.userId) {
      return res.status(403).json({ error: "Only the salesperson this record belongs to can confirm it" });
    }
    if (record.userStatus === "Verified") {
      return res.json({ record });
    }

    const [updated] = await db
      .update(gmBvCommissionVerifications)
      .set({ userStatus: "Verified", updatedAt: new Date() })
      .where(eq(gmBvCommissionVerifications.id, req.params.id))
      .returning();
    return res.json({ record: updated });
  } catch (error) {
    console.error("Error confirming BV commission verification:", error);
    return res.status(500).json({ error: "Failed to confirm commission verification" });
  }
});

export default router;
