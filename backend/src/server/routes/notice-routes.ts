import { Router } from "express";
import { z } from "zod";
import { db, pool } from "../db";
import { notices, insertNoticeSchema, noticeAssignments } from "@shared/schema";
import { eq } from "drizzle-orm";
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

function rejectLegacyNoticeId(id: string, res: import("express").Response): boolean {
  if (id.startsWith("legacy-notice-")) {
    res.status(400).json({ error: "Legacy notices are read-only" });
    return true;
  }
  return false;
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

function mapNoticeListRow(r: {
  id: string;
  title: string;
  description: string;
  status: string;
  assigned_by_user_id?: string | null;
  assigned_to_role?: string | null;
  assigned_to_department?: string | null;
  assigned_date: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  assigned_by_name?: string | null;
  assigned_user_names?: string | null;
  legacy_read_only?: boolean;
}) {
  const assigneeLabel =
    (r.assigned_user_names && String(r.assigned_user_names).trim()) ||
    (r.assigned_to_role && String(r.assigned_to_role).trim()) ||
    (r.assigned_to_department && String(r.assigned_to_department).trim()) ||
    "All Staff";
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    assignedByUserId: r.assigned_by_user_id ?? null,
    assignedToRole: r.assigned_to_role ?? null,
    assignedToDepartment: r.assigned_to_department ?? null,
    assignedDate: r.assigned_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    assignedBy: r.assigned_by_name ? { name: r.assigned_by_name } : undefined,
    assigneeLabel,
    assignedUserNames: r.assigned_user_names ?? null,
    legacyReadOnly: Boolean(r.legacy_read_only),
  };
}

// Get all notices (modern + legacy archive)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { rows: modernRows } = await pool.query(`
      SELECT
        n.id::text AS id,
        n.title,
        n.description,
        n.status::text AS status,
        n.assigned_by_user_id::text AS assigned_by_user_id,
        n.assigned_to_role,
        n.assigned_to_department,
        n.assigned_date,
        n.created_at,
        n.updated_at,
        ub.name AS assigned_by_name,
        false AS legacy_read_only,
        string_agg(DISTINCT coalesce(au.full_name, au.name), ', ')
          FILTER (WHERE au.id IS NOT NULL) AS assigned_user_names
      FROM drm.notices n
      LEFT JOIN drm.users ub ON ub.id = n.assigned_by_user_id
      LEFT JOIN drm.notice_assignments na ON na.notice_id = n.id
      LEFT JOIN drm.users au ON au.id = na.user_id
      GROUP BY n.id, ub.name
      ORDER BY n.created_at DESC
    `);

    const { rows: legacyRows } = await pool.query(`
      WITH notice_rows AS (
        SELECT
          nb._legacy_pk,
          trim(nb.heading) AS title,
          trim(nb.detail) AS description,
          COALESCE(NULLIF(trim(nb.create_date), '')::timestamptz, now()) AS assigned_date,
          COALESCE(NULLIF(trim(nb.create_date), '')::timestamptz, now()) AS created_at
        FROM legacy_archive.webxl_notice_board nb
      ),
      assignees AS (
        SELECT
          trim(an.notice_id) AS notice_legacy_pk,
          string_agg(
            DISTINCT coalesce(u.full_name, u.name, 'Staff #' || trim(an.user_id)),
            ', '
          ) AS assigned_user_names
        FROM legacy_archive.webxl_assign_notice an
        LEFT JOIN migration_meta.migration_legacy_ids m
          ON m.legacy_table = 'webxl_user' AND m.legacy_id = trim(an.user_id)
        LEFT JOIN drm.users u ON u.id = m.modern_id::uuid
        GROUP BY trim(an.notice_id)
      )
      SELECT
        ('legacy-notice-' || nr._legacy_pk) AS id,
        nr.title,
        nr.description,
        'Active' AS status,
        nr.assigned_date,
        nr.created_at,
        nr.assigned_date AS updated_at,
        NULL::text AS assigned_by_user_id,
        NULL::text AS assigned_to_role,
        NULL::text AS assigned_to_department,
        NULL::text AS assigned_by_name,
        true AS legacy_read_only,
        a.assigned_user_names
      FROM notice_rows nr
      LEFT JOIN assignees a ON a.notice_legacy_pk = trim(nr._legacy_pk::text)
      ORDER BY nr.created_at DESC
    `);

    const combined = [...modernRows.map(mapNoticeListRow), ...legacyRows.map(mapNoticeListRow)];
    combined.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    res.json(combined);
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
    if (rejectLegacyNoticeId(id, res)) return;
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
    if (rejectLegacyNoticeId(id, res)) return;
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
    if (rejectLegacyNoticeId(noticeId, res)) return;
    const assignedByUserId = (req.user as any).userId;

    if (userId === "all") {
      await db.delete(noticeAssignments).where(eq(noticeAssignments.noticeId, noticeId));
      await db
        .update(notices)
        .set({
          assignedToRole: null,
          assignedToDepartment: null,
          updatedAt: new Date(),
        })
        .where(eq(notices.id, noticeId));
      await ActivityLogService.log({
        userId: assignedByUserId,
        action: "assign",
        resourceType: "notice",
        resourceId: noticeId,
        details: "assigned to all staff",
      });
      return res.json({ success: true, assigneeLabel: "All Staff" });
    }

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
