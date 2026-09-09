import type { Express } from "express";
import { overtimeRepository } from "./repositories/overtime.repository.js";
import { insertOvertimeRecordSchema } from "@shared/schema";
import { isManagerialRole, normalizeRole, ROLES } from "./utils/role-utils.js";
import { requireActionPermission } from "./middleware/action-permission.js";
import { ActivityLogService } from "./services/activity-service.js";
import { z } from "zod";

const overtimeRejectSchema = z.object({
  reason: z.string().trim().max(2000).optional()
}).strict();

// Resolve the caller's effective (active) role from the auth payload.
function callerRole(req: any): string {
  return (req.user?.activeRoleId ?? req.user?.roleId ?? req.user?.role ?? "") as string;
}

export function registerOvertimeRoutes(app: Express) {
  // GET /api/overtime - Get all overtime records for the current user
  app.get("/api/overtime", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const { normalizeRole } = await import("./utils/role-utils.js");
      const { getDepartmentFilterUserIds } = await import("./dashboard-routes.js");
      const { pool } = await import("./db.js");
      const userRes = await pool.query("SELECT role FROM drm.users WHERE id = $1", [userId]);
      const dbRole = userRes.rows[0]?.role || req.user.roleId;

      const role = normalizeRole(dbRole);
      const isManager = role.endsWith("_manager") || role.endsWith("_assistant_manager");
      const isGlobalAdmin = role === "super_admin" || role === "admin";

      let targetUserIds = [userId];

      if (isGlobalAdmin || isManager) {
        const records = await overtimeRepository.findAll();
        return res.json(records);
      }

      const result = await pool.query(
        `select o.id, o.user_id as "userId", o.date, o.hours as "timeSpent", o.status, o.reason as "taskTitle", o.reason as "taskDetails", o.approved_by as "reviewedByUserId", o.created_at as "createdAt", o.updated_at as "updatedAt", u.full_name as "userName"
           from drm.overtime_records o
           left join drm.users u on u.id = o.user_id
          where o.user_id = ANY($1::uuid[])
          order by o.created_at desc`,
        [targetUserIds]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching overtime records:", error);
      res.status(500).json({ error: "Failed to fetch overtime records" });
    }
  });

  // GET /api/admin/overtime - Get all overtime records for the manager
  app.get("/api/admin/overtime", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      // This returns every employee's overtime records, so restrict to
      // managerial roles (manager/HOD/super_hod/admin).
      if (!isManagerialRole(callerRole(req))) {
        return res.status(403).json({ error: "You are not authorized to view all overtime records." });
      }
      const records = await overtimeRepository.findAll();
      res.json(records);
    } catch (error) {
      console.error("Error fetching all overtime records:", error);
      res.status(500).json({ error: "Failed to fetch overtime records" });
    }
  });

  // GET /api/overtime/all - Manager view: all records
  app.get("/api/overtime/all", async (req, res) => {
    try {
      if (!req.user) { return res.status(401).json({ error: "Not authenticated" }); }
      // Manager-only view of all records; restrict to managerial roles.
      if (!isManagerialRole(callerRole(req))) {
        return res.status(403).json({ error: "You are not authorized to view all overtime records." });
      }
      const { pool } = await import("./db.js");
      const { rows } = await pool.query(`SELECT o.id, o.user_id AS "userId", u.full_name AS "userName", o.date, o.hours AS "timeSpent", o.status, o.reason, COALESCE(o.task_title, o.reason, 'N/A') AS "taskTitle", COALESCE(o.task_details, '') AS "taskDetails", o.created_at AS "createdAt" FROM drm.overtime_records o LEFT JOIN drm.users u ON u.id = o.user_id ORDER BY o.created_at DESC`);
      res.json(rows);
    } catch (error) { res.status(500).json({ error: "Failed" }); }
  });

  // GET /api/overtime/stats - Get overtime statistics for the current user
  app.get("/api/overtime/stats", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const stats = await overtimeRepository.getStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching overtime stats:", error);
      res.status(500).json({ error: "Failed to fetch overtime statistics" });
    }
  });

  // GET /api/overtime/monthly - Get monthly overtime minutes
  app.get("/api/overtime/monthly", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth();

      const minutes = await overtimeRepository.getMonthlyOvertimeMinutes(
        userId,
        year,
        month
      );

      res.json({ year, month, totalMinutes: minutes });
    } catch (error) {
      console.error("Error fetching monthly overtime:", error);
      res.status(500).json({ error: "Failed to fetch monthly overtime" });
    }
  });

  // GET /api/overtime/:id - Get a specific overtime record
  app.get("/api/overtime/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const record = await overtimeRepository.findById(req.params.id);

      if (!record) {
        return res.status(404).json({ error: "Overtime record not found" });
      }

      if (record.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to view this record" });
      }

      res.json(record);
    } catch (error) {
      console.error("Error fetching overtime record:", error);
      res.status(500).json({ error: "Failed to fetch overtime record" });
    }
  });

  // POST /api/overtime - Submit a new overtime record
  app.post("/api/overtime", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Prevent IDOR: ordinary users may only create overtime for themselves.
      // Submitting on behalf of another user is restricted to managerial roles.
      const targetUserId = req.body.userId || req.user.userId;
      if (targetUserId !== req.user.userId && !isManagerialRole(callerRole(req))) {
        return res.status(403).json({ error: "You can only submit overtime for yourself." });
      }
      const { date, hours, reason, taskTitle, taskDetails } = req.body ?? {};
      const parseResult = insertOvertimeRecordSchema.safeParse({
        date,
        hours,
        reason,
        taskTitle,
        taskDetails,
        userId: targetUserId,
      });

      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request data",
          details: parseResult.error.errors,
        });
      }

      const record = await overtimeRepository.create(parseResult.data);
      await ActivityLogService.log({
        userId: req.user.userId,
        action: "OVERTIME_CREATED",
        resourceType: "overtime_record",
        resourceId: record.id,
        details: `Created for user ${targetUserId}. Hours: ${record.timeSpent}`,
      });
      res.status(201).json(record);
    } catch (error) {
      console.error("Error creating overtime record:", error);
      res.status(500).json({ error: "Failed to create overtime record" });
    }
  });

  // DELETE /api/overtime/:id - Delete a pending overtime record
  app.delete("/api/overtime/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const { normalizeRole } = await import("./utils/role-utils.js");
      const { pool } = await import("./db.js");
      const userRes = await pool.query("SELECT role FROM drm.users WHERE id = $1", [userId]);
      const dbRole = userRes.rows[0]?.role || req.user.roleId;

      const role = normalizeRole(dbRole);
      const isManager = role.endsWith("_manager") || role.endsWith("_assistant_manager");
      const isGlobalAdmin = role === "super_admin" || role === "admin";

      let allowedUserIds = [userId];
      if (isGlobalAdmin || isManager) {
        allowedUserIds = []; // empty means all
      }

      const existing = await overtimeRepository.findById(req.params.id);
      if (!existing || existing.status !== "Pending") {
        return res.status(400).json({
          error: "Cannot delete this record. It may not exist or is no longer pending."
        });
      }

      if (!isGlobalAdmin && !allowedUserIds.includes(existing.userId)) {
        return res.status(403).json({ error: "Not authorized to delete this record" });
      }

      await pool.query(`delete from drm.overtime_records where id = $1`, [req.params.id]);

      await ActivityLogService.log({
        userId,
        action: "OVERTIME_DELETED",
        resourceType: "overtime_record",
        resourceId: req.params.id,
        details: `Deleted by user`,
      });

      res.json({ message: "Overtime record deleted successfully" });
    } catch (error) {
      console.error("Error deleting overtime record:", error);
      res.status(500).json({ error: "Failed to delete overtime record" });
    }
  });

  // PATCH /api/overtime/:id/approve - Approve an overtime record (for managers)
  app.patch("/api/overtime/:id/approve", requireActionPermission("overtime.approve", { allowRole: isManagerialRole, message: "You are not authorized to approve overtime records." }), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      // Only managerial roles may approve overtime.
      if (!isManagerialRole(callerRole(req))) {
        return res.status(403).json({ error: "You are not authorized to approve overtime records." });
      }
      // Segregation of duties: a non-admin may not approve their own record.
      const existingOt = await overtimeRepository.findById(req.params.id);
      if (
        existingOt &&
        existingOt.userId === userId &&
        normalizeRole(callerRole(req)) !== ROLES.ADMIN
      ) {
        return res.status(403).json({ error: "You cannot approve your own overtime record." });
      }
      const record = await overtimeRepository.approve(req.params.id, userId);

      if (!record) {
        return res.status(400).json({
          error: "Cannot approve this record. It may not exist or is no longer pending."
        });
      }

      await ActivityLogService.log({
        userId,
        action: "OVERTIME_APPROVED",
        resourceType: "overtime_record",
        resourceId: req.params.id,
        details: `Approved by role ${normalizeRole(callerRole(req))}`,
      });

      res.json(record);
    } catch (error) {
      console.error("Error approving overtime record:", error);
      res.status(500).json({ error: "Failed to approve overtime record" });
    }
  });

  // PATCH /api/overtime/:id/reject - Reject an overtime record (for managers)
  app.patch("/api/overtime/:id/reject", requireActionPermission("overtime.reject", { allowRole: isManagerialRole, message: "You are not authorized to reject overtime records." }), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const _rejParsed = overtimeRejectSchema.safeParse(req.body);
      const reason = _rejParsed.success ? _rejParsed.data.reason : undefined;

      // Only managerial roles may reject overtime.
      if (!isManagerialRole(callerRole(req))) {
        return res.status(403).json({ error: "You are not authorized to reject overtime records." });
      }
      // Segregation of duties: a non-admin may not reject their own record.
      const existingOtR = await overtimeRepository.findById(req.params.id);
      if (
        existingOtR &&
        existingOtR.userId === userId &&
        normalizeRole(callerRole(req)) !== ROLES.ADMIN
      ) {
        return res.status(403).json({ error: "You cannot reject your own overtime record." });
      }
      const record = await overtimeRepository.reject(req.params.id, userId, reason);

      if (!record) {
        return res.status(400).json({
          error: "Cannot reject this record. It may not exist or is no longer pending."
        });
      }

      await ActivityLogService.log({
        userId,
        action: "OVERTIME_REJECTED",
        resourceType: "overtime_record",
        resourceId: req.params.id,
        details: `Rejected by role ${normalizeRole(callerRole(req))}`,
      });

      res.json(record);
    } catch (error) {
      console.error("Error rejecting overtime record:", error);
      res.status(500).json({ error: "Failed to reject overtime record" });
    }
  });
}
