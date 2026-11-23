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
//
// Status flow shown on the BV report footer:
//   created here            -> hod_status 'Approved', user_status 'Pending'
//                              ("Verified by HOD — pending acknowledgement")
//   POST /:id/confirm       -> user_status 'Confirmed' ("Acknowledged"; rows
//                              confirmed before this change say 'Verified')
//   POST /:id/pay (Account) -> account_pay_status 'Paid' + final_pay_amount
// The salesperson gets an app-wide popup from GET /pending-mine.
import { Router, type Request, type Response } from "express";
import { db, pool } from "../db";
import { gmBvCommissionVerifications, targetSystemUserTargets, users } from "../../shared/schema";
import { and, desc, eq, or, isNull, lte, gte } from "drizzle-orm";
import { normalizeRole } from "../utils/role-utils";
import { NotificationService } from "../services/notification-service";

const router = Router();

const PRIVILEGED_ROLES = ["admin", "super_admin", "super_hod", "hod", "account_manager"];
// Who may mark a confirmed commission as paid.
const PAY_ROLES = ["admin", "super_admin", "account_manager"];
const ACKNOWLEDGED_STATUSES = ["Confirmed", "Verified"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function isPrivileged(roleId: string | undefined): boolean {
  if (!roleId) return false;
  return PRIVILEGED_ROLES.includes(normalizeRole(roleId));
}

function actingRoleOf(req: Request): string | undefined {
  return (req.user as any)?.activeRoleId || (req.user as any)?.roleId;
}

async function notifySafe(input: Parameters<typeof NotificationService.notify>[0]) {
  try {
    await NotificationService.notify(input);
  } catch (err) {
    console.error("[bv-commission] notification failed (ignored):", err);
  }
}

// Old-DRM salespeople have their targets in legacy_archive.webxl_setterget
// (the BV report computes their commission from it), not in
// target_system_user_targets — accept either as "has a target".
async function hasLegacyTarget(userId: string, monthStartYmd: string, monthEndYmd: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1
       FROM migration_meta.migration_legacy_ids m
       JOIN legacy_archive.webxl_setterget st ON st.user_id = m.legacy_id
      WHERE m.modern_table = 'users' AND m.legacy_table = 'webxl_user' AND m.modern_id = $1
        AND rtrim(st.terget_cat) = '1' AND st.start_date <= $3 AND st.end_date >= $2
      LIMIT 1`,
    [userId, monthStartYmd, monthEndYmd],
  );
  return rows.length > 0;
}

// Salesperson's own records still waiting for acknowledgement (app-wide popup).
router.get("/pending-mine", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const records = await db
      .select()
      .from(gmBvCommissionVerifications)
      .where(
        and(
          eq(gmBvCommissionVerifications.userId, req.user.userId),
          eq(gmBvCommissionVerifications.hodStatus, "Approved"),
          eq(gmBvCommissionVerifications.userStatus, "Pending"),
        ),
      )
      .orderBy(desc(gmBvCommissionVerifications.createdAt));
    return res.json({ records });
  } catch (error) {
    console.error("Error fetching pending BV commission verifications:", error);
    return res.status(500).json({ error: "Failed to fetch pending commission verifications" });
  }
});

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
    // Old DRM: a webxl_vas_comm_final row (comm_type Ab / Service) for that month means the
    // commission was already created there -> show its status instead of Verify.
    const legacy = await pool.query(
      `SELECT f.id, f.comm_type, f.final_pay_amount, f.reward, f.hod_status, f.user_status,
              f.account_pay_status, a.rewardcomment
         FROM migration_meta.migration_legacy_ids m
         JOIN drm.webxl_vas_comm_final f ON f.user_id::text = m.legacy_id
         LEFT JOIN legacy_archive.webxl_vas_comm_final a
                ON a._source_table = 'webxl_vas_comm_final' AND a._legacy_pk = f.id::text
        WHERE m.legacy_table = 'webxl_user' AND m.modern_table = 'users' AND m.modern_id = $1
          AND f.comm_type IN ('Ab', 'Service') AND btrim(f.comm_month) = $2 AND btrim(f.comm_year) = $3
        ORDER BY f.id DESC`,
      [userId, String(month), String(year)],
    );
    const toRec = (r: any) => r && {
      id: `legacy-${r.id}`, legacy: true, commType: r.comm_type,
      finalPayAmount: r.final_pay_amount, abReward: r.reward,
      rewardComment: r.rewardcomment ? String(r.rewardcomment).trim() || null : null,
      hodStatus: r.hod_status, userStatus: r.user_status, accountPayStatus: r.account_pay_status,
    };
    const legacyAb = toRec(legacy.rows.find((r: any) => r.comm_type === "Ab"));
    const legacyService = toRec(legacy.rows.find((r: any) => r.comm_type === "Service"));
    return res.json({ record: record ?? legacyAb ?? null, legacyService: legacyService ?? null });
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
    const pad = (n: number) => String(n).padStart(2, "0");
    const legacyTarget = matchingTarget
      ? true
      : await hasLegacyTarget(userId, `${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(monthEnd.getDate())}`);
    if (!matchingTarget && !legacyTarget) {
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
    await notifySafe({
      userId,
      message: `Your BV commission for ${MONTH_NAMES[month - 1] ?? month} ${year} was verified (Final: ${Number(created.finalPayAmount ?? 0).toLocaleString()}). Please acknowledge it.`,
      type: "INFO",
      targetUrl: "/reports/bv?scope=company",
      module: "reports",
      entityType: "gm_bv_commission_verification",
      entityId: created.id,
    });
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
    if (ACKNOWLEDGED_STATUSES.includes(record.userStatus)) {
      return res.json({ record });
    }

    const [updated] = await db
      .update(gmBvCommissionVerifications)
      .set({ userStatus: "Confirmed", updatedAt: new Date() })
      .where(eq(gmBvCommissionVerifications.id, req.params.id))
      .returning();
    await notifySafe({
      userId: record.createdBy,
      message: `BV commission for ${MONTH_NAMES[record.commMonth - 1] ?? record.commMonth} ${record.commYear} was acknowledged by the salesperson and is ready for payment.`,
      type: "INFO",
      targetUrl: "/reports/bv?scope=company",
      module: "reports",
      entityType: "gm_bv_commission_verification",
      entityId: record.id,
    });
    return res.json({ record: updated });
  } catch (error) {
    console.error("Error confirming BV commission verification:", error);
    return res.status(500).json({ error: "Failed to confirm commission verification" });
  }
});

// Account marks an acknowledged commission as paid.
router.post("/:id/pay", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const role = actingRoleOf(req);
    if (!role || !PAY_ROLES.includes(normalizeRole(role))) {
      return res.status(403).json({ error: "Only Account/Admin can mark a commission as paid" });
    }
    const [record] = await db
      .select()
      .from(gmBvCommissionVerifications)
      .where(eq(gmBvCommissionVerifications.id, req.params.id));
    if (!record) return res.status(404).json({ error: "Not found" });
    if (!ACKNOWLEDGED_STATUSES.includes(record.userStatus)) {
      return res.status(400).json({ error: "The salesperson has not acknowledged this commission yet" });
    }
    if (record.accountPayStatus === "Paid") return res.json({ record });

    const raw = req.body?.finalPayAmount;
    let amount = Number(record.finalPayAmount ?? 0);
    if (raw !== undefined && raw !== null && raw !== "") {
      amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ error: "finalPayAmount must be a number of 0 or more" });
      }
    }
    const [updated] = await db
      .update(gmBvCommissionVerifications)
      .set({ accountPayStatus: "Paid", finalPayAmount: String(amount), updatedAt: new Date() })
      .where(eq(gmBvCommissionVerifications.id, req.params.id))
      .returning();
    await notifySafe({
      userId: record.userId,
      message: `Your BV commission for ${MONTH_NAMES[record.commMonth - 1] ?? record.commMonth} ${record.commYear} has been paid (${amount.toLocaleString()}).`,
      type: "SUCCESS",
      targetUrl: "/reports/bv?scope=company",
      module: "reports",
      entityType: "gm_bv_commission_verification",
      entityId: record.id,
    });
    return res.json({ record: updated });
  } catch (error) {
    console.error("Error paying BV commission verification:", error);
    return res.status(500).json({ error: "Failed to mark commission as paid" });
  }
});

export default router;
